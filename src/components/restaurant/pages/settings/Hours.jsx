// src/components/restaurant/pages/settings/Hours.jsx
import { useEffect, useState } from "react";
import useActiveRestaurantId from "../../hooks/useActiveRestaurantId";
import { apiGetRestaurant, apiUpdateRestaurant } from "../../api";

function Loading(){return <div className="p-4 text-sm opacity-70">Chargement…</div>;}
function ErrorMsg({error}){return <div className="p-3 bg-red-600/10 text-red-400 rounded">{String(error)}</div>;}

export default function Hours(){
    const restaurantId = useActiveRestaurantId();
    const [loading,setLoading]=useState(false);
    const [saving,setSaving]=useState(false);
    const [err,setErr]=useState(null);
    const [info,setInfo]=useState("");
    const [f,setF] = useState({
        opening_time_mon_to_thu:"09:00", closing_time_mon_to_thu:"23:59",
        opening_time_friday:"09:00", closing_time_friday:"01:00",
        opening_time_saturday:"09:00", closing_time_saturday:"05:00",
        opening_time_sunday:"11:00", closing_time_sunday:"23:59",
    });

    const load = ()=>{
        if(!restaurantId) return;
        setLoading(true); setErr(null);
        apiGetRestaurant(restaurantId)
            .then(d=> setF({
                opening_time_mon_to_thu: d.opening_time_mon_to_thu?.slice(0,5),
                closing_time_mon_to_thu: d.closing_time_mon_to_thu?.slice(0,5),
                opening_time_friday: d.opening_time_friday?.slice(0,5),
                closing_time_friday: d.closing_time_friday?.slice(0,5),
                opening_time_saturday: d.opening_time_saturday?.slice(0,5),
                closing_time_saturday: d.closing_time_saturday?.slice(0,5),
                opening_time_sunday: d.opening_time_sunday?.slice(0,5),
                closing_time_sunday: d.closing_time_sunday?.slice(0,5),
            }))
            .catch(e=> setErr(e.message))
            .finally(()=> setLoading(false));
    };
    useEffect(()=>{ load(); /* eslint-disable-next-line */ },[restaurantId]);

    const onSave = async (e)=>{
        e.preventDefault();
        setSaving(true); setErr(null); setInfo("");
        try{
            await apiUpdateRestaurant(restaurantId, f, true);
            setInfo("Horaires enregistrés.");
        }catch(e){ setErr(e.message); }
        finally{ setSaving(false); }
    };

    return (
        <div className="p-6 space-y-4">
            <h1 className="text-2xl font-semibold">Horaires d’ouverture</h1>
            {!restaurantId && <ErrorMsg error={"Sélectionne un restaurant."}/>}
            {err && <ErrorMsg error={err}/>}
            {loading && <Loading/>}

            <form onSubmit={onSave} className="bg-white text-black border rounded-2xl p-4 grid md:grid-cols-2 gap-4">
                <Group title="Lundi → Jeudi">
                    <TimePair
                        start={f.opening_time_mon_to_thu}
                        end={f.closing_time_mon_to_thu}
                        onChange={(start,end)=> setF(s=>({...s, opening_time_mon_to_thu:start, closing_time_mon_to_thu:end}))}
                    />
                </Group>

                <Group title="Vendredi">
                    <TimePair
                        start={f.opening_time_friday}
                        end={f.closing_time_friday}
                        onChange={(start,end)=> setF(s=>({...s, opening_time_friday:start, closing_time_friday:end}))}
                    />
                </Group>

                <Group title="Samedi">
                    <TimePair
                        start={f.opening_time_saturday}
                        end={f.closing_time_saturday}
                        onChange={(start,end)=> setF(s=>({...s, opening_time_saturday:start, closing_time_saturday:end}))}
                    />
                </Group>

                <Group title="Dimanche">
                    <TimePair
                        start={f.opening_time_sunday}
                        end={f.closing_time_sunday}
                        onChange={(start,end)=> setF(s=>({...s, opening_time_sunday:start, closing_time_sunday:end}))}
                    />
                </Group>

                <div className="md:col-span-2 flex gap-2">
                    <button disabled={saving} className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50">
                        {saving ? "Enregistrement…" : "Enregistrer"}
                    </button>
                    <button type="button" onClick={load} className="px-3 py-2 rounded border">Annuler</button>
                    {info && <span className="text-emerald-400">{info}</span>}
                </div>
            </form>
        </div>
    );
}

function Group({title, children}){
    return (
        <section className="border rounded-xl p-3">
            <div className="font-medium mb-2">{title}</div>
            {children}
        </section>
    );
}
function TimePair({start,end,onChange}){
    return (
        <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
                <div className="opacity-70 mb-1">Ouverture</div>
                <input type="time" className="border rounded px-2 py-1 w-full" value={start}
                       onChange={(e)=> onChange(e.target.value, end)} />
            </label>
            <label className="text-sm">
                <div className="opacity-70 mb-1">Fermeture</div>
                <input type="time" className="border rounded px-2 py-1 w-full" value={end}
                       onChange={(e)=> onChange(start, e.target.value)} />
            </label>
        </div>
    );
}
