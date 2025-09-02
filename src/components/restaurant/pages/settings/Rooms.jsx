// src/components/restaurant/pages/settings/Rooms.jsx
import { useEffect, useState } from "react";
import useActiveRestaurantId from "../../hooks/useActiveRestaurantId";
import { apiGetRestaurant, apiCreateRoom, apiUpdateRoom, apiDeleteRoom } from "../../api";

function Loading(){return <div className="p-4 text-sm opacity-70">Chargement…</div>;}
function ErrorMsg({error}){return <div className="p-3 bg-red-600/10 text-red-400 rounded">{String(error)}</div>;}
function Empty({children}){return <div className="p-3 opacity-60">{children}</div>;}

export default function Rooms(){
    const restaurantId = useActiveRestaurantId();
    const [rooms,setRooms]=useState([]);
    const [loading,setLoading]=useState(false);
    const [err,setErr]=useState(null);

    // create form
    const [newRoom,setNewRoom] = useState({ name:"", capacity:"" });

    const load = ()=>{
        if(!restaurantId) return;
        setLoading(true); setErr(null);
        apiGetRestaurant(restaurantId)
            .then((d)=> setRooms(d.rooms || []))
            .catch((e)=> setErr(e.message))
            .finally(()=> setLoading(false));
    };
    useEffect(()=>{ load(); /* eslint-disable-next-line */ },[restaurantId]);

    const onCreate = async (e)=>{
        e.preventDefault();
        try{
            await apiCreateRoom({
                restaurant: restaurantId,
                name: newRoom.name,
                capacity: Number(newRoom.capacity || 0),
            });
            setNewRoom({name:"", capacity:""});
            load();
        }catch(e){ setErr(e.message); }
    };

    const onUpdate = async (id, patch)=>{
        try{
            await apiUpdateRoom(id, patch);
            load();
        }catch(e){ setErr(e.message); }
    };

    const onDelete = async (id)=>{
        if(!confirm("Supprimer cette salle ?")) return;
        try{
            await apiDeleteRoom(id);
            load();
        }catch(e){ setErr(e.message); }
    };

    return (
        <div className="p-6 space-y-4">
            <h1 className="text-2xl font-semibold">Salles</h1>
            {!restaurantId && <ErrorMsg error={"Sélectionne un restaurant."}/>}
            {err && <ErrorMsg error={err}/>}
            {loading && <Loading/>}

            <section className="bg-white text-black border rounded-2xl p-4">
                <h2 className="font-medium mb-2">Créer une salle</h2>
                <form onSubmit={onCreate} className="grid md:grid-cols-3 gap-3">
                    <Field label="Nom">
                        <input className="border rounded px-2 py-1 w-full" value={newRoom.name}
                               onChange={(e)=> setNewRoom(r=>({...r, name:e.target.value}))}/>
                    </Field>
                    <Field label="Capacité">
                        <input type="number" className="border rounded px-2 py-1 w-full" value={newRoom.capacity}
                               onChange={(e)=> setNewRoom(r=>({...r, capacity:e.target.value}))}/>
                    </Field>
                    <div className="flex items-end">
                        <button className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500">Créer</button>
                    </div>
                </form>
            </section>

            <section className="bg-white text-black border rounded-2xl p-4">
                <h2 className="font-medium mb-2">Liste</h2>
                {rooms.length ? (
                    <table className="w-full text-sm">
                        <thead>
                        <tr className="text-left border-b">
                            <th className="py-2">Nom</th>
                            <th>Capacité</th>
                            <th>Actions</th>
                        </tr>
                        </thead>
                        <tbody>
                        {rooms.map((r)=>(
                            <RoomRow key={r.id} r={r} onUpdate={onUpdate} onDelete={onDelete}/>
                        ))}
                        </tbody>
                    </table>
                ) : <Empty>Aucune salle.</Empty>}
            </section>
        </div>
    );
}

function Field({label, children}){
    return (
        <label className="text-sm">
            <div className="opacity-70 mb-1">{label}</div>
            {children}
        </label>
    );
}

function RoomRow({ r, onUpdate, onDelete }){
    const [edit,setEdit] = useState(false);
    const [f,setF] = useState({ name:r.name, capacity:String(r.capacity) });

    return (
        <tr className="border-b last:border-0">
            <td className="py-2">
                {edit ? (
                    <input className="border rounded px-2 py-1 w-full" value={f.name}
                           onChange={(e)=> setF(v=>({...v,name:e.target.value}))}/>
                ) : r.name}
            </td>
            <td>
                {edit ? (
                    <input type="number" className="border rounded px-2 py-1 w-full" value={f.capacity}
                           onChange={(e)=> setF(v=>({...v,capacity:e.target.value}))}/>
                ) : r.capacity}
            </td>
            <td className="space-x-2">
                {edit ? (
                    <>
                        <button className="px-2 py-1 rounded bg-emerald-600"
                                onClick={()=> onUpdate(r.id, { name:f.name, capacity:Number(f.capacity||0) }).then(()=> setEdit(false))}>
                            Enregistrer
                        </button>
                        <button className="px-2 py-1 rounded border" onClick={()=> setEdit(false)}>Annuler</button>
                    </>
                ) : (
                    <>
                        <button className="px-2 py-1 rounded border" onClick={()=> setEdit(true)}>Renommer / Capacité</button>
                        <button className="px-2 py-1 rounded bg-red-600" onClick={()=> onDelete(r.id)}>Supprimer</button>
                    </>
                )}
            </td>
        </tr>
    );
}
