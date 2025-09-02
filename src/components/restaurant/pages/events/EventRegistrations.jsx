// src/components/restaurant/pages/events/EventRegistrations.jsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiGetRegistrations } from "../../api";

function Loading(){return <div className="p-4 text-sm opacity-70">Chargement…</div>;}
function ErrorMsg({error}){return <div className="p-3 bg-red-600/10 text-red-400 rounded">{String(error)}</div>;}
function Empty({children}){return <div className="p-3 opacity-60">{children}</div>;}

export default function EventRegistrations(){
    const { id } = useParams();
    const [data,setData] = useState(null);
    const [loading,setLoading] = useState(false);
    const [err,setErr] = useState(null);

    useEffect(()=>{
        let alive=true;
        setLoading(true); setErr(null);
        apiGetRegistrations(Number(id))
            .then((d)=> alive && setData(d))
            .catch((e)=> alive && setErr(e.message))
            .finally(()=> alive && setLoading(false));
        return ()=>{alive=false};
    },[id]);

    return (
        <div className="p-6 space-y-4">
            <h1 className="text-2xl font-semibold">Inscriptions — évènement #{id}</h1>
            {err && <ErrorMsg error={err}/>}
            {loading && <Loading/>}

            {data && ("registrations" in data) ? (
                <div className="bg-white text-black border rounded-2xl p-4">
                    <div className="mb-2 text-sm opacity-70">
                        {data.count} inscription(s)
                    </div>
                    {data.registrations?.length ? (
                        <table className="w-full text-sm">
                            <thead>
                            <tr className="text-left border-b">
                                <th className="py-2">Utilisateur</th>
                                <th>Email</th>
                                <th>Inscrit le</th>
                            </tr>
                            </thead>
                            <tbody>
                            {data.registrations.map((r)=>(
                                <tr key={r.id} className="border-b last:border-0">
                                    <td>{r.user_first_name} {r.user_last_name} (#{r.user_id})</td>
                                    <td>{r.user_email}</td>
                                    <td>{new Date(r.created_at).toLocaleString()}</td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    ) : <Empty>Aucune inscription.</Empty>}
                </div>
            ) : data ? (
                <div className="bg-white text-black border rounded-2xl p-4">
                    <div className="font-medium mb-2">{data.count} inscription(s)</div>
                    <div className="text-sm">Vous : {data.me?.registered ? "inscrit" : "non inscrit"}</div>
                </div>
            ) : null}
        </div>
    );
}
