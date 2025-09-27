// src/components/restaurant/pages/purchasing/MySupplierOrders.jsx
import { useEffect, useState } from "react";
import { apiMyRestaurantOrders } from "../../api";

function Loading(){return <div className="p-4 text-sm opacity-70">Chargement…</div>;}
function Empty({children}){return <div className="p-3 opacity-60">{children}</div>;}

function extractApiErrors(error){
    const out = [];
    if(!error) return out;
    if(typeof error === "string") return [error];
    const data = error?.data;
    if(typeof data === "string" && data.trim()) out.push(data.trim());
    if(Array.isArray(data)) data.forEach(v=> out.push(typeof v==="string"?v:JSON.stringify(v)));
    if(data && typeof data==="object" && !Array.isArray(data)){
        const push=(label,val)=>{
            if(val==null) return;
            if(Array.isArray(val)) val.forEach(v=> out.push(label?`${label}: ${String(v)}`:String(v)));
            else if(typeof val==="object") out.push(label?`${label}: ${JSON.stringify(val)}`:JSON.stringify(val));
            else out.push(label?`${label}: ${String(val)}`:String(val));
        };
        if(data.detail) push("",data.detail);
        if(data.error) push("",data.error);
        if(data.non_field_errors) push("",data.non_field_errors);
        Object.entries(data).forEach(([k,v])=>{
            if(["detail","error","non_field_errors"].includes(k)) return;
            push(k,v);
        });
    }
    if(!out.length && error?.message) out.push(String(error.message));
    if(!out.length) out.push(String(error));
    return out;
}
function ErrorMsg({error,onClose}){
    const msgs = extractApiErrors(error);
    const status = error?.status;
    if(!msgs.length) return null;
    return (
        <div className="p-3 bg-red-600/10 text-red-400 rounded text-sm space-y-2">
            <div className="flex items-start justify-between gap-3">
                <div className="font-medium">{status?`Erreur ${status}`:"Erreur"}</div>
                {onClose && <button className="underline opacity-70 hover:opacity-100" onClick={onClose}>fermer</button>}
            </div>
            <ul className="list-disc pl-5 space-y-1">{msgs.map((m,i)=><li key={i}>{m}</li>)}</ul>
        </div>
    );
}

export default function MySupplierOrders(){
    const [rows,setRows] = useState([]);
    const [loading,setLoading]=useState(false);
    const [err,setErr]=useState(null);

    const load = ()=>{
        setLoading(true); setErr(null);
        apiMyRestaurantOrders()
            .then(list => setRows(Array.isArray(list)? list: (Array.isArray(list?.results)? list.results: [])))
            .catch(e => setErr(e))
            .finally(()=> setLoading(false));
    };

    useEffect(()=>{ load(); },[]);

    return (
        <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Mes commandes fournisseurs</h1>
                <button className="px-3 py-2 rounded border" onClick={load}>Rafraîchir</button>
            </div>

            {err && <ErrorMsg error={err} onClose={()=> setErr(null)} />}
            {loading && <Loading/>}

            {!loading && !err && (
                rows.length ? (
                    <table className="w-full text-sm bg-white text-black border rounded-2xl overflow-hidden">
                        <thead className="bg-gray-100">
                        <tr className="text-left">
                            <th className="py-2 px-3">#</th>
                            <th>Fournisseur</th>
                            <th>Statut</th>
                            <th>Créée le</th>
                            <th>Confirmée le</th>
                            <th>Note</th>
                            <th>Articles</th>
                        </tr>
                        </thead>
                        <tbody>
                        {rows.map(o=>(
                            <tr key={o.id} className="border-t align-top">
                                <td className="py-2 px-3">{o.id}</td>
                                <td>{o.supplier}</td>
                                <td>{o.status}</td>
                                <td>{new Date(o.created_at).toLocaleString()}</td>
                                <td>{o.confirmed_at ? new Date(o.confirmed_at).toLocaleString() : "—"}</td>
                                <td className="max-w-[260px]">{o.note || "—"}</td>
                                <td>
                                    {o.items?.length ? (
                                        <table className="text-xs w-full">
                                            <thead>
                                            <tr className="opacity-70">
                                                <th className="text-left">Produit</th>
                                                <th>Unit.</th>
                                                <th>Demandé</th>
                                                <th>Confirmé</th>
                                                <th>PU</th>
                                            </tr>
                                            </thead>
                                            <tbody>
                                            {o.items.map(it=>(
                                                <tr key={it.id} className="border-t">
                                                    <td className="text-left">{it.product_name} (#{it.offer})</td>
                                                    <td>{it.unit}</td>
                                                    <td>{it.qty_requested}</td>
                                                    <td>{it.qty_confirmed ?? "—"}</td>
                                                    <td>{Number(it.unit_price).toFixed(2)} €</td>
                                                </tr>
                                            ))}
                                            </tbody>
                                        </table>
                                    ) : "—"}
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                ) : <Empty>Aucune commande.</Empty>
            )}
        </div>
    );
}
