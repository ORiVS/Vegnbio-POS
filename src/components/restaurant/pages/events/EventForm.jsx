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

/* ---------- RRULE helper (simple, sans lib externe) ---------- */
const WEEKDAYS = [
    { key: "MO", label: "Lun" },
    { key: "TU", label: "Mar" },
    { key: "WE", label: "Mer" },
    { key: "TH", label: "Jeu" },
    { key: "FR", label: "Ven" },
    { key: "SA", label: "Sam" },
    { key: "SU", label: "Dim" },
];

function buildRRule({ freq, interval = 1, byday = [], bymonthday = "", until = "", count = "" }) {
    if (!freq) return "";
    const parts = [`FREQ=${freq}`];

    const nInterval = Number(interval || 1);
    if (Number.isFinite(nInterval) && nInterval > 1) parts.push(`INTERVAL=${nInterval}`);

    if (freq === "WEEKLY" && byday.length) parts.push(`BYDAY=${byday.join(",")}`);
    if (freq === "MONTHLY" && bymonthday) parts.push(`BYMONTHDAY=${bymonthday}`);

    // fin : soit COUNT, soit UNTIL (YYYYMMDD)
    const c = Number(count || 0);
    if (Number.isFinite(c) && c > 0) {
        parts.push(`COUNT=${c}`);
    } else if (until) {
        try {
            const d = new Date(until);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, "0");
            const day = String(d.getDate()).padStart(2, "0");
            parts.push(`UNTIL=${y}${m}${day}`);
        } catch {
            // ignore si invalide
        }
    }

    return parts.join(";");
}

function humanizeRRule({ freq, interval = 1, byday = [], bymonthday = "", until = "", count = "" }) {
    if (!freq) return "Aucune récurrence.";
    const EVERY = interval && Number(interval) > 1 ? `toutes les ${interval} ` : "chaque ";

    if (freq === "WEEKLY") {
        const days = byday.length
            ? byday
                .map((d) => {
                    const f = WEEKDAYS.find((w) => w.key === d);
                    return f ? f.label : d;
                })
                .join(", ")
            : "jour (non précisé)";
        return `${EVERY}semaine${Number(interval) > 1 ? "s" : ""}${byday.length ? `, ${days}` : ""}${_endClause(until, count)}`;
    }
    if (freq === "MONTHLY") {
        const d = bymonthday ? `le ${bymonthday}` : "jour (non précisé)";
        return `${EVERY}mois, ${d}${_endClause(until, count)}`;
    }
    if (freq === "DAILY") {
        return `${EVERY}jour${Number(interval) > 1 ? "s" : ""}${_endClause(until, count)}`;
    }
    if (freq === "YEARLY") {
        return `${EVERY}an${Number(interval) > 1 ? "s" : ""}${_endClause(until, count)}`;
    }
    return "Récurrence personnalisée.";
}
function _endClause(until, count) {
    if (count && Number(count) > 0) return `, ${count} occurrence${Number(count) > 1 ? "s" : ""}`;
    if (until) return `, jusqu’au ${_formatFR(until)}`;
    return "";
}
function _formatFR(iso) {
    try {
        const d = new Date(iso);
        return d.toLocaleDateString("fr-FR", { year: "numeric", month: "2-digit", day: "2-digit" });
    } catch {
        return iso;
    }
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

    // Assistant de récurrence (UI -> RRULE)
    const [rruleUI, setRruleUI] = useState({
        enabled: false,
        freq: "", // "", "DAILY", "WEEKLY", "MONTHLY", "YEARLY"
        interval: 1,
        byday: [], // ["MO","WE"] si weekly
        bymonthday: "", // "1".."31" si monthly
        until: "", // "YYYY-MM-DD"
        count: "", // nombre d’occurrences
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

                // essaie d’hydrater l’assistant depuis une RRULE existante (lecture simple)
                try {
                    const r = (d.rrule || "").split(";").reduce((acc, part) => {
                        const [k, v] = part.split("=");
                        if (!k || !v) return acc;
                        acc[k.trim().toUpperCase()] = v.trim();
                        return acc;
                    }, {});
                    const ui = {
                        enabled: !!d.rrule,
                        freq: r.FREQ || "",
                        interval: r.INTERVAL ? Number(r.INTERVAL) : 1,
                        byday: r.BYDAY ? r.BYDAY.split(",") : [],
                        bymonthday: r.BYMONTHDAY || "",
                        until: r.UNTIL ? `${r.UNTIL.slice(0, 4)}-${r.UNTIL.slice(4, 6)}-${r.UNTIL.slice(6, 8)}` : "",
                        count: r.COUNT || "",
                    };
                    setRruleUI(ui);
                } catch {
                    // ignore si parsing rrule échoue
                }

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

                {/* ---------- RRULE (optionnel) + Assistant visuel ---------- */}
                <div className="md:col-span-2">
                    <div className="flex items-center justify-between">
                        <label className={`text-sm ${fieldErrors?.rrule ? "text-red-700" : "opacity-70"}`}>
                            RRULE (optionnel)
                        </label>
                        <label className="text-sm flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={!!rruleUI.enabled}
                                onChange={(e) => {
                                    const enabled = e.target.checked;
                                    setRruleUI((u) => ({ ...u, enabled }));
                                    if (!enabled) return;
                                    setRruleUI((u) => ({
                                        ...u,
                                        freq: u.freq || "WEEKLY",
                                        interval: u.interval || 1,
                                    }));
                                }}
                            />
                            Assistant de récurrence
                        </label>
                    </div>

                    {/* Champ texte RRULE (toujours éditable) */}
                    <input
                        className={`border rounded px-2 py-1 w-full mt-1 ${fieldErrors?.rrule ? "border-red-500" : ""}`}
                        placeholder="ex. FREQ=WEEKLY;BYDAY=TU"
                        value={form.rrule}
                        onChange={(e) => {
                            const value = e.target.value;
                            setForm((f) => ({ ...f, rrule: value }));
                        }}
                    />
                    <FieldError errors={fieldErrors?.rrule} />

                    {/* Assistant visuel */}
                    {rruleUI.enabled && (
                        <div className="mt-3 p-3 border rounded-xl bg-slate-50 space-y-3">
                            {/* Fréquence + intervalle + fin */}
                            <div className="grid md:grid-cols-3 gap-3">
                                <label className="text-sm">
                                    <div className="opacity-70 mb-1">Fréquence</div>
                                    <select
                                        className="border rounded px-2 py-1 w-full"
                                        value={rruleUI.freq}
                                        onChange={(e) =>
                                            setRruleUI((u) => {
                                                const next = { ...u, freq: e.target.value };
                                                // reset champs spécifiques
                                                if (e.target.value !== "WEEKLY") next.byday = [];
                                                if (e.target.value !== "MONTHLY") next.bymonthday = "";
                                                const r = buildRRule(next);
                                                setForm((f) => ({ ...f, rrule: r }));
                                                return next;
                                            })
                                        }
                                    >
                                        <option value="">—</option>
                                        <option value="DAILY">Quotidienne</option>
                                        <option value="WEEKLY">Hebdomadaire</option>
                                        <option value="MONTHLY">Mensuelle</option>
                                        <option value="YEARLY">Annuelle</option>
                                    </select>
                                </label>

                                <label className="text-sm">
                                    <div className="opacity-70 mb-1">Intervalle</div>
                                    <input
                                        type="number"
                                        min={1}
                                        className="border rounded px-2 py-1 w-full"
                                        value={rruleUI.interval}
                                        onChange={(e) =>
                                            setRruleUI((u) => {
                                                const next = { ...u, interval: Number(e.target.value || 1) };
                                                const r = buildRRule(next);
                                                setForm((f) => ({ ...f, rrule: r }));
                                                return next;
                                            })
                                        }
                                    />
                                </label>

                                <div className="text-sm">
                                    <div className="opacity-70 mb-1">Fin (au choix)</div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <input
                                            type="date"
                                            className="border rounded px-2 py-1 w-full"
                                            value={rruleUI.until}
                                            onChange={(e) =>
                                                setRruleUI((u) => {
                                                    const next = { ...u, until: e.target.value, count: "" };
                                                    const r = buildRRule(next);
                                                    setForm((f) => ({ ...f, rrule: r }));
                                                    return next;
                                                })
                                            }
                                        />
                                        <input
                                            type="number"
                                            min={1}
                                            placeholder="Count"
                                            className="border rounded px-2 py-1 w-full"
                                            value={rruleUI.count}
                                            onChange={(e) =>
                                                setRruleUI((u) => {
                                                    const next = { ...u, count: e.target.value, until: "" };
                                                    const r = buildRRule(next);
                                                    setForm((f) => ({ ...f, rrule: r }));
                                                    return next;
                                                })
                                            }
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Jours (si WEEKLY) */}
                            {rruleUI.freq === "WEEKLY" && (
                                <div className="text-sm">
                                    <div className="opacity-70 mb-1">Jours</div>
                                    <div className="flex flex-wrap gap-2">
                                        {WEEKDAYS.map((d) => {
                                            const active = rruleUI.byday.includes(d.key);
                                            return (
                                                <button
                                                    type="button"
                                                    key={d.key}
                                                    onClick={() =>
                                                        setRruleUI((u) => {
                                                            const set = new Set(u.byday);
                                                            if (set.has(d.key)) set.delete(d.key);
                                                            else set.add(d.key);
                                                            const next = { ...u, byday: Array.from(set) };
                                                            const r = buildRRule(next);
                                                            setForm((f) => ({ ...f, rrule: r }));
                                                            return next;
                                                        })
                                                    }
                                                    className={`px-3 py-1 rounded-full border text-xs ${
                                                        active ? "bg-emerald-100 border-emerald-300" : "bg-white"
                                                    }`}
                                                >
                                                    {d.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Jour du mois (si MONTHLY) */}
                            {rruleUI.freq === "MONTHLY" && (
                                <label className="text-sm">
                                    <div className="opacity-70 mb-1">Jour du mois</div>
                                    <input
                                        type="number"
                                        min={1}
                                        max={31}
                                        className="border rounded px-2 py-1 w-full"
                                        value={rruleUI.bymonthday}
                                        onChange={(e) =>
                                            setRruleUI((u) => {
                                                const v = e.target.value;
                                                const next = { ...u, bymonthday: v };
                                                const r = buildRRule(next);
                                                setForm((f) => ({ ...f, rrule: r }));
                                                return next;
                                            })
                                        }
                                    />
                                </label>
                            )}

                            {/* Résumé humain */}
                            <div className="text-xs px-3 py-2 rounded bg-white border">
                                {humanizeRRule(rruleUI.freq ? rruleUI : { freq: "", interval: 1 })}
                            </div>

                            {/* Presets rapides */}
                            <div className="flex flex-wrap gap-2">
                                <PresetButton
                                    label="Chaque mardi"
                                    r={{ freq: "WEEKLY", interval: 1, byday: ["TU"], until: "", count: "" }}
                                    apply={(r) => {
                                        setRruleUI((u) => ({ ...u, enabled: true, ...r }));
                                        setForm((f) => ({ ...f, rrule: buildRRule(r) }));
                                    }}
                                />
                                <PresetButton
                                    label="Tous les 1ers du mois"
                                    r={{ freq: "MONTHLY", interval: 1, bymonthday: "1", until: "", count: "" }}
                                    apply={(r) => {
                                        setRruleUI((u) => ({ ...u, enabled: true, ...r }));
                                        setForm((f) => ({ ...f, rrule: buildRRule(r) }));
                                    }}
                                />
                                <PresetButton
                                    label="Quotidien (10 fois)"
                                    r={{ freq: "DAILY", interval: 1, count: "10", until: "" }}
                                    apply={(r) => {
                                        setRruleUI((u) => ({ ...u, enabled: true, ...r }));
                                        setForm((f) => ({ ...f, rrule: buildRRule(r) }));
                                    }}
                                />
                            </div>
                        </div>
                    )}
                </div>

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

function PresetButton({ label, r, apply }) {
    return (
        <button
            type="button"
            onClick={() => apply(r)}
            className="text-xs px-3 py-1 rounded border hover:bg-slate-100"
            title="Appliquer un exemple de récurrence"
        >
            {label}
        </button>
    );
}
