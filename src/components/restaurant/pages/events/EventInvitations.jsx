// src/components/restaurant/pages/events/EventInvitations.jsx
import { useParams } from "react-router-dom";
import { useState } from "react";
import { apiSendInvite, apiSendInvitesBulk } from "../../api";

// -------- Helpers: extraction d'erreurs (DRF / string / front) ----------
function extractApiErrors(error) {
    const out = [];
    if (!error) return out;

    // string directe
    if (typeof error === "string") return [error];

    const data = error?.data;

    // 1) texte brut
    if (typeof data === "string" && data.trim()) out.push(data.trim());

    // 2) tableau racine
    if (Array.isArray(data)) {
        data.forEach((v) => out.push(typeof v === "string" ? v : JSON.stringify(v)));
    }

    // 3) objet DRF
    if (data && typeof data === "object" && !Array.isArray(data)) {
        const pushVal = (label, val) => {
            if (val == null) return;
            if (Array.isArray(val)) {
                val.forEach((v) =>
                    out.push(label ? `${label}: ${typeof v === "string" ? v : JSON.stringify(v)}` : String(v))
                );
            } else if (typeof val === "object") {
                try {
                    out.push(label ? `${label}: ${JSON.stringify(val)}` : JSON.stringify(val));
                } catch {
                    out.push(label ? `${label}: ${String(val)}` : String(val));
                }
            } else {
                out.push(label ? `${label}: ${String(val)}` : String(val));
            }
        };

        // messages globaux d'abord
        if (data.detail) pushVal("", data.detail);
        if (data.error) pushVal("", data.error);
        if (data.non_field_errors) pushVal("", data.non_field_errors);

        // autres clés
        Object.entries(data).forEach(([k, v]) => {
            if (["detail", "error", "non_field_errors"].includes(k)) return;
            pushVal(k, v);
        });
    }

    // 4) fallbacks
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

// Récupère les erreurs spécifiques à un champ DRF (ex: "email", "phone", "emails")
function getFieldErrors(error, field) {
    const d = error?.data;
    if (!d || typeof d !== "object") return [];
    const val = d[field];
    if (!val) return [];
    if (Array.isArray(val)) return val.map((v) => String(v));
    return [String(val)];
}

export default function EventInvitations() {
    const { id } = useParams();
    const [one, setOne] = useState({ email: "", phone: "" });
    const [bulk, setBulk] = useState("");
    const [info, setInfo] = useState("");
    const [err, setErr] = useState(null);

    // Champ-erreurs ciblées (affichage sous les inputs)
    const emailErrors = getFieldErrors(err, "email");
    const phoneErrors = getFieldErrors(err, "phone");
    const emailsErrors = getFieldErrors(err, "emails"); // pour l'envoi en masse

    const sendOne = async (e) => {
        e.preventDefault();
        setErr(null);
        setInfo("");

        // petit pré-check côté client (facultatif)
        const hasEmail = String(one.email || "").trim().length > 0;
        const hasPhone = String(one.phone || "").trim().length > 0;
        if (!hasEmail && !hasPhone) {
            setErr("Renseigne au moins un email ou un téléphone.");
            return;
        }

        try {
            await apiSendInvite(Number(id), {
                email: hasEmail ? one.email : undefined,
                phone: hasPhone ? one.phone : undefined,
            });
            setInfo("Invitation envoyée.");
            setOne({ email: "", phone: "" });
        } catch (e) {
            // ⬇️ on conserve l'objet complet pour ErrorMsg + erreurs de champ
            setErr(e);
        }
    };

    const sendBulk = async (e) => {
        e.preventDefault();
        setErr(null);
        setInfo("");

        try {
            const emails = bulk
                .split(/\s|,|;|\n/)
                .map((s) => s.trim())
                .filter(Boolean);

            if (!emails.length) {
                setErr("Ajoute au moins une adresse e-mail.");
                return;
            }

            await apiSendInvitesBulk(Number(id), emails);
            setInfo(`${emails.length} invitation(s) envoyée(s).`);
            setBulk("");
        } catch (e) {
            // ⬇️ on conserve l'objet complet pour ErrorMsg + erreurs de champ (emails)
            setErr(e);
        }
    };

    return (
        <div className="p-6 space-y-6">
            <h1 className="text-2xl font-semibold">Invitations — évènement #{id}</h1>

            {err && <ErrorMsg error={err} onClose={() => setErr(null)} />}
            {info && (
                <div className="p-2 bg-emerald-600/10 text-emerald-400 rounded">{info}</div>
            )}

            <section className="bg-white text-black border rounded-2xl p-4">
                <h2 className="font-medium mb-2">Inviter 1 contact</h2>
                <form onSubmit={sendOne} className="grid md:grid-cols-3 gap-3">
                    <label className="text-sm">
                        <div className="opacity-70 mb-1">Email</div>
                        <input
                            type="email"
                            className="border rounded px-2 py-1 w-full"
                            value={one.email}
                            onChange={(e) => setOne((o) => ({ ...o, email: e.target.value }))}
                            placeholder="ex. client@mail.com"
                        />
                        {!!emailErrors.length && (
                            <ul className="mt-1 text-xs text-red-500 list-disc pl-5">
                                {emailErrors.map((m, i) => (
                                    <li key={i}>{m}</li>
                                ))}
                            </ul>
                        )}
                    </label>

                    <label className="text-sm">
                        <div className="opacity-70 mb-1">Téléphone (optionnel)</div>
                        <input
                            type="text"
                            className="border rounded px-2 py-1 w-full"
                            value={one.phone}
                            onChange={(e) => setOne((o) => ({ ...o, phone: e.target.value }))}
                            placeholder="+33 6 12 34 56 78"
                        />
                        {!!phoneErrors.length && (
                            <ul className="mt-1 text-xs text-red-500 list-disc pl-5">
                                {phoneErrors.map((m, i) => (
                                    <li key={i}>{m}</li>
                                ))}
                            </ul>
                        )}
                    </label>

                    <div className="flex items-end">
                        <button className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500">
                            Envoyer
                        </button>
                    </div>
                </form>
            </section>

            <section className="bg-white text-black border rounded-2xl p-4">
                <h2 className="font-medium mb-2">Invitations en masse</h2>
                <form onSubmit={sendBulk} className="space-y-2">
          <textarea
              rows={6}
              className="border rounded px-2 py-1 w-full"
              placeholder="email1@x.com, email2@y.com, ... (séparés par virgule, espace ou retour ligne)"
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
          />
                    {!!emailsErrors.length && (
                        <ul className="mt-1 text-xs text-red-500 list-disc pl-5">
                            {emailsErrors.map((m, i) => (
                                <li key={i}>{m}</li>
                            ))}
                        </ul>
                    )}
                    <button className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500">
                        Envoyer
                    </button>
                </form>
            </section>
        </div>
    );
}
