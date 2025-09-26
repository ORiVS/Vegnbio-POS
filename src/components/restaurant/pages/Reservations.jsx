// src/components/restaurant/pages/Reservations.jsx
import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import useActiveRestaurantId from "../hooks/useActiveRestaurantId";
import {
    apiGetRestaurantReservations,
    apiModerateReservation,
    apiCreateReservationAsRestaurateur,
    apiAssignReservation,
    apiGetRestaurant,
    apiSearchClients,
} from "../api";

/* ---------- UI utilitaires ---------- */
function Loading() {
    return <div className="p-4 text-sm opacity-70">Chargement…</div>;
}

function extractApiErrors(error) {
    const out = [];
    if (!error) return out;
    if (typeof error === "string") return [error];

    const data = error?.data;

    if (typeof data === "string" && data.trim()) out.push(data.trim());
    if (Array.isArray(data)) data.forEach((v) => out.push(typeof v === "string" ? v : JSON.stringify(v)));

    if (data && typeof data === "object" && !Array.isArray(data)) {
        const pushVal = (label, val) => {
            if (val == null) return;
            if (Array.isArray(val)) val.forEach((v) => out.push(label ? `${label}: ${String(v)}` : String(v)));
            else if (typeof val === "object") out.push(label ? `${label}: ${JSON.stringify(val)}` : JSON.stringify(val));
            else out.push(label ? `${label}: ${String(val)}` : String(val));
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
                <div className="font-medium">{status ? `Erreur ${status}` : `Erreur`}</div>
                {onClose && (
                    <button type="button" className="opacity-70 hover:opacity-100 underline" onClick={onClose}>
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

function Empty({ children }) {
    return <div className="p-3 opacity-60">{children}</div>;
}

function Field({ label, children }) {
    return (
        <label className="text-sm block">
            <div className="opacity-70 mb-1">{label}</div>
            {children}
        </label>
    );
}

/* ---------- Constantes ---------- */
const STATUSES = ["PENDING", "CONFIRMED", "CANCELLED"];

/* ============================================================
   PAGE : Réservations (RESTO)
   - Création -> (PENDING) -> Affectation (assign) salle / full
   - Filtre statut, erreurs DRF, même style visuel
   ============================================================ */
export default function Reservations() {
    const restaurantId = useActiveRestaurantId();
    const user = useSelector((s) => s.user);

    // Header local : nom + email
    const userEmail = user?.email || null;
    const userRestaurants = user?.restaurants || [];
    const activeRestaurantFromStore = useMemo(
        () => userRestaurants.find((r) => Number(r?.id) === Number(restaurantId)),
        [userRestaurants, restaurantId]
    );

    const [restaurantMeta, setRestaurantMeta] = useState(null); // GET /restaurants/:id/
    const restaurantName =
        restaurantMeta?.name ||
        activeRestaurantFromStore?.name ||
        (restaurantId ? `Restaurant #${restaurantId}` : "—");
    const restaurantEmail =
        activeRestaurantFromStore?.email ||
        activeRestaurantFromStore?.owner_email ||
        userEmail ||
        null;

    // Listing
    const [status, setStatus] = useState("");
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState(null);

    // Création
    const [creating, setCreating] = useState(false);
    const [rooms, setRooms] = useState([]);

    const [clientEmail, setClientEmail] = useState("");
    const [clientSuggestions, setClientSuggestions] = useState([]); // [{id,email,first_name,last_name}]
    const [form, setForm] = useState({
        date: "",
        start_time: "",
        end_time: "",
        party_size: 1, // NEW
    });

    // Affectation (dialog)
    const [assignOpen, setAssignOpen] = useState(false);
    const [assignTargetId, setAssignTargetId] = useState(null);
    const [assignPayload, setAssignPayload] = useState({ full_restaurant: false, room: "" });
    const [assignErr, setAssignErr] = useState(null);
    const [assignBusy, setAssignBusy] = useState(false);

    // Charger meta restaurant (rooms…)
    useEffect(() => {
        if (!restaurantId) return;
        apiGetRestaurant(restaurantId)
            .then((meta) => {
                setRestaurantMeta(meta || null);
                setRooms(Array.isArray(meta?.rooms) ? meta.rooms : []);
            })
            .catch(() => {
                setRestaurantMeta(null);
                setRooms([]);
            });
    }, [restaurantId]);

    // Autocomplete clients
    useEffect(() => {
        const q = clientEmail?.trim();
        if (!q || q.length < 2) {
            setClientSuggestions([]);
            return;
        }
        let cancelled = false;
        apiSearchClients(q, 10)
            .then((list) => {
                if (!cancelled) setClientSuggestions(Array.isArray(list) ? list : []);
            })
            .catch(() => {
                if (!cancelled) setClientSuggestions([]);
            });
        return () => {
            cancelled = true;
        };
    }, [clientEmail]);

    // Liste
    const load = () => {
        if (!restaurantId) return;
        setLoading(true);
        setErr(null);
        const params = status ? { status } : {};
        apiGetRestaurantReservations(restaurantId, params)
            .then((list) => setRows(Array.isArray(list) ? list : []))
            .catch((e) => setErr(e))
            .finally(() => setLoading(false));
    };
    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [restaurantId, status]);

    // Helpers
    const normalizeDate = (d) => {
        if (!d) return d;
        const s = String(d);
        return s.includes("/") ? s.split("/").reverse().join("-") : s;
    };
    const isEmail = (v) => /\S+@\S+\.\S+/.test(String(v || "").trim());

    // Création → puis Assign
    const onCreate = async (e) => {
        e.preventDefault();
        try {
            setErr(null);

            if (!restaurantId) throw new Error("Sélectionne un restaurant.");
            if (!isEmail(clientEmail)) throw new Error("Renseigne un e-mail client valide.");
            if (!form.date) throw new Error("Renseigne la date.");
            if (!form.start_time || !form.end_time) throw new Error("Renseigne l’horaire.");
            const party = Number(form.party_size);
            if (!party || party <= 0) throw new Error("Nombre de couverts (party_size) invalide.");

            // 1) créer la réservation PENDING (sans room ni full_restaurant)
            const payload = {
                customer_email: String(clientEmail).trim(),
                restaurant: Number(restaurantId),              // TOUJOURS requis
                date: normalizeDate(form.date),                // "YYYY-MM-DD"
                start_time: form.start_time,                   // "HH:MM"
                end_time: form.end_time,                       // "HH:MM"
                party_size: party,                             // NEW
            };

            const created = await apiCreateReservationAsRestaurateur(payload);

            // 2) ouvrir le dialog d’affectation
            setAssignTargetId(created?.id);
            setAssignPayload({ full_restaurant: false, room: "" });
            setAssignErr(null);
            setAssignOpen(true);

            // reset minimal du form (on garde l’email pour enchaîner si besoin)
            setForm({ date: "", start_time: "", end_time: "", party_size: 1 });
        } catch (e) {
            setErr(e);
        }
    };

    // Lancement assign
    const doAssign = async () => {
        try {
            setAssignErr(null);
            if (!assignTargetId) throw new Error("Réservation introuvable.");
            const wantFull = !!assignPayload.full_restaurant;

            // payload selon choix
            const payload = wantFull
                ? { full_restaurant: true }
                : { room: Number(assignPayload.room) || 0 };

            if (!wantFull && !payload.room) throw new Error("Sélectionne une salle.");

            setAssignBusy(true);
            await apiAssignReservation(assignTargetId, payload);

            setAssignBusy(false);
            setAssignOpen(false);
            setAssignTargetId(null);
            setAssignPayload({ full_restaurant: false, room: "" });

            // refresh
            load();
        } catch (e) {
            setAssignBusy(false);
            setAssignErr(e);
        }
    };

    // Action modération
    const onModerate = async (id, next) => {
        try {
            setErr(null);
            await apiModerateReservation(id, next);
            load();
        } catch (e) {
            setErr(e);
        }
    };

    return (
        <div className="p-6 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">Réservations</h1>
                    <div className="text-xs opacity-70 mt-1">
                        <span>{restaurantName}</span>{" "}
                        <span>
              • Contact&nbsp;: <span className="font-medium">{restaurantEmail || "—"}</span>
            </span>
                    </div>
                </div>
                <button
                    onClick={() => {
                        setCreating((v) => !v);
                        setErr(null);
                    }}
                    className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500"
                >
                    {creating ? "Fermer" : "Créer"}
                </button>
            </div>

            {!restaurantId && <ErrorMsg error={"Sélectionne un restaurant dans l’en-tête."} />}

            {/* Filtres */}
            <div className="flex items-center gap-3">
                <label className="text-sm">Filtrer statut :</label>
                <select
                    className="border rounded px-2 py-1 bg-white text-black"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                >
                    <option value="">Tous</option>
                    {STATUSES.map((s) => (
                        <option key={s} value={s}>
                            {s}
                        </option>
                    ))}
                </select>
                <button className="px-3 py-1 border rounded" onClick={load}>
                    Rafraîchir
                </button>
            </div>

            {/* Form création */}
            {creating && (
                <form onSubmit={onCreate} className="bg-white text-black border rounded-2xl p-4 space-y-4">
                    <div className="grid md:grid-cols-4 gap-3">
                        {/* Client PAR EMAIL */}
                        <Field label="Client (email)">
                            <input
                                list="client-emails"
                                className="border rounded px-2 py-1 w-full"
                                value={clientEmail}
                                onChange={(e) => setClientEmail(e.target.value)}
                                placeholder="ex. client@mail.com"
                                autoComplete="off"
                                required
                            />
                            <datalist id="client-emails">
                                {clientSuggestions.map((u) => (
                                    <option key={u.id} value={u.email}>
                                        {(u.first_name || u.last_name)
                                            ? `${u.first_name || ""} ${u.last_name || ""}`.trim()
                                            : u.email}
                                    </option>
                                ))}
                            </datalist>
                        </Field>

                        <Field label="Date">
                            <input
                                required
                                type="date"
                                className="border rounded px-2 py-1 w-full"
                                value={form.date}
                                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                            />
                        </Field>

                        <Field label="Début">
                            <input
                                required
                                type="time"
                                className="border rounded px-2 py-1 w-full"
                                value={form.start_time}
                                onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
                            />
                        </Field>

                        <Field label="Fin">
                            <input
                                required
                                type="time"
                                className="border rounded px-2 py-1 w-full"
                                value={form.end_time}
                                onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
                            />
                        </Field>

                        <Field label="Nombre de places">
                            <input
                                min={1}
                                type="number"
                                className="border rounded px-2 py-1 w-full"
                                value={form.party_size}
                                onChange={(e) => setForm((f) => ({ ...f, party_size: e.target.value }))}
                                required
                            />
                        </Field>
                    </div>

                    <div className="flex gap-2">
                        <button className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500">Créer</button>
                        <button
                            type="button"
                            className="px-3 py-2 rounded border"
                            onClick={() => {
                                setCreating(false);
                                setErr(null);
                            }}
                        >
                            Annuler
                        </button>
                    </div>

                    <div className="text-xs opacity-70">
                        Astuce : après la création, une fenêtre s’ouvrira pour **affecter** la réservation à une salle ou au
                        restaurant entier (contrôles de conflits côté API).
                    </div>
                </form>
            )}

            {/* Erreurs globales */}
            {err && <ErrorMsg error={err} onClose={() => setErr(null)} />}

            {loading && <Loading />}

            {/* Tableau */}
            {!loading && !err && (
                rows.length ? (
                    <table className="w-full text-sm bg-white text-black border rounded-2xl overflow-hidden">
                        <thead className="bg-gray-100">
                        <tr className="text-left">
                            <th className="py-2 px-3">#</th>
                            <th>Client</th>
                            <th>Restaurant / Salle</th>
                            <th>Date</th>
                            <th>Heures</th>
                            <th>Couverts</th>
                            <th>Statut</th>
                            <th>Actions</th>
                        </tr>
                        </thead>
                        <tbody>
                        {rows.map((r) => (
                            <tr key={r.id} className="border-t">
                                <td className="py-2 px-3">{r.id}</td>
                                <td>
                                    {r.customer_email_read ||
                                        r.customer_email ||
                                        [r.customer_first_name, r.customer_last_name].filter(Boolean).join(" ") ||
                                        (r.customer_id_read ? `#${r.customer_id_read}` : "N/A")}
                                </td>
                                {/* full_restaurant → nom resto ; sinon nom salle */}
                                <td>{r.full_restaurant ? (r.restaurant_name || "—") : (r.room_name || "—")}</td>
                                <td>{r.date}</td>
                                <td>{(r.start_time || "").slice(0, 5)}–{(r.end_time || "").slice(0, 5)}</td>
                                <td>{r.party_size ?? "—"}</td>
                                <td>{r.status}</td>
                                <td className="space-x-2">
                                    {r.status === "PENDING" && (
                                        <>
                                            <button
                                                className="px-2 py-1 rounded bg-slate-700 text-white"
                                                onClick={() => {
                                                    setAssignTargetId(r.id);
                                                    setAssignPayload({ full_restaurant: !!r.full_restaurant, room: "" });
                                                    setAssignErr(null);
                                                    setAssignOpen(true);
                                                }}
                                            >
                                                Affecter
                                            </button>
                                        </>
                                    )}
                                    {r.status !== "CONFIRMED" && (
                                        <button
                                            className="px-2 py-1 rounded bg-emerald-600"
                                            onClick={() => onModerate(r.id, "CONFIRMED")}
                                        >
                                            Confirmer
                                        </button>
                                    )}
                                    {r.status !== "CANCELLED" && (
                                        <button
                                            className="px-2 py-1 rounded bg-red-600"
                                            onClick={() => onModerate(r.id, "CANCELLED")}
                                        >
                                            Annuler
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                ) : (
                    <Empty>Aucune réservation.</Empty>
                )
            )}

            {/* Dialog Affectation */}
            {assignOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/60" onClick={() => setAssignOpen(false)} />
                    <div className="relative bg-white text-black rounded-2xl w-full max-w-lg p-5 shadow-2xl">
                        <div className="flex items-center justify-between mb-3">
                            <div className="text-lg font-semibold">Affecter la réservation #{assignTargetId}</div>
                            <button className="opacity-70 hover:opacity-100" onClick={() => setAssignOpen(false)}>✕</button>
                        </div>

                        {assignErr && (
                            <div className="mb-3">
                                <ErrorMsg error={assignErr} onClose={() => setAssignErr(null)} />
                            </div>
                        )}

                        <div className="space-y-3">
                            <div className="text-sm opacity-70">Choisir la cible :</div>
                            <div className="inline-flex rounded-xl overflow-hidden border">
                                <button
                                    type="button"
                                    className={`px-3 py-2 ${!assignPayload.full_restaurant ? "bg-emerald-600 text-white" : "bg-white text-black"}`}
                                    onClick={() => setAssignPayload((p) => ({ ...p, full_restaurant: false }))}
                                >
                                    Salle
                                </button>
                                <button
                                    type="button"
                                    className={`px-3 py-2 ${assignPayload.full_restaurant ? "bg-emerald-600 text-white" : "bg-white text-black"}`}
                                    onClick={() => setAssignPayload((p) => ({ ...p, full_restaurant: true }))}
                                >
                                    Restaurant entier
                                </button>
                            </div>

                            {!assignPayload.full_restaurant && (
                                <Field label="Salle">
                                    <select
                                        className="border rounded px-2 py-1 w-full"
                                        value={assignPayload.room}
                                        onChange={(e) => setAssignPayload((p) => ({ ...p, room: e.target.value }))}
                                    >
                                        <option value="">— Sélectionner —</option>
                                        {rooms.map((r) => (
                                            <option key={r.id} value={r.id}>
                                                {r.name} ({r.capacity})
                                            </option>
                                        ))}
                                    </select>
                                </Field>
                            )}

                            <div className="flex gap-2 pt-1">
                                <button
                                    disabled={assignBusy}
                                    onClick={doAssign}
                                    className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60"
                                >
                                    {assignBusy ? "Affectation…" : "Affecter"}
                                </button>
                                <button
                                    type="button"
                                    className="px-3 py-2 rounded border"
                                    onClick={() => setAssignOpen(false)}
                                >
                                    Fermer
                                </button>
                            </div>

                            <div className="text-xs opacity-70">
                                Rappels : conflits gérés côté API (événement bloquant, salle déjà occupée, capacité insuffisante,
                                réservation “restaurant entier” existante, etc.).
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
