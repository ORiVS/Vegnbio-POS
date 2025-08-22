// src/pages/OrderDetail.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ticket, hold, reopen, cancelOrder } from "../https";
import CheckoutDialog from "../components/checkout/CheckoutDialog";
import { fmt, toNum } from "../utils/money";

function normalizeTicket(raw) {
    if (!raw) return { id: null, status: "OPEN", items: [], subtotal: 0, tax_total: 0, total_due: 0, paid_amount: 0, discount_amount: 0, discount_percent: 0, tax_rate: 0, opened_at: null, restaurant: "" };

    const root = raw.order ?? raw;
    const itemsSrc = root.items ?? raw.items ?? root.lines ?? raw.lines ?? [];

    const items = (Array.isArray(itemsSrc) ? itemsSrc : []).map((it, i) => ({
        id: it.id ?? it.item_id ?? it.pk ?? `tmp-${Date.now()}-${i}`,
        name: it.label ?? it.name ?? it.dish_name ?? it.title ?? it.product_name ?? "Article",
        quantity: toNum(it.qty ?? it.quantity ?? 1),
        unit_price: toNum(it.unit_price ?? it.price ?? it.unitPrice ?? it.amount_ht ?? 0),
        line_total: toNum(it.line_total ?? (toNum(it.unit_price ?? it.price) * toNum(it.qty ?? it.quantity ?? 1))),
    }));

    const subtotal = toNum(root.subtotal ?? raw.subtotal);
    const total_due = toNum(root.total_due ?? raw.total_due);
    const paid_amount = toNum(root.paid_amount ?? raw.paid_amount);
    const tax_total = toNum(root.tax_total ?? raw.tax_total);
    const tax_rate = toNum(root.tax_rate ?? raw.tax_rate);
    const discount_amount = toNum(root.discount_amount ?? raw.discount_amount);
    const discount_percent = toNum(root.discount_percent ?? raw.discount_percent);

    return {
        id: root.order_id ?? root.id,
        status: root.status ?? "OPEN",
        items,
        subtotal,
        total_due,
        paid_amount,
        tax_total,
        tax_rate,
        discount_amount,
        discount_percent,
        opened_at: root.opened_at ?? null,
        restaurant: root.restaurant ?? "",
    };
}

const isPaid = (s) => s === "PAID";
const isCancelled = (s) => s === "CANCELLED";
const isRefunded = (s) => s === "REFUNDED";
const isOpen = (s) => s === "OPEN";
const isHold = (s) => s === "HOLD";

export default function OrderDetail() {
    const { orderId } = useParams();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");
    const [data, setData] = useState(null);
    const [showCheckout, setShowCheckout] = useState(false);

    const load = async () => {
        setLoading(true);
        setErr("");
        try {
            const { data } = await ticket(orderId);
            setData(normalizeTicket(data));
        } catch (e) {
            setErr("Impossible de charger le détail de la commande");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        document.title = `Commande #${orderId} | Veg'N Bio`;
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orderId]);

    const guards = useMemo(() => {
        const s = data?.status ?? "OPEN";
        const readOnly = isPaid(s) || isCancelled(s) || isRefunded(s);
        return {
            readOnly,
            canHold: isOpen(s) && !readOnly,
            canReopen: isHold(s) && !readOnly,
            canCancel: (isOpen(s) || isHold(s)) && !readOnly,
            canCheckout: isOpen(s) && !readOnly && toNum(data?.total_due) > toNum(data?.paid_amount),
        };
    }, [data]);

    return (
        <section className="p-8">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <button
                        className="px-3 py-2 rounded bg-zinc-700 hover:bg-zinc-600"
                        onClick={() => navigate(-1)}
                    >
                        ← Retour
                    </button>
                    <h1 className="text-xl font-semibold">
                        Commande <span className="opacity-80">#{orderId}</span>
                    </h1>
                    {data && <StatusBadge status={data.status} />}
                </div>

                {data && (
                    <div className="text-sm opacity-80">
                        {data.restaurant && <span className="mr-3">{data.restaurant}</span>}
                        {data.opened_at && <span>Ouverte le {new Date(data.opened_at).toLocaleString("fr-FR")}</span>}
                    </div>
                )}
            </div>

            {loading ? (
                <div>Chargement…</div>
            ) : err ? (
                <div className="text-red-400">{err}</div>
            ) : data ? (
                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Colonne gauche : items */}
                    <div className="lg:col-span-2 space-y-4">
                        <div className="border border-[#2a2a2a] rounded-lg overflow-hidden">
                            <div className="px-4 py-3 bg-[#151515] font-medium">Articles</div>
                            <div className="max-h-[55vh] overflow-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                    <tr className="text-left">
                                        <th className="p-3">Article</th>
                                        <th className="p-3">PU</th>
                                        <th className="p-3">Qté</th>
                                        <th className="p-3">Sous-total</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {data.items.map((it) => (
                                        <tr key={it.id} className="border-t border-[#2a2a2a]">
                                            <td className="p-3">{it.name}</td>
                                            <td className="p-3">{fmt(it.unit_price)}</td>
                                            <td className="p-3">{it.quantity}</td>
                                            <td className="p-3">{fmt(it.unit_price * it.quantity)}</td>
                                        </tr>
                                    ))}
                                    {data.items.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="p-6 text-center opacity-70">
                                                Aucun article.
                                            </td>
                                        </tr>
                                    )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Actions par statut */}
                        <div className="flex flex-wrap gap-2">
                            <button
                                className="px-3 py-2 rounded bg-amber-600/80 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed"
                                disabled={!guards.canHold}
                                onClick={async () => { await hold(orderId); await load(); }}
                            >
                                Mettre en attente
                            </button>
                            <button
                                className="px-3 py-2 rounded bg-sky-600/80 hover:bg-sky-600 disabled:opacity-40 disabled:cursor-not-allowed"
                                disabled={!guards.canReopen}
                                onClick={async () => { await reopen(orderId); await load(); }}
                            >
                                Rouvrir
                            </button>
                            <button
                                className="px-3 py-2 rounded bg-rose-600/80 hover:bg-rose-600 disabled:opacity-40 disabled:cursor-not-allowed"
                                disabled={!guards.canCancel}
                                onClick={async () => { await cancelOrder(orderId); await load(); }}
                            >
                                Annuler
                            </button>
                        </div>
                    </div>

                    {/* Colonne droite : totaux & encaissement */}
                    <aside className="space-y-4">
                        <div className="border border-[#2a2a2a] rounded-lg p-4 bg-[#1a1a1a]">
                            <div className="text-sm opacity-80 mb-3">Récapitulatif</div>

                            <Row label="Sous-total (HT)" value={fmt(data.subtotal)} />
                            {toNum(data.discount_amount) > 0 && (
                                <Row label={`Remise (${toNum(data.discount_percent)}%)`} value={`− ${fmt(data.discount_amount)}`} />
                            )}
                            <Row label={`TVA (${toNum(data.tax_rate)}%)`} value={fmt(data.tax_total)} />
                            <div className="h-px bg-[#2a2a2a] my-3" />
                            <Row label="Total TTC" value={<strong>{fmt(data.total_due)}</strong>} />
                            <Row label="Déjà payé" value={fmt(data.paid_amount)} />
                            <div className="h-px bg-[#2a2a2a] my-3" />
                            <Row
                                label="Reste à payer"
                                value={
                                    <strong>
                                        {fmt(Math.max(0, +(toNum(data.total_due) - toNum(data.paid_amount)).toFixed(2)))}
                                    </strong>
                                }
                            />
                        </div>

                        <button
                            className="w-full px-4 py-3 rounded bg-emerald-600/90 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed"
                            disabled={!guards.canCheckout}
                            onClick={() => setShowCheckout(true)}
                        >
                            Encaisser
                        </button>
                    </aside>
                </div>
            ) : null}

            {/* Modale d’encaissement */}
            {data && (
                <CheckoutDialog
                    open={showCheckout}
                    order={{ id: data.id, total_due: data.total_due, paid_amount: data.paid_amount }}
                    onClose={() => setShowCheckout(false)}
                    onSuccess={async () => { setShowCheckout(false); await load(); }}
                />
            )}
        </section>
    );
}

function Row({ label, value }) {
    return (
        <div className="flex items-center justify-between text-sm py-1">
            <span className="opacity-80">{label}</span>
            <span>{value}</span>
        </div>
    );
}

function StatusBadge({ status }) {
    const s = String(status || "").toUpperCase();
    const color =
        s === "PAID" ? "bg-emerald-600/20 text-emerald-400 border-emerald-600/40" :
            s === "HOLD" ? "bg-amber-600/20 text-amber-400 border-amber-600/40" :
                s === "CANCELLED" ? "bg-rose-600/20 text-rose-400 border-rose-600/40" :
                    "bg-zinc-600/20 text-zinc-300 border-zinc-600/40";
    return (
        <span className={`text-xs px-2 py-1 border rounded ${color}`}>
      {s}
    </span>
    );
}
