// src/components/restaurant/pages/purchasing/PurchasingOrders.jsx
import { useEffect, useState } from "react";
import { apiMyRestaurantOrders } from "../../api";

function Loading(){ return <div className="p-4 text-sm opacity-70">Chargement…</div>; }
function Empty({children}){ return <div className="p-3 opacity-60">{children}</div>; }

function extractApiErrors(error){
    const out=[]; if(!error) return out;
    if(typeof error==="string") return [error];
    const d=error?.data;
    if(typeof d==="string" && d.trim()) out.push(d.trim());
    if(Array.isArray(d)) d.forEach(v=>out.push(typeof v==="string"?v:JSON.stringify(v)));
    if(d && typeof d==="object" && !Array.isArray(d)){
        const push=(k,v)=>{
            if(v==null) return;
            if(Array.isArray(v)) v.forEach(x=>out.push(k?`${k}: ${String(x)}`:String(x)));
            else if(typeof v==="object") out.push(k?`${k}: ${JSON.stringify(v)}`:JSON.stringify(v));
            else out.push(k?`${k}: ${String(v)}`:String(v));
        };
        if(d.detail) push("", d.detail);
        if(d.error) push("", d.error);
        if(d.non_field_errors) push("", d.non_field_errors);
        Object.entries(d).forEach(([k,v])=>{
            if(["detail","error","non_field_errors"].includes(k)) return;
            push(k,v);
        });
    }
    if(!out.length && error?.message) out.push(String(error.message));
    if(!out.length) out.push(String(error));
    return out;
}

function ErrorBanner({error, onClose}){
    const msgs = extractApiErrors(error);
    if(!msgs.length) return null;
    const status = error?.status;
    return (
        <div className="p-3 bg-red-600/10 text-red-400 rounded text-sm space-y-2">
            <div className="flex items-start justify-between gap-3">
                <div className="font-medium">{status ? `Erreur ${status}` : "Erreur"}</div>
                {onClose && <button className="opacity-70 hover:opacity-100 underline" onClick={onClose}>fermer</button>}
            </div>
            <ul className="list-disc pl-5 space-y-1">{msgs.map((m,i)=><li key={i}>{m}</li>)}</ul>
        </div>
    );
}

export default function PurchasingOrders(){
    const [rows,setRows]=useState([]);
    const [loading,setLoading]=useState(false);
    const [err,setErr]=useState(null);

    const load = ()=>{
        setLoading(true); setErr(null);
        apiMyRestaurantOrders()
            .then(list=> setRows(Array.isArray(list) ? list : []))
            .catch(e=> setErr(e))
            .finally(()=> setLoading(false));
    };

    useEffect(()=>{ load(); },[]);

    return (
        <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Mes commandes fournisseurs</h1>
                <button className="px-3 py-2 rounded border" onClick={load}>Rafraîchir</button>
            </div>

            {err && <ErrorBanner error={err} onClose={()=>setErr(null)} />}
            {loading && <Loading />}

            {!loading && !err && (
                rows.length ? (
                    <div className="bg-white text-black border rounded-2xl overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-100">
                            <tr className="text-left">
                                <th className="py-2 px-3">#</th>
                                <th>Fournisseur</th>
                                <th>Statut</th>
                                <th>Créée le</th>
                                <th>Confirmée le</th>
                                <th>Note</th>
                            </tr>
                            </thead>
                            <tbody>
                            {rows.map(o=>(
                                <tr key={o.id} className="border-t align-top">
                                    <td className="py-2 px-3">
                                        <div className="font-medium">#{o.id}</div>
                                    </td>
                                    <td>#{o.supplier}</td>
                                    <td>{o.status}</td>
                                    <td>{o.created_at ? new Date(o.created_at).toLocaleString() : "—"}</td>
                                    <td>{o.confirmed_at ? new Date(o.confirmed_at).toLocaleString() : "—"}</td>
                                    <td className="max-w-[280px]">{o.note || "—"}</td>
                                </tr>
                            ))}
                            </tbody>
                        </table>

                        {/* Détail items */}
                        <div className="p-4 border-t space-y-4">
                            {rows.map(o=>(
                                <div key={o.id} className="rounded-xl border">
                                    <div className="px-3 py-2 bg-gray-50 text-sm font-medium">
                                        Items de la commande #{o.id}
                                    </div>
                                    <div className="p-3 overflow-x-auto">
                                        {o.items?.length ? (
                                            <table className="w-full text-sm">
                                                <thead>
                                                <tr className="text-left border-b">
                                                    <th className="py-2">Offre</th>
                                                    <th>Produit</th>
                                                    <th>Unité</th>
                                                    <th>Demandé</th>
                                                    <th>Confirmé</th>
                                                    <th>Prix unitaire</th>
                                                    <th>Total demandé</th>
                                                </tr>
                                                </thead>
                                                <tbody>
                                                {o.items.map(it=>(
                                                    <tr key={it.id} className="border-b last:border-0">
                                                        <td>#{it.offer}</td>
                                                        <td>{it.product_name}</td>
                                                        <td>{it.unit}</td>
                                                        <td>{it.qty_requested}</td>
                                                        <td>{it.qty_confirmed ?? "—"}</td>
                                                        <td>{it.unit_price != null ? `${it.unit_price} €` : "—"}</td>
                                                        <td>
                                                            {it.unit_price != null && it.qty_requested != null
                                                                ? `${Number(it.unit_price) * Number(it.qty_requested)} €`
                                                                : "—"}
                                                        </td>
                                                    </tr>
                                                ))}
                                                </tbody>
                                            </table>
                                        ) : <div className="text-sm opacity-70 p-2">Aucun item.</div>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : <Empty>Aucune commande.</Empty>
            )}
        </div>
    );
}
