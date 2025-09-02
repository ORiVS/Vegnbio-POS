// src/components/restaurant/pages/Dashboard.jsx
import { useEffect, useState } from "react";
import { apiGetAvailability } from "../api";
import useActiveRestaurantId from "../hooks/useActiveRestaurantId";

function todayISO() { return new Date().toISOString().slice(0, 10); }
function Loading(){return <div className="p-4 text-sm opacity-70">Chargement…</div>;}
function ErrorMsg({error}){return <div className="p-3 bg-red-600/10 text-red-400 rounded">{String(error)}</div>;}

export default function Dashboard() {
    const restaurantId = useActiveRestaurantId();
    const [date, setDate] = useState(todayISO());
    const [data, setData] = useState(null);
    const [loading,setLoading] = useState(false);
    const [err,setErr] = useState(null);

    useEffect(() => {
        if (!restaurantId || !date) return;
        let alive = true;
        setLoading(true); setErr(null);
        apiGetAvailability(restaurantId, date)
            .then((d) => { if(alive){ setData(d);} })
            .catch((e) => { if(alive){ setErr(e.message);} })
            .finally(()=> alive && setLoading(false));
        return ()=>{alive=false};
    }, [restaurantId, date]);

    return (
        <div className="p-6 space-y-6">
            <h1 className="text-2xl font-semibold">Tableau de bord</h1>

            <div className="flex items-center gap-3">
                <label className="text-sm">Date:</label>
                <input type="date" className="border rounded px-2 py-1 bg-white text-black"
                       value={date} onChange={(e)=>setDate(e.target.value)} />
            </div>

            {!restaurantId && <ErrorMsg error={"Sélectionne d’abord un restaurant dans l’en-tête."} />}
            {loading && <Loading />}
            {err && <ErrorMsg error={err} />}

            {data && (
                <>
                    <div className="grid gap-4 md:grid-cols-3">
                        <Metric title="Réservations du jour" value={sumReservations(data.rooms)} />
                        <Metric title="Évènements du jour" value={data.evenements?.length || 0} />
                        <Metric title="Salles" value={data.rooms?.length || 0} />
                    </div>

                    <section className="bg-white text-black rounded-2xl p-4 border">
                        <h2 className="font-medium mb-3">Salles — {data.date}</h2>
                        <div className="grid md:grid-cols-3 gap-4">
                            {data.rooms?.map((r) => (
                                <div key={r.room} className="rounded-xl border p-3">
                                    <div className="font-medium">{r.room} • {r.capacity} places</div>
                                    <div className="text-sm opacity-70">{r.reservations?.length || 0} réservations</div>
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
