// src/components/restaurant/pages/events/EventForm.jsx
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import useActiveRestaurantId from "../../hooks/useActiveRestaurantId";
import { apiCreateEvent, apiGetEvent, apiUpdateEvent, apiGetRestaurant } from "../../api";

function Loading(){return <div className="p-4 text-sm opacity-70">Chargement…</div>;}
function ErrorBanner({error, onClose}) {
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
                {msgs.map((m, i) => <li key={i}>{m}</li>)}
            </ul>
        </div>
    );
}

// --- Helpers erreurs ---
// 1) Banderole globale (détaillée)
function extractApiErrors(error) {
    const out = [];
    if (!error) return out;

    if (typeof error === "string") return [error];

    const data = error?.data;

    if (typeof data === "string" && data.trim()) out.push(data.trim());
    if (Array.isArray(data)) data.forEach(v => out.push(typeof v === "string" ? v : JSON.stringify(v)));

    if (data && typeof data === "object" && !Array.isArray(data)) {
        const push = (label, val) => {
            if (val == null) return;
            if (Array.isArray(val)) {
                val.forEach(v => out.push(label ? `${label}: ${typeof v === "string" ? v : JSON.stringify(v)}` : String(v)));
            } else if (typeof val === "object") {
                try { out.push(label ? `${label}: ${JSON.stringify(val)}` : JSON.stringify(val)); }
                catch { out.push(label ? `${label}: ${String(val)}` : String(val)); }
            } else {
                out.push(label ? `${label}: ${String(val)}` : String(val));
            }
        };
        if (data.detail) push("", data.detail);
        if (data.error) push("", data.error);
        if (data.non_field_errors) push("", data.non_field_errors);
        Object.entries(data).forEach(([k,v])=>{
            if (["detail","error","non_field_errors"].includes(k)) return;
            push(k, v);
        });
    }

    if (!out.length && error?.message) out.push(String(error.message));
    if (!out.length) out.push(String(error));
    return out;
}

// 2) Erreurs par champ pour affichage inline
function extractFieldErrors(data) {
    const out = {};
    if (!data || typeof data !== "object") return out;
    Object.entries(data).forEach(([k, v]) => {
        if (k === "detail" || k === "error" || k === "non_field_errors") return;
        if (Array.isArray(v)) out[k] = v.map(x => (typeof x === "string" ? x : JSON.stringify(x)));
        else if (typeof v === "string") out[k] = [v];
        else if (v != null) out[k] = [JSON.stringify(v)];
    });
    // On garde aussi non_field_errors pour le haut du formulaire si besoin
    if (Array.isArray(data?.non_field_errors)) out.non_field_errors = data.non_field_errors.map(String);
    else if (typeof data?.non_field_errors === "string") out.non_field_errors = [data.non_field_errors];
    return out;
}

function FieldError({ errors }) {
    if (!errors || !errors.length) return null;
    return (
        <div className="mt-1 text-xs text-red-600">
            {errors.map((e,i)=><div key={i}>• {e}</div>)}
        </div>
    );
}

const TYPES = ["ANNIVERSAIRE","CONFERENCE","SEMINAIRE","ANIMATION","AUTRE"];

export default function EventForm({ mode }){
    const { id } = useParams();
    const edit = mode === "edit";
    const activeRestaurantId = useActiveRestaurantId();
    const nav = useNavigate();

    const [loading,setLoading]=useState(false);
    const [apiError,setApiError]=useState(null);
    const [fieldErrors, setFieldErrors] = useState({});

    // Liste des salles du restaurant sélectionné
    const [rooms, setRooms] = useState([]);

    const [form,setForm] = useState({
        restaurant: activeRestaurantId || "",
        title: "", description: "", type: "ANIMATION",
        date: "", start_time: "", end_time: "",
        capacity: "", is_public: true, is_blocking: false, room: "", rrule: "",
    });

    // Quand l’ID du restaurant actif change (création)
    useEffect(()=>{
        setForm((f)=>({ ...f, restaurant: activeRestaurantId || "" }));
    },[activeRestaurantId]);

    // Charger l’évènement en édition
    useEffect(()=>{
        if(!edit || !id) return;
        let alive=true;
        setLoading(true); setApiError(null); setFieldErrors({});
        apiGetEvent(id)
            .then((d)=> alive && setForm({
                restaurant: d.restaurant,
                title: d.title, description: d.description || "", type: d.type,
                date: d.date, start_time: d.start_time, end_time: d.end_time,
                capacity: d.capacity ?? "", is_public: d.is_public, is_blocking: d.is_blocking,
                room: d.room ?? "", rrule: d.rrule || "",
            }))
            .catch((e)=> alive && setApiError(e))
            .finally(()=> alive && setLoading(false));
        return ()=>{alive=false};
    },[edit,id]);

    // Charger les salles dès qu’on connaît le restaurant (création ET édition)
    useEffect(()=>{
        const rid = form.restaurant;
        if(!rid){ setRooms([]); return; }
        let alive = true;
        apiGetRestaurant(rid)
            .then(meta => { if(!alive) return;
                setRooms(Array.isArray(meta?.rooms) ? meta.rooms : []);
            })
            .catch((e)=>{ if(!alive) return; setRooms([]); /* erreurs “meta” pas critiques */ });
        return ()=>{ alive = false; };
    },[form.restaurant]);

    const onSubmit = async (e)=>{
        e.preventDefault();
        const payload = {
            ...form,
            restaurant: Number(form.restaurant),
            capacity: form.capacity === "" ? null : Number(form.capacity),
            room: form.room ? Number(form.room) : null,  // id num ou null
        };
        try{
            setApiError(null);
            setFieldErrors({});
            if (edit) await apiUpdateEvent(Number(id), payload);
            else await apiCreateEvent(payload);
            nav("/restaurant/events");
        }catch(e){
            // On stocke l’objet complet pour la bannière globale…
            setApiError(e);
            // …et on isole les erreurs par champ pour l’affichage inline
            setFieldErrors(extractFieldErrors(e?.data));
        }
    };

    return (
        <div className="p-6 space-y-4">
            <h1 className="text-2xl font-semibold">{edit ? "Éditer l’évènement" : "Créer un évènement"}</h1>

            {/* Banderole globale avec toutes les erreurs de l’API */}
            {apiError && <ErrorBanner error={apiError} onClose={()=> setApiError(null)} />}

            {loading && <Loading/>}

            <form onSubmit={onSubmit} className="bg-white text-black border rounded-2xl p-4 grid md:grid-cols-2 gap-4">
                {/* Si l'API renvoie non_field_errors, on les met en haut du formulaire */}
                <div className="md:col-span-2">
                    <FieldError errors={fieldErrors?.non_field_errors} />
                </div>

                {/* Restaurant (ID). Si tu veux, remplace par un select plus tard. */}
                <Field label="Restaurant ID" hasError={!!fieldErrors?.restaurant}>
                    <input
                        required
                        type="number"
                        className={`border rounded px-2 py-1 w-full ${fieldErrors?.restaurant ? "border-red-500" : ""}`}
                        value={form.restaurant}
                        onChange={(e)=> setForm(f=>({...f, restaurant: e.target.value, room: "" }))}
                    />
                    <FieldError errors={fieldErrors?.restaurant} />
                </Field>

                <Field label="Titre" hasError={!!fieldErrors?.title}>
                    <input
                        required
                        className={`border rounded px-2 py-1 w-full ${fieldErrors?.title ? "border-red-500" : ""}`}
                        value={form.title}
                        onChange={(e)=> setForm(f=>({...f, title: e.target.value}))}
                    />
                    <FieldError errors={fieldErrors?.title} />
                </Field>

                <Field label="Type" hasError={!!fieldErrors?.type}>
                    <select
                        className={`border rounded px-2 py-1 w-full ${fieldErrors?.type ? "border-red-500" : ""}`}
                        value={form.type}
                        onChange={(e)=> setForm(f=>({...f, type: e.target.value}))}
                    >
                        {TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                    </select>
                    <FieldError errors={fieldErrors?.type} />
                </Field>

                <Field label="Date" hasError={!!fieldErrors?.date}>
                    <input
                        required
                        type="date"
                        className={`border rounded px-2 py-1 w-full ${fieldErrors?.date ? "border-red-500" : ""}`}
                        value={form.date}
                        onChange={(e)=> setForm(f=>({...f, date: e.target.value}))}
                    />
                    <FieldError errors={fieldErrors?.date} />
                </Field>

                <Field label="Début" hasError={!!fieldErrors?.start_time}>
                    <input
                        required
                        type="time"
                        className={`border rounded px-2 py-1 w-full ${fieldErrors?.start_time ? "border-red-500" : ""}`}
                        value={form.start_time}
                        onChange={(e)=> setForm(f=>({...f, start_time: e.target.value}))}
                    />
                    <FieldError errors={fieldErrors?.start_time} />
                </Field>

                <Field label="Fin" hasError={!!fieldErrors?.end_time}>
                    <input
                        required
                        type="time"
                        className={`border rounded px-2 py-1 w-full ${fieldErrors?.end_time ? "border-red-500" : ""}`}
                        value={form.end_time}
                        onChange={(e)=> setForm(f=>({...f, end_time: e.target.value}))}
                    />
                    <FieldError errors={fieldErrors?.end_time} />
                </Field>

                <Field label="Capacité (optionnel)" hasError={!!fieldErrors?.capacity}>
                    <input
                        type="number"
                        className={`border rounded px-2 py-1 w-full ${fieldErrors?.capacity ? "border-red-500" : ""}`}
                        value={form.capacity}
                        onChange={(e)=> setForm(f=>({...f, capacity: e.target.value}))}
                    />
                    <FieldError errors={fieldErrors?.capacity} />
                </Field>

                {/* Select sur les noms des salles */}
                <Field label="Salle (optionnel)" hasError={!!fieldErrors?.room}>
                    <select
                        className={`border rounded px-2 py-1 w-full ${fieldErrors?.room ? "border-red-500" : ""}`}
                        value={form.room || ""}
                        onChange={(e)=> setForm(f=>({...f, room: e.target.value}))}
                    >
                        <option value="">— Aucune (évènement général) —</option>
                        {rooms.map(r => (
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
                        onChange={(e)=> setForm(f=>({...f, rrule: e.target.value}))}
                    />
                    <FieldError errors={fieldErrors?.rrule} />
                </Field>

                <label className="flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={!!form.is_public}
                        onChange={(e)=> setForm(f=>({...f, is_public: e.target.checked}))}
                    />
                    Public
                </label>

                <label className="flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={!!form.is_blocking}
                        onChange={(e)=> setForm(f=>({...f, is_blocking: e.target.checked}))}
                    />
                    Bloquant (bloque les réservations)
                </label>

                <Field label="Description" full hasError={!!fieldErrors?.description}>
          <textarea
              rows={4}
              className={`border rounded px-2 py-1 w-full ${fieldErrors?.description ? "border-red-500" : ""}`}
              value={form.description}
              onChange={(e)=> setForm(f=>({...f, description: e.target.value}))}
          />
                    <FieldError errors={fieldErrors?.description} />
                </Field>

                <div className="md:col-span-2 flex gap-2">
                    <button className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500">Enregistrer</button>
                    <button type="button" onClick={()=> nav(-1)} className="px-3 py-2 rounded border">Annuler</button>
                </div>
            </form>
        </div>
    );
}

function Field({label, children, full, hasError}){
    return (
        <label className={`text-sm ${full ? "md:col-span-2" : ""}`}>
            <div className={`mb-1 ${hasError ? "text-red-700" : "opacity-70"}`}>{label}</div>
            {children}
        </label>
    );
}
