// src/components/restaurant/pages/Dashboard.jsx
import { useEffect, useMemo, useState } from "react";
import { apiGetAvailability } from "../api";
import useActiveRestaurantId from "../hooks/useActiveRestaurantId";

function todayISO() { return new Date().toISOString().slice(0, 10); }
function addDays(iso, n) {
    const d = new Date(iso); d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
}
function rangeDates(fromISO, toISO) {
    const out = [];
    let cur = fromISO;
    while (cur <= toISO) { out.push(cur); cur = addDays(cur, 1); }
    return out;
}
function Loading(){return <div className="p-4 text-sm opacity-70">Chargement…</div>;}
function ErrorMsg({error}){return <div className="p-3 bg-red-600/10 text-red-400 rounded">{String(error)}</div>;}

export default function Dashboard() {
    const restaurantId = useActiveRestaurantId();

    // --- UI state
    const [mode, setMode] = useState("day"); // "day" | "range"
    const [date, setDate] = useState(todayISO());
    const [from, setFrom] = useState(todayISO());
    const [to, setTo] = useState(todayISO());

    // --- Data state (vue normalisée pour l’affichage)
    const [view, setView] = useState(null);
    const [loading,setLoading] = useState(false);
    const [err,setErr] = useState(null);

    // Libellé d’en-tête (jour ou période)
    const headerLabel = useMemo(() => {
        return mode === "day" ? date : `Du ${from} au ${to}`;
    }, [mode, date, from, to]);

    useEffect(() => {
        if (!restaurantId) return;

        async function loadDay(d) {
            const res = await apiGetAvailability(restaurantId, d);
            // Normaliser pour l’affichage (jour)
            return {
                header: res.date,
                rooms: (res.rooms || []).map(r => ({
                    room: r.room,
                    capacity: r.capacity,
                    count: (r.reservations || []).length,
                })),
                totalReservations: sumReservations(res.rooms),
                eventsCount: res.evenements?.length || 0,
                roomsCount: res.rooms?.length || 0,
            };
        }

        async function loadRange(f, t) {
            // validations basiques
            if (f > t) throw new Error("La date de début doit être avant la date de fin.");
            const dates = rangeDates(f, t);
            if (dates.length > 31) throw new Error("Période trop longue (max 31 jours).");

            const all = await Promise.all(dates.map(d => apiGetAvailability(restaurantId, d)));

            // Agrégations
            let totalReservations = 0;
            let eventsCount = 0;
            const roomMap = new Map(); // key: room name → { room, capacity, count }

            for (const day of all) {
                totalReservations += sumReservations(day.rooms);
                eventsCount += (day.evenements?.length || 0);

                (day.rooms || []).forEach(r => {
                    const key = r.room;
                    const prev = roomMap.get(key) || { room: r.room, capacity: r.capacity, count: 0 };
                    prev.count += (r.reservations?.length || 0);
                    // garder la dernière capacity connue (ou la max)
                    prev.capacity = Math.max(prev.capacity || 0, r.capacity || 0);
                    roomMap.set(key, prev);
                });
            }

            const roomsAgg = Array.from(roomMap.values()).sort((a,b)=> b.count - a.count);

            return {
                header: `Du ${f} au ${t}`,
                rooms: roomsAgg,
                totalReservations,
                eventsCount,
                roomsCount: roomsAgg.length,
            };
        }

        let alive = true;
        setLoading(true); setErr(null); setView(null);

        (async () => {
            try {
                const v = (mode === "day")
                    ? await loadDay(date)
                    : await loadRange(from, to);
                if (alive) setView(v);
            } catch (e) {
                if (alive) setErr(e.message || String(e));
            } finally {
                if (alive) setLoading(false);
            }
        })();

        return () => { alive = false; };
    }, [restaurantId, mode, date, from, to]);

    return (
        <div className="p-6 space-y-6">
            <h1 className="text-2xl font-semibold">Tableau de bord</h1>

            {/* Filtres date/période */}
            <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                    <span className="text-sm opacity-80">Mode :</span>
                    <div className="inline-flex rounded-xl overflow-hidden border">
                        <button
                            type="button"
                            className={`px-3 py-2 ${mode === "day" ? "bg-emerald-600 text-white" : "bg-white text-black"}`}
                            onClick={() => setMode("day")}
                        >
                            Jour
                        </button>
                        <button
                            type="button"
                            className={`px-3 py-2 ${mode === "range" ? "bg-emerald-600 text-white" : "bg-white text-black"}`}
                            onClick={() => setMode("range")}
                        >
                            Période
                        </button>
                    </div>
                </div>

                {mode === "day" ? (
                    <div className="flex items-center gap-2">
                        <label className="text-sm">Date :</label>
                        <input
                            type="date"
                            className="border rounded px-2 py-1 bg-white text-black"
                            value={date}
                            onChange={(e)=>setDate(e.target.value)}
                        />
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <label className="text-sm">Du</label>
                        <input
                            type="date"
                            className="border rounded px-2 py-1 bg-white text-black"
                            value={from}
                            onChange={(e)=>setFrom(e.target.value)}
                        />
                        <label className="text-sm">au</label>
                        <input
                            type="date"
                            className="border rounded px-2 py-1 bg-white text-black"
                            value={to}
                            onChange={(e)=>setTo(e.target.value)}
                        />
                        <span className="text-xs opacity-60">(max 31 jours)</span>
                    </div>
                )}
            </div>

            {!restaurantId && <ErrorMsg error={"Sélectionne d’abord un restaurant dans l’en-tête."} />}
            {loading && <Loading />}
            {err && <ErrorMsg error={err} />}

            {view && !loading && !err && (
                <>
                    <div className="grid gap-4 md:grid-cols-3">
                        <Metric
                            title={mode === "day" ? "Réservations du jour" : "Réservations (période)"}
                            value={view.totalReservations}
                        />
                        <Metric
                            title={mode === "day" ? "Évènements du jour" : "Évènements (période)"}
                            value={view.eventsCount}
                        />
                        <Metric
                            title="Salles"
                            value={view.roomsCount}
                        />
                    </div>

                    <section className="bg-white text-black rounded-2xl p-4 border">
                        <h2 className="font-medium mb-3">Salles — {headerLabel}</h2>
                        <div className="grid md:grid-cols-3 gap-4">
                            {view.rooms.map((r) => (
                                <div key={r.room} className="rounded-xl border p-3">
                                    <div className="font-medium">{r.room} • {r.capacity} places</div>
                                    <div className="text-sm opacity-70">
                                        {r.count} réservation{r.count > 1 ? "s" : ""}
                                        {mode === "day" ? "" : " sur la période"}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </>
            )}
        </div>
    );
}

function sumReservations(rooms){
    return (rooms || []).reduce((n, r) => n + (r.reservations?.length || 0), 0);
}

function Metric({ title, value }) {
    return (
        <div className="bg-white text-black border rounded-2xl p-4">
            <div className="text-sm opacity-70">{title}</div>
            <div className="text-3xl font-semibold text-green-700">{value}</div>
        </div>
    );
}
