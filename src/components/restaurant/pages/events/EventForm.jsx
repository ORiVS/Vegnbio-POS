// src/components/restaurant/pages/events/EventForm.jsx
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import useActiveRestaurantId from "../../hooks/useActiveRestaurantId";
import { apiCreateEvent, apiGetEvent, apiUpdateEvent } from "../../api";

function Loading(){return <div className="p-4 text-sm opacity-70">Chargement…</div>;}
function ErrorMsg({error}){return <div className="p-3 bg-red-600/10 text-red-400 rounded">{String(error)}</div>;}

const TYPES = ["ANNIVERSAIRE","CONFERENCE","SEMINAIRE","ANIMATION","AUTRE"];

export default function EventForm({ mode }){
    const { id } = useParams();
    const edit = mode === "edit";
    const restaurantId = useActiveRestaurantId();
    const nav = useNavigate();

    const [loading,setLoading]=useState(false);
    const [err,setErr]=useState(null);
    const [form,setForm] = useState({
        restaurant: restaurantId || "",
        title: "", description: "", type: "ANIMATION",
        date: "", start_time: "", end_time: "",
        capacity: "", is_public: true, is_blocking: false, room: "", rrule: "",
    });

    useEffect(()=>{
        setForm((f)=>({...f, restaurant: restaurantId || ""}));
    },[restaurantId]);

    useEffect(()=>{
        if(!edit || !id) return;
        let alive=true;
        setLoading(true); setErr(null);
        apiGetEvent(id)
            .then((d)=> alive && setForm({
                restaurant: d.restaurant,
                title: d.title, description: d.description || "", type: d.type,
                date: d.date, start_time: d.start_time, end_time: d.end_time,
                capacity: d.capacity ?? "", is_public: d.is_public, is_blocking: d.is_blocking,
                room: d.room ?? "", rrule: d.rrule || "",
            }))
            .catch((e)=> alive && setErr(e.message))
            .finally(()=> alive && setLoading(false));
        return ()=>{alive=false};
    },[edit,id]);

    const onSubmit = async (e)=>{
        e.preventDefault();
        const payload = {
            ...form,
            restaurant: Number(form.restaurant),
            capacity: form.capacity === "" ? null : Number(form.capacity),
            room: form.room ? Number(form.room) : null,
        };
        try{
            if (edit) await apiUpdateEvent(Number(id), payload);
            else await apiCreateEvent(payload);
            nav("/restaurant/events");
        }catch(e){ setErr(e.message); }
    };

    return (
        <div className="p-6 space-y-4">
            <h1 className="text-2xl font-semibold">{edit ? "Éditer l’évènement" : "Créer un évènement"}</h1>
            {err && <ErrorMsg error={err}/>}
            {loading && <Loading/>}

            <form onSubmit={onSubmit} className="bg-white text-black border rounded-2xl p-4 grid md:grid-cols-2 gap-4">
                <Field label="Restaurant ID">
                    <input required type="number" className="border rounded px-2 py-1 w-full"
                           value={form.restaurant} onChange={(e)=> setForm(f=>({...f, restaurant: e.target.value}))}/>
                </Field>
                <Field label="Titre">
                    <input required className="border rounded px-2 py-1 w-full"
                           value={form.title} onChange={(e)=> setForm(f=>({...f, title: e.target.value}))}/>
                </Field>
                <Field label="Type">
                    <select className="border rounded px-2 py-1 w-full" value={form.type}
                            onChange={(e)=> setForm(f=>({...f, type: e.target.value}))}>
                        {TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                    </select>
                </Field>
                <Field label="Date">
                    <input required type="date" className="border rounded px-2 py-1 w-full"
                           value={form.date} onChange={(e)=> setForm(f=>({...f, date: e.target.value}))}/>
                </Field>
                <Field label="Début">
                    <input required type="time" className="border rounded px-2 py-1 w-full"
                           value={form.start_time} onChange={(e)=> setForm(f=>({...f, start_time: e.target.value}))}/>
                </Field>
                <Field label="Fin">
                    <input required type="time" className="border rounded px-2 py-1 w-full"
                           value={form.end_time} onChange={(e)=> setForm(f=>({...f, end_time: e.target.value}))}/>
                </Field>
                <Field label="Capacité (optionnel)">
                    <input type="number" className="border rounded px-2 py-1 w-full"
                           value={form.capacity} onChange={(e)=> setForm(f=>({...f, capacity: e.target.value}))}/>
                </Field>
                <Field label="Salle (room id — optionnel)">
                    <input type="number" className="border rounded px-2 py-1 w-full"
                           value={form.room} onChange={(e)=> setForm(f=>({...f, room: e.target.value}))}/>
                </Field>
                <Field label="RRULE (optionnel)">
                    <input className="border rounded px-2 py-1 w-full"
                           placeholder="FREQ=WEEKLY;BYDAY=TU"
                           value={form.rrule} onChange={(e)=> setForm(f=>({...f, rrule: e.target.value}))}/>
                </Field>

                <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!!form.is_public}
                           onChange={(e)=> setForm(f=>({...f, is_public: e.target.checked}))}/>
                    Public
                </label>
                <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!!form.is_blocking}
                           onChange={(e)=> setForm(f=>({...f, is_blocking: e.target.checked}))}/>
                    Bloquant (bloque les réservations)
                </label>

                <Field label="Description" full>
          <textarea rows={4} className="border rounded px-2 py-1 w-full"
                    value={form.description} onChange={(e)=> setForm(f=>({...f, description: e.target.value}))}/>
                </Field>

                <div className="md:col-span-2 flex gap-2">
                    <button className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500">Enregistrer</button>
                    <button type="button" onClick={()=> nav(-1)} className="px-3 py-2 rounded border">Annuler</button>
                </div>
            </form>
        </div>
    );
}

function Field({label, children, full}){
    return (
        <label className={`text-sm ${full ? "md:col-span-2" : ""}`}>
            <div className="opacity-70 mb-1">{label}</div>
            {children}
        </label>
    );
}
