// src/components/restaurant/pages/market/OffersList.jsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiListOffers, apiCompareOffers } from "../../api";

/* ---------- Styles champs ---------- */
const fieldBase =
    "border rounded px-2 py-1 w-full bg-gray-50 text-gray-900 placeholder-gray-400 " +
    "focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200";

function Loading(){return <div className="p-4 text-sm opacity-70">Chargement…</div>;}
function Empty({children}){return <div className="p-3 opacity-60">{children}</div>;}

/* ---------- Helpers erreurs ---------- */
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

/* ---------- Utils comparaison ---------- */
function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }
function mmNormalize(val, min, max){
    if(min === max) return 1; // évite NaN
    return clamp((val - min) / (max - min), 0, 1);
}
function normalizeWeights(w){
    const total = Object.values(w).reduce((s,x)=> s + Number(x||0), 0) || 1;
    const out = {};
    for(const k of Object.keys(w)) out[k] = Number(w[k]||0) / total;
    return out;
}

export default function OffersList(){
    const [q,setQ] = useState("");
    const [availableOn,setAvailableOn]=useState("");
    const [allergen,setAllergen] = useState("");
    const [excludeAllergens,setExcludeAllergens] = useState("");
    const [sort,setSort] = useState("");

    const params = useMemo(()=> {
        const p = {};
        if(q) p.q = q;
        p.is_bio = "true";
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

    // Préférences comparaison
    const [cmpQty, setCmpQty] = useState(10); // quantité désirée
    const [weights, setWeights] = useState({
        price: 50,   // %
        rating: 30,  // %
        stock: 15,   // %
        minOrder: 5, // %
    });

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
            if(prev.length>=4) return prev;
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

    // ----- Calcul des scores quand compareData change -----
    const [scored, setScored] = useState([]);
    useEffect(()=>{
        if(!compareData || !compareData.length) { setScored([]); return; }
        const qty = Math.max(0.0001, Number(cmpQty) || 0); // évite /0
        const w = normalizeWeights(weights);

        const prices = compareData.map(o => Number(o.price));
        const pMin = Math.min(...prices), pMax = Math.max(...prices);

        const list = compareData.map(o=>{
            const price = Number(o.price);
            const rating = Number(o.avg_rating ?? 0); // 0..5
            const stock = Number(o.stock_qty ?? 0);
            const minOrder = o.min_order_qty != null ? Number(o.min_order_qty) : null;

            const priceScore   = 1 - mmNormalize(price, pMin, pMax);           // bas=meilleur
            const ratingScore  = clamp((rating || 0) / 5, 0, 1);               // 0..1
            const stockScore   = clamp(qty > 0 ? Math.min(stock, qty)/qty : 1, 0, 1); // couvre la demande ?
            const moScore      = minOrder == null || minOrder <= qty
                ? 1
                : clamp(qty / minOrder, 0, 1); // pénalité si min_order > qty

            const global = (
                w.price   * priceScore +
                w.rating  * ratingScore +
                w.stock   * stockScore +
                w.minOrder* moScore
            );

            // raisons / badges
            const reasons = [];
            if(minOrder == null) reasons.push("Pas de minimum de commande");
            else if(minOrder <= qty) reasons.push(`OK min. commande (${minOrder})`);
            else reasons.push(`Min. commande ${minOrder} > quantité souhaitée (${qty})`);

            if(stock >= qty) reasons.push("Stock suffisant");
            else reasons.push(`Stock partiel (${stock}/${qty})`);

            return {
                ...o,
                _calc: { price, rating, stock, minOrder, priceScore, ratingScore, stockScore, moScore, global }
            };
        });

        // highlights: indices des meilleurs par métrique
        const best = {
            price: list.reduce((bi, o, i)=> (o._calc.price < list[bi]._calc.price ? i : bi), 0),
            rating: list.reduce((bi, o, i)=> (o._calc.rating > list[bi]._calc.rating ? i : bi), 0),
            stock: list.reduce((bi, o, i)=> (o._calc.stock > list[bi]._calc.stock ? i : bi), 0),
            mo: list.reduce((bi, o, i)=> ((o._calc.minOrder??0) < (list[bi]._calc.minOrder??Infinity) ? i : bi), 0),
            global: list.reduce((bi, o, i)=> (o._calc.global > list[bi]._calc.global ? i : bi), 0),
        };

        // tri par score
        list.sort((a,b)=> b._calc.global - a._calc.global);
        // conserve best indices dans l'ordre trié en recalculant
        const idToIndex = (id)=> list.findIndex(x=> x.id === id);
        const bestIdx = {
            price: idToIndex(compareData[best.price].id),
            rating: idToIndex(compareData[best.rating].id),
            stock: idToIndex(compareData[best.stock].id),
            mo: idToIndex(compareData[best.mo].id),
            global: idToIndex(compareData[best.global].id),
        };

        setScored(list.map((o, idx)=> ({ ...o, _bestIdx: bestIdx, _rank: idx+1 })));
    }, [compareData, cmpQty, weights]);

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
                    <input
                        className={fieldBase}
                        placeholder="produit, producteur…"
                        value={q}
                        onChange={(e)=> setQ(e.target.value)}
                    />
                </label>

                <label className="text-sm">
                    <div className="opacity-70 mb-1">Disponible le</div>
                    <input
                        type="date"
                        className={fieldBase}
                        value={availableOn}
                        onChange={(e)=> setAvailableOn(e.target.value)}
                    />
                </label>

                <label className="text-sm">
                    <div className="opacity-70 mb-1">Tri</div>
                    <select
                        className={fieldBase}
                        value={sort}
                        onChange={(e)=> setSort(e.target.value)}
                    >
                        <option value="">Par défaut</option>
                        <option value="price">Prix croissant</option>
                        <option value="-price">Prix décroissant</option>
                    </select>
                </label>

                <div className="flex items-end gap-2">
                    <button className="px-3 py-2 rounded border" onClick={load}>Filtrer</button>
                    <button
                        className="px-3 py-2 rounded border"
                        onClick={()=>{ setQ(""); setAvailableOn(""); setAllergen(""); setExcludeAllergens(""); setSort(""); }}
                    >
                        Réinitialiser
                    </button>
                </div>
            </div>

            {loading && <Loading/>}

            {/* Bandeau sélection */}
            {compareSel.length>0 && (
                <div className="bg-white text-black border rounded-2xl p-3 flex items-center justify-between">
                    <div className="text-sm">{compareSel.length} sélection(s)  (max 4).</div>
                    <div className="flex gap-2">
                        <button className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-500" onClick={doCompare}>Comparer</button>
                        <button className="px-3 py-2 rounded border" onClick={clearCompare}>Vider</button>
                    </div>
                </div>
            )}

            {/* Comparaison intelligente */}
            {compareData && (
                <div className="bg-white text-black border rounded-2xl p-4 overflow-auto space-y-4">
                    <div className="flex flex-wrap items-end gap-4">
                        <div>
                            <div className="text-xs opacity-70 mb-1">Quantité souhaitée</div>
                            <input
                                type="number" min={0} step="0.01"
                                className={fieldBase + " w-40"}
                                value={cmpQty}
                                onChange={(e)=> setCmpQty(e.target.value)}
                            />
                        </div>
                        <div className="grid sm:grid-cols-4 gap-4">
                            {[
                                {k:"price", label:"Poids Prix (%)"},
                                {k:"rating", label:"Poids Note (%)"},
                                {k:"stock", label:"Poids Stock (%)"},
                                {k:"minOrder", label:"Poids Min. cmd (%)"},
                            ].map(({k,label})=>(
                                <label key={k} className="text-xs">
                                    <div className="opacity-70 mb-1">{label}</div>
                                    <input
                                        type="number" min={0} max={100}
                                        className={fieldBase + " w-40"}
                                        value={weights[k]}
                                        onChange={(e)=> setWeights(w=> ({...w, [k]: Number(e.target.value||0)}))}
                                    />
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="text-xs opacity-70">
                        Le score combine les critères avec tes pondérations. Meilleure ligne surlignée.
                        Prix: plus bas = meilleur. Stock: couvre la quantité demandée. Min. cmd: pénalité si supérieure à la quantité.
                    </div>

                    {scored.length ? (
                        <table className="w-full text-sm min-w-[900px]">
                            <thead className="bg-gray-100">
                            <tr className="text-left">
                                <th className="py-2 px-3">Rang</th>
                                <th>Produit</th>
                                <th>Producteur</th>
                                <th>Prix</th>
                                <th>Note</th>
                                <th>Stock</th>
                                <th>Min. cmd</th>
                                <th>Score</th>
                                <th>Actions</th>
                            </tr>
                            </thead>
                            <tbody>
                            {scored.map((o, idx)=>{
                                const b = o._bestIdx;
                                const bestRow = idx === b.global;
                                return (
                                    <tr key={o.id} className={`border-t ${bestRow ? "bg-emerald-50" : ""}`}>
                                        <td className="py-2 px-3 font-medium">{o._rank}</td>
                                        <td className="py-2 px-3">
                                            <Link className="underline" to={`/restaurant/market/offers/${o.id}`}>{o.product_name}</Link>
                                            <div className="text-[11px] opacity-70">#{o.id} • {o.region} • {o.unit}</div>
                                        </td>
                                        <td>{o.producer_name || o.supplier_name || "—"}</td>
                                        <td className={`${idx===b.price ? "bg-emerald-100/60" : ""}`}>{Number(o.price).toFixed(2)} €</td>
                                        <td className={`${idx===b.rating ? "bg-emerald-100/60" : ""}`}>{o.avg_rating ?? "—"}</td>
                                        <td className={`${idx===b.stock ? "bg-emerald-100/60" : ""}`}>{o.stock_qty}</td>
                                        <td className={`${idx===b.mo ? "bg-emerald-100/60" : ""}`}>{o.min_order_qty ?? "—"}</td>
                                        <td className="font-semibold">{Math.round(o._calc.global*100)}</td>
                                        <td className="space-x-2">
                                            <Link className="px-2 py-1 border rounded" to={`/restaurant/market/offers/${o.id}`}>Détail</Link>
                                        </td>
                                    </tr>
                                );
                            })}
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
                                        <input
                                            type="checkbox"
                                            checked={compareSel.includes(o.id)}
                                            onChange={()=> toggleCompare(o.id)}
                                        />
                                        Sélectionner
                                    </label>
                                </div>

                                <div className="text-xs opacity-70 mb-2">
                                    #{o.id} • {o.region} • {o.unit}
                                </div>

                                {(o.producer_name || o.supplier_name) && (
                                    <div className="text-xs opacity-80 mb-1">
                                        Producteur : <b>{o.producer_name || o.supplier_name}</b>
                                    </div>
                                )}

                                {(o.available_from || o.available_to) && (
                                    <div className="text-xs opacity-70 mb-2">
                                        Dispo&nbsp;
                                        {o.available_from ? `du ${o.available_from}` : "dès maintenant"}{" "}
                                        {o.available_to ? `au ${o.available_to}` : ""}
                                    </div>
                                )}

                                <div className="text-sm mb-2 line-clamp-2">{o.description || "—"}</div>
                                <div className="text-sm">Prix: <b>{Number(o.price).toFixed(2)} €</b></div>
                                <div className="text-sm">Min.: <b>{o.min_order_qty ?? "—"}</b> • Stock: <b>{o.stock_qty}</b></div>
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
