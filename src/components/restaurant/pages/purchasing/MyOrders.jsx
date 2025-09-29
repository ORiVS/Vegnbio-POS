// src/components/restaurant/pages/purchasing/MyOrders.jsx
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

function badgeCls(s){
    switch(s){
        case "CONFIRMED": return "bg-emerald-600/10 text-emerald-600";
        case "PARTIALLY_CONFIRMED": return "bg-amber-600/10 text-amber-600";
        case "REJECTED": return "bg-rose-600/10 text-rose-600";
        default: return "bg-slate-600/10 text-slate-600";
    }
}

function euro(n){
    const x = Number(n);
    if(!Number.isFinite(x)) return "—";
    return `${x.toFixed(2)} €`;
}

export default function MyOrders(){
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

    // totaux utilitaires
    const totalRequested = (o)=>{
        if(!o?.items?.length) return 0;
        return o.items.reduce((s,it)=> s + (Number(it.unit_price)||0) * (Number(it.qty_requested)||0), 0);
    };
    const totalConfirmed = (o)=>{
        if(!o?.items?.length) return 0;
        return o.items.reduce((s,it)=> s + (Number(it.unit_price)||0) * (Number(it.qty_confirmed)||0), 0);
    };

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
                    <div className="space-y-4">
                        {rows.map(o=>(
                            <div key={o.id} className="bg-white text-black border rounded-2xl overflow-hidden">
                                {/* Entête commande */}
                                <div className="p-4 flex items-start justify-between gap-4">
                                    <div>
                                        <div className="text-lg font-medium">Commande #{o.id}</div>
                                        <div className="text-xs opacity-70">
                                            Créée le {o.created_at ? new Date(o.created_at).toLocaleString() : "—"}
                                            {o.confirmed_at ? <> • Confirmée le <b>{new Date(o.confirmed_at).toLocaleString()}</b></> : null}
                                        </div>
                                        <div className="text-xs opacity-70">Fournisseur: #{o.supplier}</div>
                                    </div>
                                    <div className={`px-2 py-1 rounded text-xs h-min ${badgeCls(o.status)}`}>{o.status}</div>
                                </div>

                                {/* Items */}
                                <div className="px-4 pb-4 overflow-x-auto">
                                    {o.items?.length ? (
                                        <table className="w-full text-sm min-w-[800px]">
                                            <thead className="bg-gray-100">
                                            <tr className="text-left">
                                                <th className="py-2 px-3">Offre</th>
                                                <th>Produit</th>
                                                <th>Unité</th>
                                                <th>Demandé</th>
                                                <th>Confirmé</th>
                                                <th>PU</th>
                                                <th>Total demandé</th>
                                                <th>Total confirmé</th>
                                            </tr>
                                            </thead>
                                            <tbody>
                                            {o.items.map(it=>(
                                                <tr key={it.id} className="border-t align-top">
                                                    <td className="py-2 px-3">#{it.offer}</td>
                                                    <td>{it.product_name}</td>
                                                    <td>{it.unit}</td>
                                                    <td>{it.qty_requested}</td>
                                                    <td>{it.qty_confirmed ?? "—"}</td>
                                                    <td>{euro(it.unit_price)}</td>
                                                    <td>{euro((Number(it.unit_price)||0) * (Number(it.qty_requested)||0))}</td>
                                                    <td>{it.qty_confirmed == null ? "—" : euro((Number(it.unit_price)||0) * (Number(it.qty_confirmed)||0))}</td>
                                                </tr>
                                            ))}
                                            </tbody>
                                            <tfoot>
                                            <tr className="border-t font-medium">
                                                <td className="py-2 px-3" colSpan={6}>Totaux</td>
                                                <td>{euro(totalRequested(o))}</td>
                                                <td>{o.status==="CONFIRMED"||o.status==="PARTIALLY_CONFIRMED" ? euro(totalConfirmed(o)) : "—"}</td>
                                            </tr>
                                            </tfoot>
                                        </table>
                                    ) : <div className="text-sm opacity-70 p-2">Aucun item.</div>}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : <Empty>Aucune commande.</Empty>
            )}
        </div>
    );
}
