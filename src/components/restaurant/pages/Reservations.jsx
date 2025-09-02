// src/components/restaurant/pages/Reservations.jsx
import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import useActiveRestaurantId from "../hooks/useActiveRestaurantId";
import {
    apiGetRestaurantReservations,
    apiModerateReservation,
    apiCreateReservationAsRestaurateur,
    apiGetRestaurant,
    apiSearchClients, // GET /api/accounts/users/?search=...
} from "../api";

function Loading() {
    return <div className="p-4 text-sm opacity-70">Chargement…</div>;
}

/**
 * Extrait des messages lisibles depuis les erreurs (DRF / texte / front).
 * - Supporte: {detail}, {error}, {non_field_errors}, champs par clé, tableaux au root, string, etc.
 * - On lui passe l'objet d'erreur complet (err) renvoyé par http()
 */
function extractApiErrors(error) {
    const out = [];
    if (!error) return out;

    // string directe
    if (typeof error === "string") return [error];

    const data = error?.data;

    // 1) texte brut (stack/HTML/message)
    if (typeof data === "string" && data.trim()) {
        out.push(data.trim());
    }

    // 2) tableau racine (ex: ["message1","message2"])
    if (Array.isArray(data)) {
        data.forEach((v) => out.push(typeof v === "string" ? v : JSON.stringify(v)));
    }

    // 3) objets DRF { detail, field: [...], non_field_errors: [...] }
    if (data && typeof data === "object" && !Array.isArray(data)) {
        const pushVal = (label, val) => {
            if (val == null) return;
            if (Array.isArray(val)) {
                // liste d'erreurs pour un champ
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

        // champs courants d'abord
        if (data.detail) pushVal("", data.detail);
        if (data.error) pushVal("", data.error);
        if (data.non_field_errors) pushVal("", data.non_field_errors);

        // autres clés (date, start_time, etc.)
        Object.entries(data).forEach(([k, v]) => {
            if (["detail", "error", "non_field_errors"].includes(k)) return;
            pushVal(k, v);
        });
    }

    // 4) fallback sur message & toString
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

function Empty({ children }) {
    return <div className="p-3 opacity-60">{children}</div>;
}

const STATUSES = ["PENDING", "CONFIRMED", "CANCELLED"];

export default function Reservations() {
    const restaurantId = useActiveRestaurantId();
    const user = useSelector((s) => s.user);

    // ------ En-tête : nom + e-mail de contact ------
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

    // ------ Listing ------
    const [status, setStatus] = useState("");
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState(null);

    // ------ Création manuelle (par e-mail client UNIQUEMENT) ------
    const [creating, setCreating] = useState(false);
    const [rooms, setRooms] = useState([]);

    const [clientEmail, setClientEmail] = useState("");
    const [clientSuggestions, setClientSuggestions] = useState([]); // [{id,email,first_name,last_name}]
    const [form, setForm] = useState({
        room: "", // id salle (si full_restaurant = false)
        full_restaurant: false,
        date: "",
        start_time: "",
        end_time: "",
    });

    // Charge méta restaurant (rooms…)
    useEffect(() => {
        if (!restaurantId) return;
        apiGetRestaurant(restaurantId)
            .then((meta) => {
                setRestaurantMeta(meta || null);
                setRooms(Array.isArray(meta?.rooms) ? meta.rooms : []);
            })
            .catch((e) => {
                setRestaurantMeta(null);
                setRooms([]);
                console.warn("Restaurant meta load failed:", e);
            });
    }, [restaurantId]);

    // Autocomplete clients (affichage uniquement)
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

    // Liste des réservations
    const load = () => {
        if (!restaurantId) return;
        setLoading(true);
        setErr(null);
        const params = status ? { status } : {};
        apiGetRestaurantReservations(restaurantId, params)
            .then((list) => setRows(Array.isArray(list) ? list : []))
            .catch((e) => setErr(e)) // garder l'objet complet pour sortir les messages DRF
            .finally(() => setLoading(false));
    };
    useEffect(() => {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        load();
    }, [restaurantId, status]);

    // Actions modération
    const onModerate = async (id, next) => {
        try {
            setErr(null);
            await apiModerateReservation(id, next);
            load();
        } catch (e) {
            setErr(e); // objet complet
        }
    };

    // Helpers
    const normalizeDate = (d) => {
        if (!d) return d;
        const s = String(d);
        return s.includes("/") ? s.split("/").reverse().join("-") : s; // "23/10/2025" → "2025-10-23"
    };
    const isEmail = (v) => /\S+@\S+\.\S+/.test(String(v || "").trim());

    // Soumission création (PAR E-MAIL)
    const onCreate = async (e) => {
        e.preventDefault();
        try {
            setErr(null);

            if (!isEmail(clientEmail)) throw new Error("Renseigne un e-mail client valide.");
            if (!form.date) throw new Error("Renseigne la date.");
            if (!form.start_time || !form.end_time) throw new Error("Renseigne l’horaire.");

            const payload = {
                customer_email: String(clientEmail).trim(),
                date: normalizeDate(form.date), // "YYYY-MM-DD"
                start_time: form.start_time, // "HH:MM"
                end_time: form.end_time, // "HH:MM"
                full_restaurant: !!form.full_restaurant,
            };

            if (payload.full_restaurant) {
                payload.restaurant = Number(restaurantId);
            } else {
                const roomId = Number(form.room);
                if (!roomId) throw new Error("Sélectionne une salle.");
                payload.room = roomId;
            }

            await apiCreateReservationAsRestaurateur(payload);

            // Reset & refresh
            setCreating(false);
            setClientEmail("");
            setClientSuggestions([]);
            setForm({
                room: "",
                full_restaurant: false,
                date: "",
                start_time: "",
                end_time: "",
            });
            load();
        } catch (e) {
            setErr(e); // objet complet (affiche messages DRF)
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
                    {creating ? "Fermer" : "Créer (téléphone / walk-in)"}
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
                    <div className="grid md:grid-cols-3 gap-3">
                        {/* Client PAR EMAIL (datalist pour faciliter le choix) */}
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
                                placeholder="jj/mm/aaaa"
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

                        {/* Cible: toggle clair */}
                        <div className="col-span-full">
                            <div className="text-sm opacity-70 mb-1">Cible</div>
                            <div className="inline-flex rounded-xl overflow-hidden border">
                                <button
                                    type="button"
                                    className={`px-3 py-2 ${
                                        !form.full_restaurant ? "bg-emerald-600 text-white" : "bg-white text-black"
                                    }`}
                                    onClick={() => setForm((f) => ({ ...f, full_restaurant: false }))}
                                >
                                    Salle
                                </button>
                                <button
                                    type="button"
                                    className={`px-3 py-2 ${
                                        form.full_restaurant ? "bg-emerald-600 text-white" : "bg-white text-black"
                                    }`}
                                    onClick={() => setForm((f) => ({ ...f, full_restaurant: true }))}
                                >
                                    Restaurant entier
                                </button>
                            </div>
                        </div>

                        {/* Cible détails */}
                        {form.full_restaurant ? (
                            <Field label="Restaurant">
                                {/* Affichage en lecture seule (l’ID est pris depuis restaurantId) */}
                                <input className="border rounded px-2 py-1 w-full" value={restaurantName} disabled />
                            </Field>
                        ) : (
                            <Field label="Salle">
                                <select
                                    className="border rounded px-2 py-1 w-full"
                                    value={form.room}
                                    onChange={(e) => setForm((f) => ({ ...f, room: e.target.value }))}
                                    required
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
                </form>
            )}

            {/* Zone d’erreur globale (affiche les messages DRF) */}
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
                                {/* ➜ EXACTEMENT ce que tu veux :
                      - full_restaurant true  → seulement le nom du restaurant
                      - full_restaurant false → seulement le nom de la salle */}
                                <td>{r.full_restaurant ? (r.restaurant_name || "—") : (r.room_name || "—")}</td>
                                <td>{r.date}</td>
                                <td>
                                    {(r.start_time || "").slice(0, 5)}–{(r.end_time || "").slice(0, 5)}
                                </td>
                                <td>{r.status}</td>
                                <td className="space-x-2">
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
        </div>
    );
}

function Field({ label, children }) {
    return (
        <label className="text-sm block">
            <div className="opacity-70 mb-1">{label}</div>
            {children}
        </label>
    );
}
