// src/components/restaurant/pages/market/OfferDetail.jsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
    apiGetOffer,
    apiListOfferComments,
    apiCreateOfferComment,
    apiDeleteOfferComment,
    apiCreateOfferReview,
    apiFlagOffer,
    apiImportOfferToProduct,
    apiCreateSupplierOrder,
} from "../../api";

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

export default function OfferDetail(){
    const { id } = useParams();
    const nav = useNavigate();

    const [offer,setOffer] = useState(null);
    const [comments,setComments] = useState([]);
    const [loading,setLoading] = useState(false);
    const [err,setErr] = useState(null);
    const [info,setInfo] = useState("");

    // review form
    const [rating,setRating] = useState(5);
    const [reviewComment,setReviewComment] = useState("");

    // comment form
    const [newComment,setNewComment] = useState("");

    // order form
    const [qty,setQty] = useState("");
    const [note,setNote] = useState("");

    const load = ()=>{
        setLoading(true); setErr(null); setInfo("");
        Promise.all([
            apiGetOffer(Number(id)),
            apiListOfferComments(Number(id)).catch(()=>[])
        ])
            .then(([o,coms])=>{
                setOffer(o || null);
                setComments(Array.isArray(coms)? coms: (Array.isArray(coms?.results)? coms.results: []));
                // init qty par défaut = min_order_qty
                if(o?.min_order_qty && !qty) setQty(String(o.min_order_qty));
            })
            .catch(e=> setErr(e))
            .finally(()=> setLoading(false));
    };

    useEffect(()=>{ load(); /* eslint-disable-next-line */ },[id]);

    const onAddComment = async (e)=>{
        e.preventDefault(); setErr(null); setInfo("");
        try{
            const content = String(newComment||"").trim();
            if(!content){ setErr("Le commentaire ne peut pas être vide."); return; }
            await apiCreateOfferComment({ offer: Number(id), content, is_public: true });
            setNewComment("");
            load();
        }catch(e){ setErr(e); }
    };

    const onDeleteComment = async (commentId)=>{
        setErr(null); setInfo("");
        try{
            await apiDeleteOfferComment(commentId);
            setComments(prev=> prev.filter(c=> c.id!==commentId));
        }catch(e){ setErr(e); }
    };

    const onSendReview = async (e)=>{
        e.preventDefault(); setErr(null); setInfo("");
        try{
            const r = Number(rating);
            if(!(r>=1 && r<=5)) { setErr("Note entre 1 et 5."); return; }
            await apiCreateOfferReview({ offer: Number(id), rating: r, comment: reviewComment });
            setInfo("Avis enregistré.");
            setReviewComment("");
            load();
        }catch(e){ setErr(e); }
    };

    const onFlag = async ()=>{
        setErr(null); setInfo("");
        const reason = prompt("Raison du signalement ?");
        if(!reason) return;
        try{
            await apiFlagOffer(Number(id), { reason, details: "" });
            setInfo("Offre signalée.");
        }catch(e){ setErr(e); }
    };

    const onImportProduct = async ()=>{
        setErr(null); setInfo("");
        try{
            const r = await apiImportOfferToProduct(Number(id));
            setInfo(`Produit importé (id=${r?.product_id ?? "?"}).`);
        }catch(e){ setErr(e); }
    };

    const onOrder = async (e)=>{
        e.preventDefault(); setErr(null); setInfo("");
        try{
            if(!offer) return;
            const q = Number(qty);
            if(!Number.isFinite(q) || q <= 0) { setErr("Quantité demandée invalide."); return; }
            if(q < Number(offer.min_order_qty || 0)) { setErr(`Quantité minimale: ${offer.min_order_qty}.`); return; }

            // une commande = un supplier
            const supplierId = offer.supplier;
            await apiCreateSupplierOrder({
                supplier: supplierId,
                note: note || "",
                items: [{ offer: offer.id, qty_requested: q }],
            });
            setInfo("Commande créée et envoyée au producteur.");
            setNote("");
            // ne pas reset qty (utile pour re-commander)
        }catch(e){ setErr(e); }
    };

    return (
        <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Offre #{id}</h1>
                <button className="px-3 py-2 rounded border" onClick={()=> nav(-1)}>Retour</button>
            </div>

            {err && <ErrorMsg error={err} onClose={()=> setErr(null)} />}
            {info && <div className="p-2 bg-emerald-600/10 text-emerald-400 rounded">{info}</div>}
            {loading && <Loading/>}

            {offer && (
                <div className="bg-white text-black border rounded-2xl p-4 space-y-4">
                    <div className="text-xl font-medium">{offer.product_name}</div>
                    <div className="text-sm opacity-70">Producteur: {offer.producer_name || "—"} • Région: {offer.region} • Unité: {offer.unit}</div>

                    <div className="text-sm">Prix: <b>{Number(offer.price).toFixed(2)} €</b></div>
                    <div className="text-sm">Min. commande: <b>{offer.min_order_qty}</b> • Stock: <b>{offer.stock_qty}</b></div>
                    <div className="text-sm">Note moyenne: <b>{offer.avg_rating ?? "—"}</b></div>

                    {offer.description && (
                        <div className="mt-2 text-sm whitespace-pre-wrap">{offer.description}</div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2">
                        <button className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-500" onClick={onFlag}>Signaler</button>
                        <button className="px-3 py-2 rounded bg-slate-700 hover:bg-slate-600" onClick={onImportProduct}>
                            Importer en produit (menu)
                        </button>
                    </div>

                    {/* Commander */}
                    <section className="border rounded-xl p-3">
                        <h3 className="font-medium mb-2">Commander</h3>
                        <form onSubmit={onOrder} className="grid md:grid-cols-3 gap-3">
                            <label className="text-sm">
                                <div className="opacity-70 mb-1">Quantité</div>
                                <input type="number" step="0.01" min={offer.min_order_qty || 0.01}
                                       className="border rounded px-2 py-1 w-full"
                                       value={qty} onChange={(e)=> setQty(e.target.value)} />
                                <div className="text-xs opacity-70 mt-1">Min: {offer.min_order_qty} • Stock: {offer.stock_qty}</div>
                            </label>

                            <label className="text-sm md:col-span-2">
                                <div className="opacity-70 mb-1">Note (optionnel)</div>
                                <input className="border rounded px-2 py-1 w-full" value={note} onChange={(e)=> setNote(e.target.value)} />
                            </label>

                            <div className="md:col-span-3">
                                <button className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500">Envoyer la commande</button>
                            </div>
                        </form>
                    </section>

                    {/* Avis (review) */}
                    <section className="border rounded-xl p-3">
                        <h3 className="font-medium mb-2">Laisser un avis</h3>
                        <form onSubmit={onSendReview} className="grid md:grid-cols-3 gap-3">
                            <label className="text-sm">
                                <div className="opacity-70 mb-1">Note (1–5)</div>
                                <input type="number" min={1} max={5} className="border rounded px-2 py-1 w-full"
                                       value={rating} onChange={(e)=> setRating(e.target.value)} />
                            </label>
                            <label className="text-sm md:col-span-2">
                                <div className="opacity-70 mb-1">Commentaire (optionnel)</div>
                                <input className="border rounded px-2 py-1 w-full"
                                       value={reviewComment} onChange={(e)=> setReviewComment(e.target.value)} />
                            </label>
                            <div className="md:col-span-3">
                                <button className="px-3 py-2 rounded bg-sky-600 hover:bg-sky-500">Publier l’avis</button>
                            </div>
                        </form>
                    </section>

                    {/* Commentaires publics */}
                    <section className="border rounded-xl p-3">
                        <h3 className="font-medium mb-2">Commentaires</h3>
                        {comments?.length ? (
                            <ul className="space-y-2">
                                {comments.map(c=>(
                                    <li key={c.id} className="border rounded p-2">
                                        <div className="text-xs opacity-70 mb-1">
                                            #{c.id} • {new Date(c.created_at).toLocaleString()}
                                        </div>
                                        <div className="text-sm whitespace-pre-wrap">{c.content}</div>
                                        <div className="mt-1">
                                            <button className="text-xs underline opacity-70 hover:opacity-100"
                                                    onClick={()=> onDeleteComment(c.id)}>supprimer (si auteur/admin)</button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : <Empty>Aucun commentaire.</Empty>}

                        <form onSubmit={onAddComment} className="mt-3 grid md:grid-cols-6 gap-3">
                            <label className="text-sm md:col-span-5">
                                <div className="opacity-70 mb-1">Nouveau commentaire</div>
                                <input className="border rounded px-2 py-1 w-full"
                                       value={newComment} onChange={(e)=> setNewComment(e.target.value)} />
                            </label>
                            <div className="md:col-span-1 flex items-end">
                                <button className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 w-full">Ajouter</button>
                            </div>
                        </form>
                    </section>
                </div>
            )}
        </div>
    );
}
