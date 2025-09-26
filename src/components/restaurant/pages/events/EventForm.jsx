// src/components/restaurant/pages/events/EventForm.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import useActiveRestaurantId from "../../hooks/useActiveRestaurantId";
import {
    apiCreateEvent,
    apiGetEvent,
    apiUpdateEvent,
    apiGetRestaurant,
    apiGetRegistrations,
} from "../../api";

function Loading() {
    return <div className="p-4 text-sm opacity-70">Chargement…</div>;
}

/* ---------- Helpers erreurs ---------- */
function extractApiErrors(error) {
    const out = [];
    if (!error) return out;
    if (typeof error === "string") return [error];

    const data = error?.data;
    if (typeof data === "string" && data.trim()) out.push(data.trim());
    if (Array.isArray(data)) data.forEach((v) => out.push(typeof v === "string" ? v : JSON.stringify(v)));
    if (data && typeof data === "object" && !Array.isArray(data)) {
        const push = (label, val) => {
            if (val == null) return;
            if (Array.isArray(val)) val.forEach((v) => out.push(label ? `${label}: ${String(v)}` : String(v)));
            else if (typeof val === "object") out.push(label ? `${label}: ${JSON.stringify(val)}` : JSON.stringify(val));
            else out.push(label ? `${label}: ${String(val)}` : String(val));
        };
        if (data.detail) push("", data.detail);
        if (data.error) push("", data.error);
        if (data.non_field_errors) push("", data.non_field_errors);
        Object.entries(data).forEach(([k, v]) => {
            if (["detail", "error", "non_field_errors"].includes(k)) return;
            push(k, v);
        });
    }
    if (!out.length && error?.message) out.push(String(error.message));
    if (!out.length) out.push(String(error));
    return out;
}
function ErrorBanner({ error, onClose }) {
    const msgs = extractApiErrors(error);
    if (!msgs.length) return null;
    const status = error?.status;
    return (
        <div className="p-3 bg-red-600/10 text-red-400 rounded text-sm space-y-2">
            <div className="flex items-start justify-between gap-3">
                <div className="font-medium">{status ? `Erreur ${status}` : "Erreur"}</div>
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
// erreurs par champ (inline)
function extractFieldErrors(data) {
    const out = {};
    if (!data || typeof data !== "object") return out;
    Object.entries(data).forEach(([k, v]) => {
        if (k === "detail" || k === "error" || k === "non_field_errors") return;
        if (Array.isArray(v)) out[k] = v.map((x) => (typeof x === "string" ? x : JSON.stringify(x)));
        else if (typeof v === "string") out[k] = [v];
        else if (v != null) out[k] = [JSON.stringify(v)];
    });
    if (Array.isArray(data?.non_field_errors)) out.non_field_errors = data.non_field_errors.map(String);
    else if (typeof data?.non_field_errors === "string") out.non_field_errors = [data.non_field_errors];
    return out;
}
function FieldError({ errors }) {
    if (!errors || !errors.length) return null;
    return <div className="mt-1 text-xs text-red-600">{errors.map((e, i) => <div key={i}>• {e}</div>)}</div>;
}

/* ---------- Domain helpers ---------- */
const TYPES = ["ANNIVERSAIRE", "CONFERENCE", "SEMINAIRE", "ANIMATION", "AUTRE"];

function weekdayFromISO(dateStr) {
    // 0=Mon … 6=Sun to match Python weekday()
    try {
        const d = new Date(dateStr);
        // JS: 0=Sun … 6=Sat ; convert to Python style
        const js = d.getDay(); // 0..6
        return (js + 6) % 7;
    } catch {
        return null;
    }
}
function getOpenCloseForWeekday(meta, wd) {
    if (!meta || wd == null) return null;
    if ([0, 1, 2, 3].includes(wd)) {
        return { open: meta.opening_time_mon_to_thu, close: meta.closing_time_mon_to_thu };
    }
    if (wd === 4) return { open: meta.opening_time_friday, close: meta.closing_time_friday };
    if (wd === 5) return { open: meta.opening_time_saturday, close: meta.closing_time_saturday };
    return { open: meta.opening_time_sunday, close: meta.closing_time_sunday };
}
function isOvernight(open, close) {
    return timeToMinutes(close) <= timeToMinutes(open);
}
function timeToMinutes(hhmm) {
    if (!hhmm) return NaN;
    const [h, m] = String(hhmm).split(":").map((x) => Number(x));
    return h * 60 + (m || 0);
}
function isWithinOpening(meta, dateISO, start, end) {
    // approximation front qui imite le back (overnight inclus)
    const wd = weekdayFromISO(dateISO);
    const today = getOpenCloseForWeekday(meta, wd);
    if (!today) return true; // pas bloquant côté front
    const o = timeToMinutes(today.open);
    const c = timeToMinutes(today.close);
    const st = timeToMinutes(start);
    const et = timeToMinutes(end);
    if ([o, c, st, et].some((x) => isNaN(x))) return true;

    if (c > o) {
        // journée normale
        return st >= o && et <= c;
    }
    // overnight (ex: 09:00 → 01:00)
    // on autorise soit dans [open..23:59], soit [00:00..close]
    const inToday = st >= o && et <= (24 * 60 - 1);
    const inPrevSpill = st >= 0 && et <= c;
    return inToday || inPrevSpill;
}

export default function EventForm({ mode }) {
    const { id } = useParams();
    const edit = mode === "edit";
    const activeRestaurantId = useActiveRestaurantId();
    const nav = useNavigate();

    const [loading, setLoading] = useState(false);
    const [apiError, setApiError] = useState(null);
    const [fieldErrors, setFieldErrors] = useState({});

    // meta resto (rooms + horaires)
    const [restaurantMeta, setRestaurantMeta] = useState(null);
    const [rooms, setRooms] = useState([]);
    const [registrationsCount, setRegistrationsCount] = useState(null); // pour hint capacité en edit

    const [form, setForm] = useState({
        restaurant: activeRestaurantId || "",
        title: "",
        description: "",
        type: "ANIMATION",
        date: "",
        start_time: "",
        end_time: "",
        capacity: "",
        is_public: true,
        is_blocking: false,
        room: "",
        rrule: "",
        // --- producteurs ---
        requires_supplier_confirmation: false,
        supplier_deadline_days: 14,
    });

    // sync restaurant id si l’actif change
    useEffect(() => {
        setForm((f) => ({ ...f, restaurant: activeRestaurantId || "" }));
    }, [activeRestaurantId]);

    // charger event si edit
    useEffect(() => {
        if (!edit || !id) return;
        let alive = true;
        setLoading(true);
        setApiError(null);
        setFieldErrors({});
        Promise.all([apiGetEvent(id), apiGetRegistrations(id).catch(() => null)])
            .then(([d, regs]) => {
                if (!alive) return;
                setForm({
                    restaurant: d.restaurant,
                    title: d.title,
                    description: d.description || "",
                    type: d.type,
                    date: d.date,
                    start_time: d.start_time,
                    end_time: d.end_time,
                    capacity: d.capacity ?? "",
                    is_public: d.is_public,
                    is_blocking: d.is_blocking,
                    room: d.room ?? "",
                    rrule: d.rrule || "",
                    requires_supplier_confirmation: !!d.requires_supplier_confirmation,
                    supplier_deadline_days:
                        typeof d.supplier_deadline_days === "number" ? d.supplier_deadline_days : 14,
                });
                if (regs && typeof regs.count === "number") setRegistrationsCount(regs.count);
            })
            .catch((e) => setApiError(e))
            .finally(() => alive && setLoading(false));
        return () => {
            alive = false;
        };
    }, [edit, id]);

    // charger meta (rooms + horaires) quand restaurant change
    useEffect(() => {
        const rid = form.restaurant;
        if (!rid) {
            setRooms([]);
            setRestaurantMeta(null);
            return;
        }
        let alive = true;
        apiGetRestaurant(rid)
            .then((meta) => {
                if (!alive) return;
                setRestaurantMeta(meta || null);
                setRooms(Array.isArray(meta?.rooms) ? meta.rooms : []);
            })
            .catch(() => {
                if (!alive) return;
                setRestaurantMeta(null);
                setRooms([]);
            });
        return () => {
            alive = false;
        };
    }, [form.restaurant]);

    // ouverture/fermeture du jour (hint)
    const openingHint = useMemo(() => {
        if (!restaurantMeta || !form.date) return null;
        const wd = weekdayFromISO(form.date);
        const oc = getOpenCloseForWeekday(restaurantMeta, wd);
        if (!oc) return null;
        const overnight = isOvernight(oc.open, oc.close);
        return {
            text: `Ouvert ${oc.open} → ${oc.close}${overnight ? " (overnight)" : ""}`,
            oc,
            overnight,
        };
    }, [restaurantMeta, form.date]);

    // submit
    const onSubmit = async (e) => {
        e.preventDefault();
        try {
            setApiError(null);
            setFieldErrors({});

            // pré-validation simple horaires (évite un aller-retour)
            if (restaurantMeta && form.date && form.start_time && form.end_time) {
                if (!isWithinOpening(restaurantMeta, form.date, form.start_time, form.end_time)) {
                    throw new Error("Créneau hors horaires d’ouverture du restaurant.");
                }
            }

            // capacité vs inscrits (edit only, côté front)
            if (edit && registrationsCount != null && form.capacity !== "") {
                const cap = Number(form.capacity);
                if (Number.isFinite(cap) && cap < Number(registrationsCount || 0)) {
                    throw new Error(
                        `La capacité (${cap}) ne peut pas être inférieure au nombre d’inscrits actuel (${registrationsCount}).`
                    );
                }
            }

            const payload = {
                restaurant: Number(form.restaurant),
                title: form.title,
                description: form.description,
                type: form.type,
                date: form.date,
                start_time: form.start_time,
                end_time: form.end_time,
                capacity: form.capacity === "" ? null : Number(form.capacity),
                is_public: !!form.is_public,
                is_blocking: !!form.is_blocking,
                room: form.room ? Number(form.room) : null,
                rrule: form.rrule || "",
                requires_supplier_confirmation: !!form.requires_supplier_confirmation,
                supplier_deadline_days: Number(form.supplier_deadline_days || 0),
            };

            if (edit) await apiUpdateEvent(Number(id), payload);
            else await apiCreateEvent(payload);

            nav("/restaurant/events");
        } catch (e) {
            setApiError(e);
            setFieldErrors(extractFieldErrors(e?.data));
        }
    };

    return (
        <div className="p-6 space-y-4">
            <h1 className="text-2xl font-semibold">{edit ? "Éditer l’évènement" : "Créer un évènement"}</h1>

            {/* Banderole globale */}
            {apiError && <ErrorBanner error={apiError} onClose={() => setApiError(null)} />}

            {loading && <Loading />}

            <form
                onSubmit={onSubmit}
                className="bg-white text-black border rounded-2xl p-4 grid md:grid-cols-2 gap-4"
            >
                <div className="md:col-span-2">
                    <FieldError errors={fieldErrors?.non_field_errors} />
                </div>

                {/* Restaurant ID (simple, lié à l'actif) */}
                <Field label="Restaurant ID" hasError={!!fieldErrors?.restaurant}>
                    <input
                        required
                        type="number"
                        className={`border rounded px-2 py-1 w-full ${fieldErrors?.restaurant ? "border-red-500" : ""}`}
                        value={form.restaurant}
                        onChange={(e) => setForm((f) => ({ ...f, restaurant: e.target.value, room: "" }))}
                    />
                    <FieldError errors={fieldErrors?.restaurant} />
                </Field>

                <Field label="Titre" hasError={!!fieldErrors?.title}>
                    <input
                        required
                        className={`border rounded px-2 py-1 w-full ${fieldErrors?.title ? "border-red-500" : ""}`}
                        value={form.title}
                        onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    />
                    <FieldError errors={fieldErrors?.title} />
                </Field>

                <Field label="Type" hasError={!!fieldErrors?.type}>
                    <select
                        className={`border rounded px-2 py-1 w-full ${fieldErrors?.type ? "border-red-500" : ""}`}
                        value={form.type}
                        onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                    >
                        {TYPES.map((t) => (
                            <option key={t} value={t}>
                                {t}
                            </option>
                        ))}
                    </select>
                    <FieldError errors={fieldErrors?.type} />
                </Field>

                <Field label="Date" hasError={!!fieldErrors?.date}>
                    <input
                        required
                        type="date"
                        className={`border rounded px-2 py-1 w-full ${fieldErrors?.date ? "border-red-500" : ""}`}
                        value={form.date}
                        onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                    />
                    <FieldError errors={fieldErrors?.date} />
                </Field>

                <Field label="Début" hasError={!!fieldErrors?.start_time}>
                    <input
                        required
                        type="time"
                        className={`border rounded px-2 py-1 w-full ${fieldErrors?.start_time ? "border-red-500" : ""}`}
                        value={form.start_time}
                        onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
                    />
                    <FieldError errors={fieldErrors?.start_time} />
                </Field>

                <Field label="Fin" hasError={!!fieldErrors?.end_time}>
                    <input
                        required
                        type="time"
                        className={`border rounded px-2 py-1 w-full ${fieldErrors?.end_time ? "border-red-500" : ""}`}
                        value={form.end_time}
                        onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
                    />
                    <FieldError errors={fieldErrors?.end_time} />
                </Field>

                <Field label="Capacité (optionnel)" hasError={!!fieldErrors?.capacity}>
                    <input
                        type="number"
                        min={registrationsCount ?? 0}
                        className={`border rounded px-2 py-1 w-full ${fieldErrors?.capacity ? "border-red-500" : ""}`}
                        value={form.capacity}
                        onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
                    />
                    <FieldError errors={fieldErrors?.capacity} />
                    {edit && registrationsCount != null && (
                        <div className="text-xs opacity-70 mt-1">
                            Inscrits actuels : <b>{registrationsCount}</b>. La capacité ne peut pas être inférieure à ce nombre.
                        </div>
                    )}
                </Field>

                <Field label="Salle (optionnel)" hasError={!!fieldErrors?.room}>
                    <select
                        className={`border rounded px-2 py-1 w-full ${fieldErrors?.room ? "border-red-500" : ""}`}
                        value={form.room || ""}
                        onChange={(e) => setForm((f) => ({ ...f, room: e.target.value }))}
                    >
                        <option value="">— Aucune (évènement général) —</option>
                        {rooms.map((r) => (
                            <option key={r.id} value={r.id}>
                                {r.name} {Number.isFinite(r.capacity) ? `(${r.capacity})` : ""}
                            </option>
                        ))}
                    </select>
                    <FieldError errors={fieldErrors?.room} />
                </Field>

                <Field label="RRULE (optionnel)" hasError={!!fieldErrors?.rrule}>
                    <input
                        className={`border rounded px-2 py-1 w-full ${fieldErrors?.rrule ? "border-red-500" : ""}`}
                        placeholder="ex. FREQ=WEEKLY;BYDAY=TU"
                        value={form.rrule}
                        onChange={(e) => setForm((f) => ({ ...f, rrule: e.target.value }))}
                    />
                    <div className="text-xs opacity-70 mt-1">
                        Exemples : <code>FREQ=WEEKLY;BYDAY=TU</code> (tous les mardis),{" "}
                        <code>FREQ=MONTHLY;BYMONTHDAY=1</code> (chaque 1er du mois)…
                    </div>
                    <FieldError errors={fieldErrors?.rrule} />
                </Field>

                {/* Producteurs */}
                <label className="flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={!!form.requires_supplier_confirmation}
                        onChange={(e) =>
                            setForm((f) => ({ ...f, requires_supplier_confirmation: e.target.checked }))
                        }
                    />
                    Confirmation producteurs requise ?
                </label>

                <Field label="Délai (jours) avant la date (producteurs)" hasError={!!fieldErrors?.supplier_deadline_days}>
                    <input
                        type="number"
                        min={0}
                        className={`border rounded px-2 py-1 w-full ${
                            fieldErrors?.supplier_deadline_days ? "border-red-500" : ""
                        }`}
                        value={form.supplier_deadline_days}
                        onChange={(e) =>
                            setForm((f) => ({ ...f, supplier_deadline_days: Number(e.target.value || 0) }))
                        }
                        disabled={!form.requires_supplier_confirmation}
                    />
                    <FieldError errors={fieldErrors?.supplier_deadline_days} />
                </Field>

                {/* Booleans */}
                <label className="flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={!!form.is_public}
                        onChange={(e) => setForm((f) => ({ ...f, is_public: e.target.checked }))}
                    />
                    Public
                </label>

                <label className="flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={!!form.is_blocking}
                        onChange={(e) => setForm((f) => ({ ...f, is_blocking: e.target.checked }))}
                    />
                    Bloquant (bloque les réservations sur ce créneau)
                </label>

                {/* Description */}
                <Field label="Description" full hasError={!!fieldErrors?.description}>
          <textarea
              rows={4}
              className={`border rounded px-2 py-1 w-full ${fieldErrors?.description ? "border-red-500" : ""}`}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
                    <FieldError errors={fieldErrors?.description} />
                </Field>

                {/* Hints et avertissements */}
                {openingHint && (
                    <div className="md:col-span-2 text-xs px-3 py-2 rounded bg-slate-100 text-slate-700">
                        {openingHint.text}
                    </div>
                )}
                {form.is_blocking && (
                    <div className="md:col-span-2 text-xs px-3 py-2 rounded bg-amber-100 text-amber-700">
                        Attention : deux évènements <b>bloquants</b> ne peuvent pas se chevaucher (même salle, ou global si
                        aucune salle n’est choisie).
                    </div>
                )}

                <div className="md:col-span-2 flex gap-2">
                    <button className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500">Enregistrer</button>
                    <button type="button" onClick={() => nav(-1)} className="px-3 py-2 rounded border">
                        Annuler
                    </button>
                </div>
            </form>
        </div>
    );
}

function Field({ label, children, full, hasError }) {
    return (
        <label className={`text-sm ${full ? "md:col-span-2" : ""}`}>
            <div className={`mb-1 ${hasError ? "text-red-700" : "opacity-70"}`}>{label}</div>
            {children}
        </label>
    );
}
