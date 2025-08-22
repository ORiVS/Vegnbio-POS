// src/pages/Home.jsx
import { useEffect, useState } from "react";
import { summary, getOrders } from "../https";

export default function Home(){
    const [metrics, setMetrics] = useState({ count:0, turnover:"0.00" });
    const [recent, setRecent] = useState([]);

    useEffect(()=>{
        document.title = "POS | Home";
        const today = new Date().toISOString().slice(0,10);
        const restaurant = 1; // TODO: id du resto de l'utilisateur
        summary({ restaurant, date: today }).then(r=> setMetrics(r.data));
        getOrders({ restaurant, date: today }).then(data => setRecent(data.slice(0,8)));
    },[]);

    return (
        <section className="p-8 space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Card title="Commandes du jour" value={metrics.count} />
                <Card title="Chiffre d'affaires" value={`${metrics.turnover} €`} />
                <Card title="En cours" value={recent.filter(o=>['OPEN','HOLD'].includes(o.status)).length} />
            </div>

            <div>
                <h2 className="text-lg mb-2">Dernières commandes</h2>
                <div className="border border-[#2a2a2a] rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-[#151515]"><tr>
                            <th className="text-left p-3">#</th>
                            <th className="text-left p-3">Statut</th>
                            <th className="text-left p-3">Total</th>
                            <th className="text-left p-3">Ouverte</th>
                        </tr></thead>
                        <tbody>
                        {recent.map(o => (
                            <tr key={o.id} className="border-t border-[#2a2a2a]">
                                <td className="p-3">{o.id}</td>
                                <td className="p-3">{o.status}</td>
                                <td className="p-3">{o.total_due} €</td>
                                <td className="p-3">{new Date(o.opened_at).toLocaleTimeString()}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
}
function Card({ title, value }){
    return (
        <div className="p-5 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a]">
            <div className="opacity-80 text-sm">{title}</div>
            <div className="text-2xl font-semibold">{value}</div>
        </div>
    );
}
