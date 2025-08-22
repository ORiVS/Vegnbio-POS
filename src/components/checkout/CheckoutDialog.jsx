// src/components/checkout/CheckoutDialog.jsx
import { useEffect, useState } from "react";
import { ticket, checkout } from "../../https";
import { fmt, toNum } from "../../utils/money";

/** Normalise la réponse du ticket pour être robuste aux variations d'API */
function normalizeTicket(raw) {
    if (!raw) return { items: [], total_due: 0, paid_amount: 0 };

    const root = raw.order ?? raw;

    // Totaux reçus
    const total_due =
        toNum(root.total_due ?? raw.total_due ?? root.totals?.total_due ?? raw.totals?.total_due);
    const paid_amount =
        toNum(root.paid_amount ?? raw.paid_amount ?? root.totals?.paid_amount ?? raw.totals?.paid_amount);

    // Liste d’items possible à différents endroits
    const candidates =
        root.items ??
        raw.items ??
        root.lines ??
        raw.lines ??
        root.order_items ??
        raw.order_items ??
        [];

    // Uniformise les lignes et filtre les lignes invalidées
    const items = (Array.isArray(candidates) ? candidates : []).map((it, i) => {
        const id =
            it.id ?? it.item_id ?? it.pk ?? it.uuid ?? `tmp-${Date.now()}-${i}`;
        const name =
            it.label ?? // <<< priorise label (ton back)
            it.name ??
            it.dish_name ??
            it.title ??
            it.product_name ??
            it.dish?.name ??
            `Article #${id}`;
        const unit_price = toNum(
            it.unit_price ?? it.price ?? it.unitPrice ?? it.amount_ht ?? 0
        );
        const quantity = toNum(it.quantity ?? it.qty ?? 1);
        const status = (it.status ?? "ACTIVE").toUpperCase();
        const is_void =
            Boolean(it.is_void) ||
            Boolean(it.is_deleted) ||
            status === "VOID" ||
            status === "CANCELLED" ||
            status === "DELETED";
        return { id, name, unit_price, quantity, status, is_void };
    });

    const activeItems = items.filter((it) => !it.is_void);

    return { items: activeItems, total_due, paid_amount };
}

export default function CheckoutDialog({
                                           open,
                                           onClose,
                                           order,              // { id, total_due?, paid_amount? }
                                           defaultMethod = "CASH",
                                           onSuccess
                                       }) {
    const [loading, setLoading] = useState(false);
    const [ticketData, setTicketData] = useState({ items: [], total_due: 0, paid_amount: 0 });
    const [method, setMethod] = useState(defaultMethod);
    const [error, setError] = useState("");
    const [debugOpen, setDebugOpen] = useState(false);
    const [rawSnapshot, setRawSnapshot] = useState(null);

    useEffect(() => {
        if (!open || !order?.id) return;
        setError("");
        setMethod(defaultMethod);
        setTicketData({ items: [], total_due: 0, paid_amount: 0 });
        setRawSnapshot(null);

        (async () => {
            try {
                setLoading(true);
                const { data } = await ticket(order.id);
                setRawSnapshot(data);             // debug optionnel
                setTicketData(normalizeTicket(data));
            } catch (e) {
                // Fallback minimal si le ticket échoue
                setTicketData({
                    items: [],
                    total_due: toNum(order?.total_due),
                    paid_amount: toNum(order?.paid_amount),
                });
            } finally {
                setLoading(false);
            }
        })();
    }, [open, order?.id, defaultMethod]);

    if (!open) return null;

    // 1) somme locale des sous-totaux affichés (garantie = ce que l'utilisateur voit)
    const localTotal = ticketData.items.reduce(
        (acc, it) => acc + (toNum(it.unit_price) * toNum(it.quantity)),
        0
    );

    // 2) due = total_dû serveur OU fallback local si le serveur est faux/incomplet
    const due = toNum(ticketData.total_due) || localTotal;

    const paid = toNum(ticketData.paid_amount);
    const remaining = Math.max(0, +(due - paid).toFixed(2));

    const confirm = async () => {
        setError("");
        if (remaining <= 0) { setError("Rien à encaisser."); return; }
        try {
            setLoading(true);
            // On envoie le montant exact affiché
            await checkout(order.id, method, remaining);
            onSuccess?.({ orderId: order.id, method, amount: remaining });
            onClose?.();
        } catch (e) {
            setError("Échec de l'encaissement. Vérifie la connexion et réessaie.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100]">
            {/* overlay */}
            <div className="absolute inset-0 bg-black/60" onClick={() => !loading && onClose?.()} />
            {/* modal */}
            <div className="absolute left-1/2 top-1/2 w-[720px] -translate-x-1/2 -translate-y-1/2
                      rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6">
                <h2 className="text-xl font-semibold mb-1">Confirmer l’encaissement</h2>
                <p className="text-sm opacity-80 mb-4">Êtes-vous sûr de vouloir encaisser cette commande ?</p>

                {/* Récap montants */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                    <Info label="Total" value={fmt(due)} />
                    <Info label="Déjà payé" value={fmt(paid)} />
                    <Info label="Restant" value={fmt(remaining)} />
                </div>

                {/* Détail du ticket (données normalisées côté serveur) */}
                <div className="mb-4 border border-[#2a2a2a] rounded">
                    <div className="px-3 py-2 text-sm bg-[#151515] font-medium">Détail du ticket</div>
                    <div className="max-h-44 overflow-auto">
                        {loading ? (
                            <div className="p-3 text-sm opacity-80">Chargement…</div>
                        ) : ticketData.items.length === 0 ? (
                            <div className="p-3 text-sm opacity-60">Aucun article actif dans le ticket.</div>
                        ) : (
                            <table className="w-full text-xs">
                                <thead>
                                <tr className="text-left">
                                    <th className="p-2">Article</th>
                                    <th className="p-2">PU</th>
                                    <th className="p-2">Qté</th>
                                    <th className="p-2">Sous-total</th>
                                </tr>
                                </thead>
                                <tbody>
                                {ticketData.items.map((it) => (
                                    <tr key={it.id} className="border-t border-[#2a2a2a]">
                                        <td className="p-2">{it.name}</td>
                                        <td className="p-2">{fmt(it.unit_price)}</td>
                                        <td className="p-2">{it.quantity}</td>
                                        <td className="p-2">{fmt(it.unit_price * it.quantity)}</td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Debug optionnel : JSON brut du ticket */}
                    <div className="px-3 py-2">
                        <button
                            className="text-xs underline opacity-70 hover:opacity-100"
                            onClick={() => setDebugOpen((v) => !v)}
                        >
                            {debugOpen ? "Masquer les données brutes du ticket" : "Afficher les données brutes du ticket"}
                        </button>
                        {debugOpen && (
                            <pre className="mt-2 text-[10px] max-h-40 overflow-auto bg-[#111] p-2 rounded">
                {JSON.stringify(rawSnapshot ?? ticketData, null, 2)}
              </pre>
                        )}
                    </div>
                </div>

                {/* Méthode */}
                <div className="mb-4">
                    <div className="text-sm mb-2">Méthode de paiement</div>
                    <div className="flex gap-2">
                        <button
                            className={`px-3 py-2 rounded border ${method==="CASH" ? "border-emerald-500 bg-emerald-600/20" : "border-[#2a2a2a] bg-[#151515]"}`}
                            onClick={()=>setMethod("CASH")}
                            disabled={loading}
                        >Espèces</button>
                        <button
                            className={`px-3 py-2 rounded border ${method==="CARD" ? "border-emerald-500 bg-emerald-600/20" : "border-[#2a2a2a] bg-[#151515]"}`}
                            onClick={()=>setMethod("CARD")}
                            disabled={loading}
                        >Carte</button>
                        <button
                            className={`px-3 py-2 rounded border ${method==="ONLINE" ? "border-emerald-500 bg-emerald-600/20" : "border-[#2a2a2a] bg-[#151515]"}`}
                            onClick={()=>setMethod("ONLINE")}
                            disabled={loading}
                        >En ligne</button>
                    </div>
                </div>

                {error && <div className="text-red-400 text-sm mb-3">{error}</div>}

                <div className="flex items-center justify-end gap-2">
                    <button className="px-3 py-2 rounded bg-zinc-700 hover:bg-zinc-600"
                            onClick={()=>onClose?.()}
                            disabled={loading}>Annuler</button>
                    <button className="px-3 py-2 rounded bg-emerald-600/90 hover:bg-emerald-600"
                            onClick={confirm}
                            disabled={loading || remaining<=0}>
                        {loading ? "Encaissement…" : `Encaisser ${fmt(remaining)}`}
                    </button>
                </div>
            </div>
        </div>
    );
}

function Info({ label, value }){
    return (
        <div className="p-3 rounded-lg border border-[#2a2a2a] bg-[#151515]">
            <div className="text-xs opacity-70">{label}</div>
            <div className="text-base font-semibold">{value}</div>
        </div>
    );
}
