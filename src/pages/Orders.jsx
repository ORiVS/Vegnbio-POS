// src/pages/Orders.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getOrders, hold, reopen, cancelOrder, ticket } from "../https";
import CheckoutDialog from "../components/checkout/CheckoutDialog";

const isPaid      = (o) => o.status === "PAID";
const isCancelled = (o) => o.status === "CANCELLED";
const isRefunded  = (o) => o.status === "REFUNDED";
const isOpen      = (o) => o.status === "OPEN";
const isHold      = (o) => o.status === "HOLD";

const canHold     = (o) => isOpen(o);
const canReopen   = (o) => isHold(o);
const canCancel   = (o) => isOpen(o) || isHold(o);
const canCheckout = (o) => isOpen(o) && Number(o.total_due ?? 0) > Number(o.paid_amount ?? 0);

const isReadOnly  = (o) => isPaid(o) || isCancelled(o) || isRefunded(o);

// ordre logique pour les statuts
const STATUS_ORDER = ["OPEN", "HOLD", "PAID", "CANCELLED", "REFUNDED"];
const statusRank = (s) => {
    const up = String(s || "").toUpperCase();
    const idx = STATUS_ORDER.indexOf(up);
    return idx === -1 ? STATUS_ORDER.length + 1 : idx;
};

export default function Orders() {
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [checkoutOrder, setCheckoutOrder] = useState(null);

    // État du tri
    const [sortBy, setSortBy]   = useState("id");     // "id" | "status" | "total_due" | "paid_amount"
    const [sortDir, setSortDir] = useState("desc");   // "asc" | "desc"

    const reload = async () => {
        setLoading(true);
        try {
            const today = new Date().toISOString().slice(0, 10);
            const data = await getOrders({ restaurant: 1, date: today });
            setOrders(data || []);
        } catch (e) {
            setError("Impossible de récupérer les commandes");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        document.title = "Veg'N Bio | Commandes";
        reload();
    }, []);

    const doAndReload = async (p) => {
        await p;
        await reload();
    };

    // Gestion du tri
    const toggleSort = (col) => {
        if (col === sortBy) {
            setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        } else {
            setSortBy(col);
            // par défaut : id desc, le reste asc
            setSortDir(col === "id" ? "desc" : "asc");
        }
    };

    const sortedOrders = useMemo(() => {
        const arr = Array.isArray(orders) ? [...orders] : [];
        const dir = sortDir === "asc" ? 1 : -1;

        arr.sort((a, b) => {
            if (sortBy === "id") {
                const av = Number(a.id ?? 0);
                const bv = Number(b.id ?? 0);
                return (av - bv) * dir;
            }
            if (sortBy === "status") {
                const ar = statusRank(a.status);
                const br = statusRank(b.status);
                if (ar !== br) return (ar - br) * dir;
                // secours : alpha
                return String(a.status || "").localeCompare(String(b.status || "")) * dir;
            }
            if (sortBy === "total_due") {
                const av = Number(a.total_due ?? 0);
                const bv = Number(b.total_due ?? 0);
                return (av - bv) * dir;
            }
            if (sortBy === "paid_amount") {
                const av = Number(a.paid_amount ?? 0);
                const bv = Number(b.paid_amount ?? 0);
                return (av - bv) * dir;
            }
            return 0;
        });

        return arr;
    }, [orders, sortBy, sortDir]);

    // Petite flèche ↑↓ + état actif
    const Arrow = ({ active, dir }) => (
        <span className={`ml-1 inline-block text-xs transition-opacity ${active ? "opacity-100" : "opacity-40"}`}>
      {active ? (dir === "asc" ? "↑" : "↓") : "↕"}
    </span>
    );

    // Bouton d'en-tête triable
    const SortHeader = ({ col, children }) => {
        const active = sortBy === col;
        return (
            <button
                type="button"
                onClick={() => toggleSort(col)}
                className="inline-flex items-center gap-1 hover:underline"
                title="Trier"
            >
                <span>{children}</span>
                <Arrow active={active} dir={active ? sortDir : undefined} />
            </button>
        );
    };

    return (
        <section className="p-8">
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-xl font-semibold">Commandes</h1>
            </div>

            {loading ? (
                <div>Chargement…</div>
            ) : error ? (
                <div className="text-red-400">{error}</div>
            ) : (
                <div className="overflow-auto border border-[#2a2a2a] rounded">
                    <table className="w-full text-sm">
                        <thead className="bg-[#151515]">
                        <tr>
                            <th className="text-left p-3">
                                <SortHeader col="id">#</SortHeader>
                            </th>
                            <th className="text-left p-3">
                                <SortHeader col="status">Statut</SortHeader>
                            </th>
                            <th className="text-left p-3">
                                <SortHeader col="total_due">Total dû</SortHeader>
                            </th>
                            <th className="text-left p-3">
                                <SortHeader col="paid_amount">Payé</SortHeader>
                            </th>
                            <th className="text-left p-3">Actions</th>
                        </tr>
                        </thead>
                        <tbody>
                        {sortedOrders.map((o) => {
                            const disabledAll = isReadOnly(o);
                            const _canHold = !disabledAll && canHold(o);
                            const _canReopen = !disabledAll && canReopen(o);
                            const _canCancel = !disabledAll && canCancel(o);
                            const _canCheckout = !disabledAll && canCheckout(o);

                            const btnBase =
                                "px-2 py-1 rounded disabled:opacity-40 disabled:cursor-not-allowed";

                            return (
                                <tr
                                    key={o.id}
                                    className="border-t border-[#2a2a2a] hover:bg-[#191919]/60 cursor-pointer"
                                    onClick={(e) => {
                                        const tag = (e.target.tagName || "").toLowerCase();
                                        if (["button", "svg", "path"].includes(tag)) return;
                                        navigate(`/orders/${o.id}`);
                                    }}
                                >
                                    <td className="p-3">{o.id}</td>
                                    <td className="p-3">{o.status}</td>
                                    <td className="p-3">{Number(o.total_due ?? 0).toFixed(2)} €</td>
                                    <td className="p-3">{Number(o.paid_amount ?? 0).toFixed(2)} €</td>
                                    <td className="p-3">
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                className={`${btnBase} bg-amber-600/80 hover:bg-amber-600`}
                                                disabled={!_canHold}
                                                aria-disabled={!_canHold}
                                                title={!_canHold ? "Action indisponible" : "Mettre en attente"}
                                                onClick={(e) => { e.stopPropagation(); doAndReload(hold(o.id)); }}
                                            >
                                                Hold
                                            </button>

                                            <button
                                                className={`${btnBase} bg-sky-600/80 hover:bg-sky-600`}
                                                disabled={!_canReopen}
                                                aria-disabled={!_canReopen}
                                                title={!_canReopen ? "Action indisponible" : "Rouvrir"}
                                                onClick={(e) => { e.stopPropagation(); doAndReload(reopen(o.id)); }}
                                            >
                                                Reopen
                                            </button>

                                            <button
                                                className={`${btnBase} bg-rose-600/80 hover:bg-rose-600`}
                                                disabled={!_canCancel}
                                                aria-disabled={!_canCancel}
                                                title={!_canCancel ? "Action indisponible" : "Annuler"}
                                                onClick={(e) => { e.stopPropagation(); doAndReload(cancelOrder(o.id)); }}
                                            >
                                                Annuler
                                            </button>

                                            <button
                                                className={`${btnBase} bg-emerald-600/80 hover:bg-emerald-600`}
                                                disabled={!_canCheckout}
                                                aria-disabled={!_canCheckout}
                                                title={!_canCheckout ? "Rien à encaisser" : "Encaisser"}
                                                onClick={(e) => { e.stopPropagation(); setCheckoutOrder(o); }}
                                            >
                                                Encaisser
                                            </button>

                                            <button
                                                className={`${btnBase} bg-zinc-700 hover:bg-zinc-600`}
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    const { data } = await ticket(o.id);
                                                    alert(JSON.stringify(data, null, 2));
                                                }}
                                            >
                                                Ticket
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}

                        {sortedOrders.length === 0 && (
                            <tr>
                                <td colSpan={5} className="p-6 text-center opacity-70">
                                    Aucune commande aujourd’hui.
                                </td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>
            )}

            <CheckoutDialog
                open={!!checkoutOrder}
                order={checkoutOrder}
                onClose={() => setCheckoutOrder(null)}
                onSuccess={async () => {
                    setCheckoutOrder(null);
                    await reload();
                }}
            />
        </section>
    );
}
