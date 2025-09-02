// src/components/restaurant/pages/events/EventsList.jsx
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import useActiveRestaurantId from "../../hooks/useActiveRestaurantId";
import {
    apiListEvents, apiPublishEvent, apiCancelEvent, apiCloseEvent, apiReopenEvent, apiDeleteEvent
} from "../../api";

function Loading(){return <div className="p-4 text-sm opacity-70">Chargement…</div>;}
function ErrorMsg({error}){return <div className="p-3 bg-red-600/10 text-red-400 rounded">{String(error)}</div>;}
function Empty({children}){return <div className="p-3 opacity-60">{children}</div>;}

export default function EventsList(){
    const restaurantId = useActiveRestaurantId();
    const [rows,setRows] = useState([]);
    const [loading,setLoading]=useState(false);
    const [err,setErr]=useState(null);

    const load = ()=>{
        if(!restaurantId) return;
        setLoading(true); setErr(null);
        apiListEvents({ restaurant: restaurantId })
            .then((list)=> setRows(list))
            .catch(e=> setErr(e.message))
            .finally(()=> setLoading(false));
    };

    useEffect(()=>{ load(); /* eslint-disable-next-line */ },[restaurantId]);

    const act = async (fn, id)=>{
        try{ await fn(id); load(); } catch(e){ setErr(e.message); }
    };

    return (
        <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Évènements</h1>
                <Link to="/restaurant/events/new" className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500">Créer</Link>
            </div>
            {!restaurantId && <ErrorMsg error={"Sélectionne un restaurant."} />}
            {err && <ErrorMsg error={err}/>}
            {loading && <Loading/>}

            {!loading && !err && (
                rows.length ? (
                    <table className="w-full text-sm bg-white text-black border rounded-2xl overflow-hidden">
                        <thead className="bg-gray-100">
                        <tr className="text-left">
                            <th className="py-2 px-3">Titre</th>
                            <th>Type</th>
                            <th>Date</th>
                            <th>Heures</th>
                            <th>Cap.</th>
                            <th>Public</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                        </thead>
                        <tbody>
                        {rows.map(ev=>(
                            <tr key={ev.id} className="border-t">
                                <td className="py-2 px-3">
                                    <div className="font-medium">{ev.title}</div>
                                    <div className="text-xs opacity-70">#{ev.id}</div>
                                </td>
                                <td>{ev.type}</td>
                                <td>{ev.date}</td>
                                <td>{ev.start_time?.slice(0,5)}–{ev.end_time?.slice(0,5)}</td>
                                <td>{ev.capacity ?? "—"}</td>
                                <td>{ev.is_public ? "Public" : "Privé"}</td>
                                <td>{ev.status}</td>
                                <td className="space-x-2">
                                    <Link className="px-2 py-1 border rounded" to={`/restaurant/events/${ev.id}/registrations`}>Inscrits</Link>
                                    <Link className="px-2 py-1 border rounded" to={`/restaurant/events/${ev.id}/invitations`}>Invitations</Link>
                                    <Link className="px-2 py-1 border rounded" to={`/restaurant/events/${ev.id}/edit`}>Éditer</Link>

                                    {ev.status !== "PUBLISHED" && <button className="px-2 py-1 rounded bg-emerald-600" onClick={()=>act(apiPublishEvent, ev.id)}>Publier</button>}
                                    {ev.status !== "CANCELLED" && <button className="px-2 py-1 rounded bg-red-600" onClick={()=>act(apiCancelEvent, ev.id)}>Annuler</button>}
                                    {ev.status !== "FULL" && <button className="px-2 py-1 rounded bg-yellow-600" onClick={()=>act(apiCloseEvent, ev.id)}>Marquer complet</button>}
                                    <button className="px-2 py-1 rounded bg-blue-600" onClick={()=>act(apiReopenEvent, ev.id)}>Réouvrir</button>
                                    <button className="px-2 py-1 rounded bg-red-700" onClick={()=>act(apiDeleteEvent, ev.id)}>Supprimer</button>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                ) : <Empty>Aucun évènement.</Empty>
            )}
        </div>
    );
}
