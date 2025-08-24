import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { getOrders, ticket, summary } from "../https";
import { fmt, toNum } from "../utils/money";

const todayISO = () => new Date().toISOString().slice(0, 10);

// util
function enumerateDates(startISO, endISO) {
  const out = [];
  const start = new Date(startISO + "T00:00:00");
  const end = new Date(endISO + "T00:00:00");
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

// agrégations locale
function aggregateFromOrdersBase(orders, base) {
  const safe = Array.isArray(orders) ? orders : [];
  const kpis = {
    ordersCount: safe.length,
    revenue: 0,
    totalDueSum: 0,
    avgTicket: 0,
    statusCounts: { OPEN:0, HOLD:0, PAID:0, CANCELLED:0, REFUNDED:0, OTHER:0 },
  };
  for (const o of safe) {
    const s = String(o.status || "OTHER").toUpperCase();
    if (kpis.statusCounts[s] == null) kpis.statusCounts[s] = 0;
    kpis.statusCounts[s]++;
    const due  = Number(o.total_due ?? 0);
    const paid = Number(o.paid_amount ?? 0);
    kpis.totalDueSum += due;
    kpis.revenue     += base === "paid" ? paid : due;
  }
  kpis.avgTicket = kpis.ordersCount ? kpis.totalDueSum / kpis.ordersCount : 0;
  return kpis;
}

function seriesFromOrdersBase(orders, startISO, endISO, base) {
  const sameDay = startISO === endISO;
  const safe = Array.isArray(orders) ? orders : [];
  const map = new Map();

  safe.forEach((o) => {
    const dt = o.opened_at || o.created_at || o.date || null;
    const key = sameDay
        ? (dt ? `${new Date(dt).getHours().toString().padStart(2,"0")}:00` : "--:--")
        : (dt ? String(dt).slice(0,10) : "----");
    const val = base === "paid" ? Number(o.paid_amount ?? 0) : Number(o.total_due ?? 0);
    map.set(key, (map.get(key) || 0) + val);
  });

  const out = [];
  if (sameDay) {
    for (let h = 0; h < 24; h++) {
      const k = `${String(h).padStart(2, "0")}:00`;
      out.push({ x: k, y: Number(map.get(k) || 0) });
    }
  } else {
    enumerateDates(startISO, endISO).forEach((d) => {
      out.push({ x: d, y: Number(map.get(d) || 0) });
    });
  }
  return out;
}

// Top plats
async function computeTopDishes(orders, maxOrdersForTop = 60) {
  const list = Array.isArray(orders) ? orders.slice(0, maxOrdersForTop) : [];
  const counter = new Map();

  const results = await Promise.allSettled(list.map((o) => ticket(o.id)));
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    const data = r.value?.data || {};
    const items = Array.isArray(data.items) ? data.items : [];
    for (const it of items) {
      const name = it.label || it.name || it.dish_name || "Article";
      const qty = toNum(it.qty ?? it.quantity ?? 1);
      const lineTotal = toNum(it.line_total ?? (toNum(it.unit_price) * qty));
      const entry = counter.get(name) || { qty: 0, revenue: 0 };
      entry.qty += qty;
      entry.revenue += lineTotal;
      counter.set(name, entry);
    }
  }
  const arr = [...counter.entries()].map(([label, v]) => ({ label, qty: v.qty, revenue: v.revenue }));
  arr.sort((a, b) => b.qty - a.qty || b.revenue - a.revenue);
  return arr.slice(0, 10);
}

// Barre simple
function BarRow({ label, value, max }) {
  const ratio = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
      <div className="mb-2">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="truncate pr-2">{label}</span>
          <span className="opacity-80">{fmt(value)}</span>
        </div>
        <div className="h-2 bg-[#111] rounded">
          <div className="h-2 bg-emerald-600 rounded" style={{ width: `${ratio}%` }} />
        </div>
      </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const RESTAURANT_ID = useSelector(s => s.user.activeRestaurantId);

  const [start, setStart] = useState(todayISO());
  const [end, setEnd]     = useState(todayISO());
  const [base, setBase]   = useState("paid"); // "paid" | "due"

  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState("");
  const [orders, setOrders]     = useState([]);
  const [kpis, setKpis]         = useState(null);
  const [series, setSeries]     = useState([]);
  const [topDishes, setTopDishes] = useState([]);

  const liveOrders = useMemo(
      () => orders.filter(o => ["OPEN","HOLD"].includes(String(o.status||"").toUpperCase())),
      [orders]
  );

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      if (!RESTAURANT_ID) {
        setOrders([]); setKpis(null); setSeries([]); setTopDishes([]);
        return;
      }
      const sameDay = start === end;

      if (sameDay) {
        const date = start;
        // summary
        let k = { ordersCount: 0, revenue: 0, totalDueSum: 0, avgTicket: 0, statusCounts: {} };
        try {
          const r = await summary({ restaurant: RESTAURANT_ID, date });
          const s = r?.data || {};
          const count = Number(s.count ?? s.orders_count ?? 0);
          const turnover = Number(s.turnover ?? s.total_due ?? s.revenue ?? 0);
          k.ordersCount = count;
          k.revenue     = base === "paid" ? Number(s.total_paid ?? 0) : turnover;
          k.totalDueSum = Number(s.total_due ?? turnover);
          k.avgTicket   = count ? k.totalDueSum / count : 0;
          k.statusCounts = s.status_counts || {};
        } catch {/* ignore */}

        const list = await getOrders({ restaurant: RESTAURANT_ID, date });
        setOrders(Array.isArray(list) ? list : []);

        const summaryEmpty = !k.ordersCount && !k.revenue && (!k.statusCounts || Object.keys(k.statusCounts).length===0);
        if (summaryEmpty) k = aggregateFromOrdersBase(list, base);

        setKpis(k);
        setSeries(seriesFromOrdersBase(list, start, end, base));
        setTopDishes(await computeTopDishes(list, 60));
      } else {
        const dates = enumerateDates(start, end);
        const allOrders = [];
        for (const d of dates) {
          const list = await getOrders({ restaurant: RESTAURANT_ID, date: d });
          if (Array.isArray(list)) allOrders.push(...list);
        }
        setOrders(allOrders);
        setKpis(aggregateFromOrdersBase(allOrders, base));
        setSeries(seriesFromOrdersBase(allOrders, start, end, base));
        setTopDishes(await computeTopDishes(allOrders, 60));
      }
    } catch (e) {
      setErr("Impossible de charger le dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { document.title = "Veg'N Bio | Dashboard"; }, []);
  // recharge au montage & quand filtres OU RESTAURANT_ID changent
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [start, end, base, RESTAURANT_ID]);

  const sameDay = start === end;

  return (
      <section className="p-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <div className="flex items-center gap-2">
            <button className="px-3 py-2 rounded bg-[#2a2a2a] hover:bg-[#333]"
                    onClick={() => { const t = todayISO(); setStart(t); setEnd(t); }}>Aujourd’hui</button>
            <button className="px-3 py-2 rounded bg-[#2a2a2a] hover:bg-[#333]"
                    onClick={() => { const t=new Date(); const e=t.toISOString().slice(0,10); t.setDate(t.getDate()-6); const s=t.toISOString().slice(0,10); setStart(s); setEnd(e); }}>7 jours</button>
            <button className="px-3 py-2 rounded bg-[#2a2a2a] hover:bg-[#333]"
                    onClick={() => { const t=new Date(); const e=t.toISOString().slice(0,10); t.setDate(t.getDate()-29); const s=t.toISOString().slice(0,10); setStart(s); setEnd(e); }}>30 jours</button>
            <div className="flex items-center gap-1">
              <input type="date" className="bg-[#111] px-2 py-1 rounded border border-[#2a2a2a]" value={start} onChange={(e)=>setStart(e.target.value)} />
              <span className="opacity-70">→</span>
              <input type="date" className="bg-[#111] px-2 py-1 rounded border border-[#2a2a2a]" value={end} onChange={(e)=>setEnd(e.target.value)} />
            </div>
            <div className="ml-3 flex items-center gap-1">
              <button
                  className={`px-2 py-1 rounded border ${base==="paid" ? "border-emerald-500 bg-emerald-600/20" : "border-[#2a2a2a]"}`}
                  onClick={()=>setBase("paid")}
                  title="Basé sur paid_amount (encaissé)"
              >Encaissé</button>
              <button
                  className={`px-2 py-1 rounded border ${base==="due" ? "border-emerald-500 bg-emerald-600/20" : "border-[#2a2a2a]"}`}
                  onClick={()=>setBase("due")}
                  title="Basé sur total_due (facturé)"
              >Total dû</button>
            </div>
          </div>
        </div>

        {!RESTAURANT_ID && (
            <div className="text-amber-300">Sélectionnez un restaurant dans l’entête pour charger les données.</div>
        )}

        {loading ? (
            <div>Chargement…</div>
        ) : err ? (
            <div className="text-red-400">{err}</div>
        ) : (
            <>
              <div className="grid md:grid-cols-4 gap-3">
                <KpiCard title="CA" value={fmt(kpis?.revenue || 0)} />
                <KpiCard title="Nb commandes" value={String(kpis?.ordersCount || 0)} />
                <KpiCard title="Ticket moyen" value={fmt(kpis?.avgTicket || 0)} />
                <KpiCard title="Taux d’encaissement" value={`${calcRate(kpis)}%`} sub="PAID / Total" />
              </div>

              <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 border border-[#2a2a2a] rounded-lg p-4 bg-[#1a1a1a]">
                  <div className="text-sm opacity-80 mb-3">
                    {sameDay ? (base==="paid" ? "CA encaissé par heure" : "Total dû par heure")
                        : (base==="paid" ? "CA encaissé par jour" : "Total dû par jour")}
                  </div>
                  <div className="space-y-2 max-h-[300px] overflow-auto pr-1">
                    {series.map((p) => (
                        <BarRow key={p.x} label={p.x} value={p.y} max={Math.max(...series.map(s=>s.y), 1)} />
                    ))}
                    {series.length === 0 && <div className="text-sm opacity-60">Aucune donnée.</div>}
                  </div>
                </div>

                <div className="border border-[#2a2a2a] rounded-lg p-4 bg-[#1a1a1a]">
                  <div className="text-sm opacity-80 mb-3">Répartition statuts</div>
                  <div className="space-y-2">
                    {Object.entries(kpis?.statusCounts || {}).map(([s, n]) => (
                        <StatusRow key={s} status={s} count={n} total={kpis?.ordersCount || 1} />
                    ))}
                    {(!kpis?.statusCounts || Object.keys(kpis.statusCounts).length===0) && (
                        <div className="text-sm opacity-60">Aucune commande.</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 border border-[#2a2a2a] rounded-lg p-4 bg-[#1a1a1a]">
                  <div className="text-sm opacity-80 mb-3">Top 10 plats (Qté puis CA)</div>
                  <table className="w-full text-sm">
                    <thead className="bg-[#151515]">
                    <tr>
                      <th className="text-left p-2">Plat</th>
                      <th className="text-right p-2">Qté</th>
                      <th className="text-right p-2">CA</th>
                    </tr>
                    </thead>
                    <tbody>
                    {topDishes.map((t) => (
                        <tr key={t.label} className="border-t border-[#2a2a2a]">
                          <td className="p-2">{t.label}</td>
                          <td className="p-2 text-right">{t.qty}</td>
                          <td className="p-2 text-right">{fmt(t.revenue)}</td>
                        </tr>
                    ))}
                    {topDishes.length === 0 && (
                        <tr><td className="p-3 opacity-70" colSpan={3}>Aucune vente d’articles.</td></tr>
                    )}
                    </tbody>
                  </table>
                </div>

                <div className="border border-[#2a2a2a] rounded-lg p-4 bg-[#1a1a1a]">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm opacity-80">Commandes en cours</div>
                    <button className="text-xs underline opacity-80 hover:opacity-100" onClick={() => navigate("/orders")}>
                      Voir toutes
                    </button>
                  </div>
                  <div className="space-y-2 max-h-[340px] overflow-auto pr-1">
                    {liveOrders.map((o) => (
                        <div key={o.id}
                             className="p-3 rounded border border-[#2a2a2a] bg-[#111] hover:bg-[#151515] cursor-pointer"
                             onClick={() => navigate(`/orders/${o.id}`)}>
                          <div className="flex items-center justify-between">
                            <div className="font-medium">#{o.id}</div>
                            <BadgeStatus status={o.status} />
                          </div>
                          <div className="text-sm opacity-80 mt-1">
                            Total dû {fmt(toNum(o.total_due))} — Payé {fmt(toNum(o.paid_amount))}
                          </div>
                        </div>
                    ))}
                    {liveOrders.length === 0 && (
                        <div className="text-sm opacity-60">Rien en cours.</div>
                    )}
                  </div>
                </div>
              </div>
            </>
        )}
      </section>
  );
}

// UI helpers
function KpiCard({ title, value, sub }) {
  return (
      <div className="rounded-lg border border-[#2a2a2a] p-4 bg-[#1a1a1a]">
        <div className="text-sm opacity-80">{title}</div>
        <div className="text-2xl font-semibold mt-1">{value}</div>
        {sub && <div className="text-xs opacity-60 mt-1">{sub}</div>}
      </div>
  );
}

function calcRate(kpis) {
  if (!kpis) return 0;
  const paid = (kpis.statusCounts?.PAID ?? 0);
  const total = (kpis.ordersCount ?? 0);
  return total ? Math.round((paid / total) * 100) : 0;
}

function StatusRow({ status, count, total }) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  const color = statusColor(status);
  return (
      <div className="flex items-center gap-3">
        <span className={`text-[10px] px-2 py-0.5 border rounded ${color.badge}`}>{status}</span>
        <div className="flex-1 h-2 bg-[#111] rounded overflow-hidden">
          <div className={`h-2 ${color.bar}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs w-10 text-right">{pct}%</span>
      </div>
  );
}

function BadgeStatus({ status }) {
  const color = statusColor(status);
  return (
      <span className={`text-[10px] px-2 py-0.5 border rounded ${color.badge}`}>{String(status||"").toUpperCase()}</span>
  );
}

function statusColor(s) {
  const up = String(s || "").toUpperCase();
  if (up === "PAID")       return { badge:"border-emerald-600/40 text-emerald-400 bg-emerald-600/20", bar:"bg-emerald-600" };
  if (up === "OPEN")       return { badge:"border-sky-600/40 text-sky-400 bg-sky-600/20",           bar:"bg-sky-600" };
  if (up === "HOLD")       return { badge:"border-amber-600/40 text-amber-400 bg-amber-600/20",     bar:"bg-amber-600" };
  if (up === "CANCELLED")  return { badge:"border-rose-600/40 text-rose-400 bg-rose-600/20",        bar:"bg-rose-600" };
  if (up === "REFUNDED")   return { badge:"border-zinc-500/40 text-zinc-300 bg-zinc-600/20",        bar:"bg-zinc-500" };
  return { badge:"border-zinc-600/40 text-zinc-300 bg-zinc-600/10", bar:"bg-zinc-600" };
}
