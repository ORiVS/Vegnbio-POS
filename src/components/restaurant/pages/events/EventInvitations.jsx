// src/components/restaurant/pages/events/EventInvitations.jsx
import { useParams } from "react-router-dom";
import { useState } from "react";
import { apiSendInvite } from "../../api";

// -------- Helpers: extraction d'erreurs (DRF / string / front) ----------
function extractApiErrors(error) {
    const out = [];
    if (!error) return out;

    if (typeof error === "string") return [error];

    const data = error?.data;

    if (typeof data === "string" && data.trim()) out.push(data.trim());

    if (Array.isArray(data)) {
        data.forEach((v) => out.push(typeof v === "string" ? v : JSON.stringify(v)));
    }

    if (data && typeof data === "object" && !Array.isArray(data)) {
        const pushVal = (label, val) => {
            if (val == null) return;
            if (Array.isArray(val)) {
                val.forEach((v) =>
                    out.push(label ? `${label}: ${typeof v === "string" ? v : JSON.stringify(v)}` : String(v))
                );
            } else if (typeof val === "object") {
                try { out.push(label ? `${label}: ${JSON.stringify(val)}` : JSON.stringify(val)); }
                catch { out.push(label ? `${label}: ${String(val)}` : String(val)); }
            } else {
                out.push(label ? `${label}: ${String(val)}` : String(val));
            }
        };

        if (data.detail) pushVal("", data.detail);
        if (data.error) pushVal("", data.error);
        if (data.non_field_errors) pushVal("", data.non_field_errors);

        Object.entries(data).forEach(([k, v]) => {
            if (["detail", "error", "non_field_errors"].includes(k)) return;
            pushVal(k, v);
        });
    }

    if (out.length === 0 && error?.message) out.push(String(error.message));
    if (out.length === 0) out.push(String(error));

    return out;
}

function ErrorMsg({ error, onClose }) {
    const msgs = extractApiErrors(error);
    const status = error?.status;
    return (
        <div className="p-3 bg-red-600/10 text-red-400 rounded text-sm space-y-2">
            <div className="flex items-start justify-between gap-3">
                <div className="font-medium">{status ? `Erreur ${status}` : "Erreur"}</div>
                {onClose && (
                    <button
                        type="button"
                        className="opacity-70 hover:opacity-100 underline"
                        onClick={onClose}
                    >
                        fermer
                    </button>
                )}
            </div>
            <ul className="list-disc pl-5 space-y-1">
                {msgs.map((m, i) => (
                    <li key={i}>{m}</li>
                ))}
            </ul>
        </div>
    );
}

function parseEmails(input) {
    return Array.from(
        new Set(
            String(input || "")
                .split(/\s|,|;|\n/)
                .map((s) => s.trim())
                .filter((e) => e.length > 3 && e.includes("@"))
        )
    );
}

function parseIds(input) {
    return Array.from(
        new Set(
            String(input || "")
                .split(/\s|,|;|\n/)
                .map((s) => s.trim())
                .filter(Boolean)
                .map((s) => Number(s))
                .filter((n) => Number.isFinite(n) && n > 0)
        )
    );
}

export default function EventInvitations() {
    const { id } = useParams();
    const eventId = Number(id);

    const [info, setInfo] = useState("");
    const [err, setErr] = useState(null);

    // Single email / phone
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");

    // Bulk emails
    const [bulkEmails, setBulkEmails] = useState("");

    // Optionnel: par ID (si tu veux aussi inviter par ID utilisateur)
    const [singleId, setSingleId] = useState("");
    const [bulkIds, setBulkIds] = useState("");

    const [sendingOneEmail, setSendingOneEmail] = useState(false);
    const [sendingBulkEmails, setSendingBulkEmails] = useState(false);
    const [sendingOneId, setSendingOneId] = useState(false);
    const [sendingBulkIds, setSendingBulkIds] = useState(false);

    // --- Inviter 1 contact par EMAIL (recommandé, 0 change back)
    const sendOneEmail = async (e) => {
        e?.preventDefault?.();
        setErr(null);
        setInfo("");

        const hasEmail = String(email || "").trim().length > 3 && email.includes("@");
        const hasPhone = String(phone || "").trim().length > 0;

        if (!hasEmail && !hasPhone) {
            setErr("Renseigne au moins un e-mail ou un téléphone.");
            return;
        }

        setSendingOneEmail(true);
        try {
            await apiSendInvite(eventId, {
                ...(hasEmail ? { email } : {}),
                ...(hasPhone ? { phone } : {}),
            });
            setInfo("Invitation envoyée.");
            setEmail("");
            setPhone("");
        } catch (e2) {
            setErr(e2);
        } finally {
            setSendingOneEmail(false);
        }
    };

    // --- Invitations en masse par EMAILS (boucle front → /invite/)
    const sendBulkByEmails = async (e) => {
        e?.preventDefault?.();
        setErr(null);
        setInfo("");
        const emails = parseEmails(bulkEmails);
        if (!emails.length) {
            setErr("Ajoute au moins une adresse e-mail (séparées par virgule, espace ou retour à la ligne).");
            return;
        }
        setSendingBulkEmails(true);
        try {
            await Promise.all(emails.map((em) => apiSendInvite(eventId, { email: em })));
            setInfo(`${emails.length} invitation(s) envoyée(s).`);
            setBulkEmails("");
        } catch (e2) {
            setErr(e2);
        } finally {
            setSendingBulkEmails(false);
        }
    };

    // --- Optionnel: inviter 1 fournisseur par ID utilisateur
    const sendOneId = async (e) => {
        e?.preventDefault?.();
        setErr(null);
        setInfo("");

        const uid = Number(singleId);
        if (!Number.isFinite(uid) || uid <= 0) {
            setErr("ID utilisateur invalide (entier positif requis).");
            return;
        }

        setSendingOneId(true);
        try {
            // Ton back accepte aussi invited_user dans EventInviteCreateSerializer
            await apiSendInvite(eventId, { invited_user: uid });
            setInfo(`Invitation envoyée à l’utilisateur #${uid}.`);
            setSingleId("");
        } catch (e2) {
            setErr(e2);
        } finally {
            setSendingOneId(false);
        }
    };

    // --- Optionnel: invitations en masse par IDs (boucle front)
    const sendBulkByIds = async (e) => {
        e?.preventDefault?.();
        setErr(null);
        setInfo("");

        const ids = parseIds(bulkIds);
        if (!ids.length) {
            setErr("Ajoute au moins un ID utilisateur (séparés par virgule, espace ou retour à la ligne).");
            return;
        }

        setSendingBulkIds(true);
        try {
            await Promise.all(ids.map((uid) => apiSendInvite(eventId, { invited_user: uid })));
            setInfo(`${ids.length} invitation(s) envoyée(s).`);
            setBulkIds("");
        } catch (e2) {
            setErr(e2);
        } finally {
            setSendingBulkIds(false);
        }
    };

    return (
        <div className="p-6 space-y-6">
            <h1 className="text-2xl font-semibold">Invitations in-app — évènement #{eventId}</h1>

            {err && <ErrorMsg error={err} onClose={() => setErr(null)} />}
            {info && <div className="p-2 bg-emerald-600/10 text-emerald-600 rounded">{info}</div>}

            {/* === Inviter 1 contact par e-mail / téléphone === */}
            <section className="bg-white text-black border rounded-2xl p-4 space-y-3">
                <h2 className="font-medium">Inviter un fournisseur (e-mail / téléphone)</h2>
                <form onSubmit={sendOneEmail} className="grid md:grid-cols-3 gap-3">
                    <label className="text-sm">
                        <div className="opacity-70 mb-1">E-mail</div>
                        <input
                            type="email"
                            className="border rounded px-2 py-1 w-full"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="ex. fournisseur@mail.com"
                        />
                    </label>

                    <label className="text-sm">
                        <div className="opacity-70 mb-1">Téléphone (optionnel)</div>
                        <input
                            type="text"
                            className="border rounded px-2 py-1 w-full"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="+33 6 12 34 56 78"
                        />
                    </label>

                    <div className="flex items-end">
                        <button
                            className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
                            disabled={sendingOneEmail || (!email && !phone)}
                        >
                            {sendingOneEmail ? "Envoi…" : "Envoyer l’invitation"}
                        </button>
                    </div>
                </form>
                <p className="text-xs opacity-70">
                    L’invitation apparaîtra chez le fournisseur si l’e-mail correspond à son compte.
                </p>
            </section>

            {/* === Invitations en masse par e-mails === */}
            <section className="bg-white text-black border rounded-2xl p-4 space-y-3">
                <h2 className="font-medium">Invitations en masse (e-mails)</h2>
                <form onSubmit={sendBulkByEmails} className="space-y-2">
          <textarea
              rows={6}
              className="border rounded px-2 py-1 w-full"
              placeholder="email1@x.com, email2@y.com  (séparés par virgule / espace / retour à la ligne)"
              value={bulkEmails}
              onChange={(e) => setBulkEmails(e.target.value)}
          />
                    <button
                        className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
                        disabled={sendingBulkEmails || !bulkEmails.trim()}
                    >
                        {sendingBulkEmails ? "Envoi…" : "Envoyer les invitations"}
                    </button>
                </form>
                <p className="text-xs opacity-70">
                    Le front boucle sur <code>/invite/</code> avec <code>{'{ email }'}</code>. Aucun changement back requis.
                </p>
            </section>

            {/* === (Optionnel) Inviter par ID utilisateur === */}
            <section className="bg-white text-black border rounded-2xl p-4 space-y-3">
                <h2 className="font-medium">Inviter par ID utilisateur (optionnel)</h2>
                <form onSubmit={sendOneId} className="flex flex-wrap items-end gap-3">
                    <label className="text-sm">
                        <div className="opacity-70 mb-1">ID utilisateur</div>
                        <input
                            type="number"
                            min={1}
                            className="border rounded px-2 py-1 w-48"
                            placeholder="ex. 123"
                            value={singleId}
                            onChange={(e) => setSingleId(e.target.value)}
                        />
                    </label>
                    <button
                        className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
                        disabled={sendingOneId || !singleId}
                    >
                        {sendingOneId ? "Envoi…" : "Envoyer l’invitation"}
                    </button>
                </form>

                <form onSubmit={sendBulkByIds} className="space-y-2">
          <textarea
              rows={4}
              className="border rounded px-2 py-1 w-full"
              placeholder="Exemples: 12, 45, 78   ou   12 45 78   ou   (un ID par ligne)"
              value={bulkIds}
              onChange={(e) => setBulkIds(e.target.value)}
          />
                    <button
                        className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
                        disabled={sendingBulkIds || !bulkIds.trim()}
                    >
                        {sendingBulkIds ? "Envoi…" : "Envoyer les invitations (IDs)"}
                    </button>
                </form>
            </section>
        </div>
    );
}
