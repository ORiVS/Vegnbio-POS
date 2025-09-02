// src/components/restaurant/pages/settings/Closures.jsx
import { useEffect, useState } from "react";
import useActiveRestaurantId from "../../hooks/useActiveRestaurantId";
import { apiListClosures, apiCreateClosure, apiDeleteClosure } from "../../api";

function Loading(){return <div className="p-4 text-sm opacity-70">Chargement…</div>;}
function ErrorMsg({error}){return <div className="p-3 bg-red-600/10 text-red-400 rounded">{String(error)}</div>;}
function Empty({children}){return <div className="p-3 opacity-60">{children}</div>;}

function todayISO(){ return new Date().toISOString().slice(0,10); }

export default function Closures(){
    const restaurantId = useActiveRestaurantId();
    const [rows,setRows]=useState([]);
    const [loading,setLoading]=useState(false);
    const [err,setErr]=useState(null);

    const [f,setF] = useState({ date: todayISO(), reason:"" });

    const load = ()=>{
        if(!restaurantId) return;
        setLoading(true); setErr(null);
        apiListClosures(restaurantId)
            .then((list)=> setRows(list))
            .catch((e)=> setErr(e.message))
            .finally(()=> setLoading(false));
    };
    useEffect(()=>{ load(); /* eslint-disable-next-line */ },[restaurantId]);

    const onCreate = async (e)=>{
        e.preventDefault();
        try{
            await apiCreateClosure(restaurantId, f.date, f.reason || null);
            setF({ date: todayISO(), reason:"" });
            load();
        }catch(e){ setErr(e.message); }
    };

    const onDelete = async (id)=>{
        if(!confirm("Supprimer cette fermeture ?")) return;
        try{
            await apiDeleteClosure(id);
            load();
        }catch(e){ setErr(e.message); }
    };

    return (
        <div className="p-6 space-y-4">
            <h1 className="text-2xl font-semibold">Fermetures exceptionnelles</h1>
            {!restaurantId && <ErrorMsg error={"Sélectionne un restaurant."}/>}
            {err && <ErrorMsg error={err}/>}
            {loading && <Loading/>}

            <section className="bg-white text-black border rounded-2xl p-4">
                <h2 className="font-medium mb-2">Ajouter</h2>
                <form onSubmit={onCreate} className="grid md:grid-cols-3 gap-3">
                    <Field label="Date">
                        <input type="date" className="border rounded px-2 py-1 w-full"
                               value={f.date} onChange={(e)=> setF(v=>({...v, date:e.target.value}))}/>
                    </Field>
                    <Field label="Raison (optionnel)">
                        <input className="border rounded px-2 py-1 w-full"
                               value={f.reason} onChange={(e)=> setF(v=>({...v, reason:e.target.value}))}/>
                    </Field>
                    <div className="flex items-end">
                        <button className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500">Ajouter</button>
                    </div>
                </form>
            </section>

            <section className="bg-white text-black border rounded-2xl p-4">
                <h2 className="font-medium mb-2">Liste</h2>
                {rows.length ? (
                    <table className="w-full text-sm">
                        <thead>
                        <tr className="text-left border-b">
                            <th className="py-2">Date</th>
                            <th>Raison</th>
                            <th>Actions</th>
                        </tr>
                        </thead>
                        <tbody>
                        {rows.map((c)=>(
                            <tr key={c.id} className="border-b last:border-0">
                                <td className="py-2">{c.date}</td>
                                <td>{c.reason || "—"}</td>
                                <td>
                                    <button className="px-2 py-1 rounded bg-red-600" onClick={()=> onDelete(c.id)}>Supprimer</button>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                ) : <Empty>Aucune fermeture.</Empty>}
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
