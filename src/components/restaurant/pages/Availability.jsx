// src/components/restaurant/pages/Availability.jsx
import { useEffect, useState } from "react";
import { apiGetAvailability } from "../api";
import useActiveRestaurantId from "../hooks/useActiveRestaurantId";

function todayISO(){ return new Date().toISOString().slice(0,10); }
function Loading(){return <div className="p-4 text-sm opacity-70">Chargement…</div>;}
function ErrorMsg({error}){return <div className="p-3 bg-red-600/10 text-red-400 rounded">{String(error)}</div>;}
function Empty({children}){return <div className="p-3 opacity-60">{children}</div>;}

export default function Availability(){
    const restaurantId = useActiveRestaurantId();
    const [date,setDate] = useState(todayISO());
    const [data,setData] = useState(null);
    const [loading,setLoading]=useState(false);
    const [err,setErr]=useState(null);

    useEffect(()=>{
        if(!restaurantId) return;
        let alive = true;
        setLoading(true); setErr(null);
        apiGetAvailability(restaurantId, date)
            .then(d=> alive && setData(d))
            .catch(e=> alive && setErr(e.message))
            .finally(()=> alive && setLoading(false));
        return ()=>{alive=false};
    },[restaurantId,date]);

    return (
        <div className="p-6 space-y-4">
            <h1 className="text-2xl font-semibold">Disponibilités</h1>
            <div className="flex items-center gap-3">
                <label className="text-sm">Date:</label>
                <input type="date" className="border rounded px-2 py-1 bg-white text-black"
                       value={date} onChange={(e)=>setDate(e.target.value)} />
            </div>

            {!restaurantId && <ErrorMsg error={"Sélectionne un restaurant dans l’en-tête."} />}
            {loading && <Loading/>}
            {err && <ErrorMsg error={err}/>}

            {data && (
                <div className="grid md:grid-cols-2 gap-6">
                    <section className="bg-white text-black border rounded-2xl p-4">
                        <h2 className="font-medium mb-2">Salles</h2>
                        {data.rooms?.length ? (
                            <table className="w-full text-sm">
                                <thead>
                                <tr className="text-left border-b">
                                    <th className="py-2">Salle</th>
                                    <th>Capacité</th>
                                    <th>Réservations</th>
                                </tr>
                                </thead>
                                <tbody>
                                {data.rooms.map((r)=>(
                                    <tr key={r.room} className="border-b last:border-none">
                                        <td className="py-2">{r.room}</td>
                                        <td>{r.capacity}</td>
                                        <td>{r.reservations?.length || 0}</td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        ) : <Empty>Aucune salle.</Empty>}
                    </section>

                    <section className="bg-white text-black border rounded-2xl p-4">
                        <h2 className="font-medium mb-2">Évènements</h2>
                        {data.evenements?.length ? (
                            <ul className="space-y-2">
                                {data.evenements.map(ev=>(
                                    <li key={ev.id} className="border rounded p-2">
                                        <div className="font-medium">{ev.title} • {ev.type}</div>
                                        <div className="text-sm opacity-70">
                                            {ev.start_time?.slice(0,5)} — {ev.end_time?.slice(0,5)} • {ev.status}
                                            {ev.is_public ? " • public" : " • privé"}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : <Empty>Aucun évènement ce jour.</Empty>}
                    </section>
                </div>
            )}
        </div>
    );
}
