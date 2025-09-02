// src/components/restaurant/pages/settings/RestaurantSettings.jsx
import { useEffect, useState } from "react";
import useActiveRestaurantId from "../../hooks/useActiveRestaurantId";
import { apiGetRestaurant, apiUpdateRestaurant } from "../../api";

function Loading(){return <div className="p-4 text-sm opacity-70">Chargement…</div>;}
function ErrorMsg({error}){return <div className="p-3 bg-red-600/10 text-red-400 rounded">{String(error)}</div>;}

export default function RestaurantSettings(){
    const restaurantId = useActiveRestaurantId();
    const [loading,setLoading]=useState(false);
    const [saving,setSaving]=useState(false);
    const [err,setErr]=useState(null);
    const [info,setInfo]=useState("");
    const [f,setF] = useState({
        name:"", address:"", city:"", postal_code:"", capacity:"",
        wifi_available:true, printer_available:true,
        member_trays_available:false, delivery_trays_available:false,
        animations_enabled:false, animation_day:"",
    });

    const load = ()=>{
        if(!restaurantId) return;
        setLoading(true); setErr(null); setInfo("");
        apiGetRestaurant(restaurantId)
            .then(d=> setF({
                name:d.name||"", address:d.address||"", city:d.city||"", postal_code:d.postal_code||"",
                capacity:d.capacity ?? "", wifi_available:!!d.wifi_available, printer_available:!!d.printer_available,
                member_trays_available:!!d.member_trays_available, delivery_trays_available:!!d.delivery_trays_available,
                animations_enabled:!!d.animations_enabled, animation_day:d.animation_day || "",
            }))
            .catch(e=> setErr(e.message))
            .finally(()=> setLoading(false));
    };

    useEffect(()=>{ load(); /* eslint-disable-next-line */ },[restaurantId]);

    const onSave = async (e)=>{
        e.preventDefault();
        setSaving(true); setErr(null); setInfo("");
        try{
            await apiUpdateRestaurant(restaurantId, {
                ...f,
                capacity: Number(f.capacity || 0),
                animation_day: f.animation_day || null,
            }, true);
            setInfo("Enregistré.");
        }catch(e){ setErr(e.message); }
        finally{ setSaving(false); }
    };

    return (
        <div className="p-6 space-y-4">
            <h1 className="text-2xl font-semibold">Paramètres du restaurant</h1>
            {!restaurantId && <ErrorMsg error={"Sélectionne un restaurant."}/>}
            {err && <ErrorMsg error={err}/>}
            {loading && <Loading/>}

            <form onSubmit={onSave} className="bg-white text-black border rounded-2xl p-4 grid md:grid-cols-2 gap-4">
                <Field label="Nom">
                    <input className="border rounded px-2 py-1 w-full" value={f.name} onChange={(e)=> setF(v=>({...v,name:e.target.value}))}/>
                </Field>
                <Field label="Capacité">
                    <input type="number" className="border rounded px-2 py-1 w-full" value={f.capacity} onChange={(e)=> setF(v=>({...v,capacity:e.target.value}))}/>
                </Field>
                <Field label="Adresse" full>
                    <input className="border rounded px-2 py-1 w-full" value={f.address} onChange={(e)=> setF(v=>({...v,address:e.target.value}))}/>
                </Field>
                <Field label="Ville">
                    <input className="border rounded px-2 py-1 w-full" value={f.city} onChange={(e)=> setF(v=>({...v,city:e.target.value}))}/>
                </Field>
                <Field label="Code postal">
                    <input className="border rounded px-2 py-1 w-full" value={f.postal_code} onChange={(e)=> setF(v=>({...v,postal_code:e.target.value}))}/>
                </Field>

                <div className="md:col-span-2 grid md:grid-cols-2 gap-3">
                    <Toggle label="Wi-Fi" v={f.wifi_available} onChange={(v)=> setF(s=>({...s,wifi_available:v}))}/>
                    <Toggle label="Imprimante" v={f.printer_available} onChange={(v)=> setF(s=>({...s,printer_available:v}))}/>
                    <Toggle label="Plateaux membres" v={f.member_trays_available} onChange={(v)=> setF(s=>({...s,member_trays_available:v}))}/>
                    <Toggle label="Plateaux livrables" v={f.delivery_trays_available} onChange={(v)=> setF(s=>({...s,delivery_trays_available:v}))}/>
                    <Toggle label="Animations" v={f.animations_enabled} onChange={(v)=> setF(s=>({...s,animations_enabled:v}))}/>
                    <Field label="Jour des animations">
                        <input className="border rounded px-2 py-1 w-full" value={f.animation_day ?? ""} onChange={(e)=> setF(v=>({...v,animation_day:e.target.value}))}/>
                    </Field>
                </div>

                <div className="md:col-span-2 flex gap-2">
                    <button disabled={saving} className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50">
                        {saving ? "Enregistrement…" : "Enregistrer"}
                    </button>
                    <button type="button" className="px-3 py-2 rounded border" onClick={load}>Annuler</button>
                    {info && <span className="text-emerald-400">{info}</span>}
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
function Toggle({label,v,onChange}){
    return (
        <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!v} onChange={(e)=> onChange(e.target.checked)} />
            {label}
        </label>
    );
}
