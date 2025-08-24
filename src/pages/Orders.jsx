import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { getOrders, hold, reopen, cancelOrder, ticket } from "../https";
import CheckoutDialog from "../components/checkout/CheckoutDialog";

const isPaid      = (o) => String(o.status).toUpperCase() === "PAID";
const isCancelled = (o) => String(o.status).toUpperCase() === "CANCELLED";
const isRefunded  = (o) => String(o.status).toUpperCase() === "REFUNDED";
const isOpen      = (o) => String(o.status).toUpperCase() === "OPEN";
const isHold      = (o) => String(o.status).toUpperCase() === "HOLD";

const canHold     = (o) => isOpen(o);
const canReopen   = (o) => isHold(o);
const canCancel   = (o) => isOpen(o) || isHold(o);
const canCheckout = (o) => isOpen(o) && Number(o.total_due ?? 0) > Number(o.paid_amount ?? 0);
const isReadOnly  = (o) => isPaid(o) || isCancelled(o) || isRefunded(o);

// ordre logique
const STATUS_ORDER = ["OPEN", "HOLD", "PAID", "CANCELLED", "REFUNDED"];
const statusRank = (s) => {
    const up = String(s || "").toUpperCase();
    const idx = STATUS_ORDER.indexOf(up);
    return idx === -1 ? STATUS_ORDER.length + 1 : idx;
};

export default function Orders() {
    const navigate = useNavigate();
    const RESTAURANT_ID = useSelector(s => s.user.activeRestaurantId);

    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [checkoutOrder, setCheckoutOrder] = useState(null);

    // Filtre “Aujourd’hui / Toutes”
    const [todayOnly, setTodayOnly] = useState(true);

    // Tri
    const [sortBy, setSortBy]   = useState("id");
    const [sortDir, setSortDir] = useState("desc");

    const reload = async () => {
        setLoading(true);
        setError("");

        try {
            // Si aucun resto sélectionné: on vide
            if (!RESTAURANT_ID) {
                setOrders([]);
                return;
            }
            const params = { restaurant: RESTAURANT_ID };
            if (todayOnly) params.date = new Date().toISOString().slice(0, 10);

            const data = await getOrders(params);
            setOrders(Array.isArray(data) ? data : []);
        } catch (e) {
            setError("Impossible de récupérer les commandes");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        document.title = "Veg'N Bio | Commandes";
    }, []);

    // charge au montage & quand RESTAURANT_ID change
    useEffect(() => { reload(); /* eslint-disable-next-line */ }, [RESTAURANT_ID]);

    // recharge quand on change Aujourd’hui/Toutes
    useEffect(() => { reload(); /* eslint-disable-next-line */ }, [todayOnly]);

    const doAndReload = async (p) => { await p; await reload(); };

    const toggleSort = (col) => {
        if (col === sortBy) setSortDir(d => (d === "asc" ? "desc" : "asc"));
        else { setSortBy(col); setSortDir(col === "id" ? "desc" : "asc"); }
    };

    const sortedOrders = useMemo(() => {
        const arr = Array.isArray(orders) ? [...orders] : [];
        const dir = sortDir === "asc" ? 1 : -1;

        arr.sort((a, b) => {
            if (sortBy === "id") return (Number(a.id ?? 0) - Number(b.id ?? 0)) * dir;
            if (sortBy === "status") {
                const ar = statusRank(a.status), br = statusRank(b.status);
                if (ar !== br) return (ar - br) * dir;
                return String(a.status || "").localeCompare(String(b.status || "")) * dir;
            }
            if (sortBy === "total_due")
                return (Number(a.total_due ?? 0) - Number(b.total_due ?? 0)) * dir;
            if (sortBy === "paid_amount")
                return (Number(a.paid_amount ?? 0) - Number(b.paid_amount ?? 0)) * dir;
            return 0;
        });
        return arr;
    }, [orders, sortBy, sortDir]);

    const Arrow = ({ active, dir }) => (
        <span className={`ml-1 inline-block text-xs transition-opacity ${active ? "opacity-100" : "opacity-40"}`}>
      {active ? (dir === "asc" ? "↑" : "↓") : "↕"}
    </span>
    );

    const SortHeader = ({ col, children }) => {
        const active = sortBy === col;
        return (
            <button type="button" onClick={() => toggleSort(col)} className="inline-flex items-center gap-1 hover:underline" title="Trier">
                <span>{children}</span>
                <Arrow active={active} dir={active ? sortDir : undefined} />
            </button>
        );
    };

    const FilterSegment = () => (
        <div className="inline-flex rounded-lg overflow-hidden border border-[#2a2a2a]">
            <button
                className={`px-3 py-1.5 text-sm ${todayOnly ? "bg-emerald-600/20 text-emerald-300" : "bg-[#1a1a1a] hover:bg-[#151515] opacity-90"}`}
                onClick={() => setTodayOnly(true)}
            >Aujourd’hui</button>
            <button
                className={`px-3 py-1.5 text-sm ${!todayOnly ? "bg-emerald-600/20 text-emerald-300" : "bg-[#1a1a1a] hover:bg-[#151515] opacity-90"}`}
                onClick={() => setTodayOnly(false)}
            >Toutes</button>
        </div>
    );

    return (
        <section className="p-8">
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-xl font-semibold">Commandes</h1>
                <FilterSegment />
            </div>

            {!RESTAURANT_ID && (
                <div className="mb-4 text-amber-300">Sélectionnez un restaurant dans l’entête pour afficher les commandes.</div>
            )}

            {loading ? (
                <div>Chargement…</div>
            ) : error ? (
                <div className="text-red-400">{error}</div>
            ) : (
                <div className="overflow-auto border border-[#2a2a2a] rounded">
                    <table className="w-full text-sm">
                        <thead className="bg-[#151515]">
                        <tr>
                            <th className="text-left p-3"><SortHeader col="id">#</SortHeader></th>
                            <th className="text-left p-3"><SortHeader col="status">Statut</SortHeader></th>
                            <th className="text-left p-3"><SortHeader col="total_due">Total dû</SortHeader></th>
                            <th className="text-left p-3"><SortHeader col="paid_amount">Payé</SortHeader></th>
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
                            const btnBase = "px-2 py-1 rounded disabled:opacity-40 disabled:cursor-not-allowed";

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
                                            <button className={`${btnBase} bg-amber-600/80 hover:bg-amber-600`} disabled={!_canHold}
                                                    onClick={(e) => { e.stopPropagation(); doAndReload(hold(o.id)); }}>Hold</button>
                                            <button className={`${btnBase} bg-sky-600/80 hover:bg-sky-600`} disabled={!_canReopen}
                                                    onClick={(e) => { e.stopPropagation(); doAndReload(reopen(o.id)); }}>Reopen</button>
                                            <button className={`${btnBase} bg-rose-600/80 hover:bg-rose-600`} disabled={!_canCancel}
                                                    onClick={(e) => { e.stopPropagation(); doAndReload(cancelOrder(o.id)); }}>Annuler</button>
                                            <button className={`${btnBase} bg-emerald-600/80 hover:bg-emerald-600`} disabled={!_canCheckout}
                                                    onClick={(e) => { e.stopPropagation(); setCheckoutOrder(o); }}>Encaisser</button>
                                            <button className={`${btnBase} bg-zinc-700 hover:bg-zinc-600`}
                                                    onClick={async (e) => { e.stopPropagation(); const { data } = await ticket(o.id); alert(JSON.stringify(data, null, 2)); }}>
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
                                    {todayOnly ? "Aucune commande aujourd’hui." : "Aucune commande."}
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
                onSuccess={async () => { setCheckoutOrder(null); await reload(); }}
            />
        </section>
    );
}
