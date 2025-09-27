// src/components/restaurant/pages/market/OffersList.jsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    apiListOffers,
    apiCompareOffers,
} from "../../api";

function Loading(){return <div className="p-4 text-sm opacity-70">Chargement…</div>;}
function Empty({children}){return <div className="p-3 opacity-60">{children}</div>;}

function extractApiErrors(error){
    const out = [];
    if(!error) return out;
    if(typeof error === "string") return [error];
    const data = error?.data;
    if(typeof data === "string" && data.trim()) out.push(data.trim());
    if(Array.isArray(data)) data.forEach(v=> out.push(typeof v === "string" ? v : JSON.stringify(v)));
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

export default function OffersList(){
    const [q,setQ] = useState("");
    const [availableOn,setAvailableOn]=useState("");
    const [allergen,setAllergen] = useState("");           // codes CSV à inclure
    const [excludeAllergens,setExcludeAllergens] = useState(""); // codes CSV à exclure
    const [sort,setSort] = useState(""); // "" | "price" | "-price"

    const params = useMemo(()=> {
        const p = {};
        if(q) p.q = q;
        p.is_bio = "true"; // exigence back (toutes nos offres sont bio)
        if(availableOn) p.available_on = availableOn;
        if(allergen) p.allergen = allergen;
        if(excludeAllergens) p.exclude_allergens = excludeAllergens;
        if(sort) p.sort = sort;
        return p;
    },[q,availableOn,allergen,excludeAllergens,sort]);

    const [rows,setRows] = useState([]);
    const [loading,setLoading] = useState(false);
    const [err,setErr] = useState(null);

    const [compareSel, setCompareSel] = useState([]); // ids
    const [compareData, setCompareData] = useState(null);

    const load = ()=>{
        setLoading(true); setErr(null); setCompareData(null);
        apiListOffers(params)
            .then(list => setRows(Array.isArray(list)? list: []))
            .catch(e => setErr(e))
            .finally(()=> setLoading(false));
    };

    useEffect(()=>{ load(); /* eslint-disable-next-line */ },[params]);

    const toggleCompare = (id)=>{
        setCompareSel(prev=>{
            const exists = prev.includes(id);
            if(exists) return prev.filter(x=>x!==id);
            if(prev.length>=4) return prev; // max 4
            return [...prev, id];
        });
    };

    const doCompare = async ()=>{
        setErr(null); setCompareData(null);
        try{
            const data = await apiCompareOffers(compareSel);
            setCompareData(Array.isArray(data)? data: []);
        }catch(e){ setErr(e); }
    };

    const clearCompare = ()=> { setCompareSel([]); setCompareData(null); };

    return (
        <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Marketplace — Offres fournisseurs</h1>
            </div>

            {err && <ErrorMsg error={err} onClose={()=> setErr(null)} />}

            {/* Filtres */}
            <div className="bg-white text-black border rounded-2xl p-4 grid md:grid-cols-6 gap-3">
                <label className="text-sm md:col-span-2">
                    <div className="opacity-70 mb-1">Recherche</div>
                    <input className="border rounded px-2 py-1 w-full"
                           placeholder="produit, producteur…"
                           value={q} onChange={(e)=> setQ(e.target.value)} />
                </label>

                <label className="text-sm">
                    <div className="opacity-70 mb-1">Disponible le</div>
                    <input type="date" className="border rounded px-2 py-1 w-full"
                           value={availableOn} onChange={(e)=> setAvailableOn(e.target.value)} />
                </label>

                <label className="text-sm">
                    <div className="opacity-70 mb-1">Allergènes (inclure) — codes CSV</div>
                    <input className="border rounded px-2 py-1 w-full"
                           placeholder="GLUTEN,EGG"
                           value={allergen} onChange={(e)=> setAllergen(e.target.value)} />
                </label>

                <label className="text-sm">
                    <div className="opacity-70 mb-1">Allergènes (exclure) — codes CSV</div>
                    <input className="border rounded px-2 py-1 w-full"
                           placeholder="PEANUT"
                           value={excludeAllergens} onChange={(e)=> setExcludeAllergens(e.target.value)} />
                </label>

                <label className="text-sm">
                    <div className="opacity-70 mb-1">Tri</div>
                    <select className="border rounded px-2 py-1 w-full"
                            value={sort} onChange={(e)=> setSort(e.target.value)}>
                        <option value="">Par défaut</option>
                        <option value="price">Prix croissant</option>
                        <option value="-price">Prix décroissant</option>
                    </select>
                </label>

                <div className="flex items-end gap-2">
                    <button className="px-3 py-2 rounded border" onClick={load}>Filtrer</button>
                    <button className="px-3 py-2 rounded border"
                            onClick={()=>{ setQ(""); setAvailableOn(""); setAllergen(""); setExcludeAllergens(""); setSort(""); }}>
                        Réinitialiser
                    </button>
                </div>
            </div>

            {loading && <Loading/>}

            {/* Comparaison */}
            {compareSel.length>0 && (
                <div className="bg-white text-black border rounded-2xl p-3 flex items-center justify-between">
                    <div className="text-sm">
                        {compareSel.length} sélection(s) pour comparaison (max 4).
                    </div>
                    <div className="flex gap-2">
                        <button className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-500"
                                onClick={doCompare}>Comparer</button>
                        <button className="px-3 py-2 rounded border" onClick={clearCompare}>Vider</button>
                    </div>
                </div>
            )}

            {compareData && (
                <div className="bg-white text-black border rounded-2xl p-4 overflow-auto">
                    <div className="font-medium mb-2">Comparaison</div>
                    {compareData.length ? (
                        <table className="w-full text-sm min-w-[800px]">
                            <thead className="bg-gray-100">
                            <tr className="text-left">
                                <th className="py-2 px-3">Produit</th>
                                <th>Producteur</th>
                                <th>Région</th>
                                <th>Unité</th>
                                <th>Prix</th>
                                <th>Min. cmd</th>
                                <th>Stock</th>
                                <th>Note moy.</th>
                            </tr>
                            </thead>
                            <tbody>
                            {compareData.map(o=>(
                                <tr key={o.id} className="border-t">
                                    <td className="py-2 px-3">
                                        <Link className="underline" to={`/restaurant/market/offers/${o.id}`}>{o.product_name}</Link>
                                    </td>
                                    <td>{o.producer_name || "—"}</td>
                                    <td>{o.region}</td>
                                    <td>{o.unit}</td>
                                    <td>{Number(o.price).toFixed(2)} €</td>
                                    <td>{o.min_order_qty}</td>
                                    <td>{o.stock_qty}</td>
                                    <td>{o.avg_rating ?? "—"}</td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    ) : <Empty>Aucune donnée à comparer.</Empty>}
                </div>
            )}

            {/* Liste */}
            {!loading && !err && (
                rows.length ? (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {rows.map(o=>(
                            <div key={o.id} className="bg-white text-black border rounded-2xl p-4">
                                <div className="flex items-center justify-between">
                                    <div className="font-medium">{o.product_name}</div>
                                    <label className="text-xs inline-flex items-center gap-2">
                                        <input type="checkbox" checked={compareSel.includes(o.id)} onChange={()=> toggleCompare(o.id)} />
                                        Comparer
                                    </label>
                                </div>
                                <div className="text-xs opacity-70 mb-2">#{o.id} • {o.region} • {o.unit}</div>
                                <div className="text-sm mb-2 line-clamp-2">{o.description || "—"}</div>
                                <div className="text-sm">Prix: <b>{Number(o.price).toFixed(2)} €</b></div>
                                <div className="text-sm">Min.: <b>{o.min_order_qty}</b> • Stock: <b>{o.stock_qty}</b></div>
                                <div className="text-sm">Note: <b>{o.avg_rating ?? "—"}</b></div>
                                <div className="mt-3 flex gap-2">
                                    <Link className="px-3 py-2 rounded border" to={`/restaurant/market/offers/${o.id}`}>Détail</Link>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : <Empty>Aucune offre publiée.</Empty>
            )}
        </div>
    );
}
