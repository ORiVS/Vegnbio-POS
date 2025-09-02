// src/components/restaurant/pages/events/EventInvitations.jsx
import { useParams } from "react-router-dom";
import { useState } from "react";
import { apiSendInvite, apiSendInvitesBulk } from "../../api";

function ErrorMsg({error}){return <div className="p-3 bg-red-600/10 text-red-400 rounded">{String(error)}</div>;}

export default function EventInvitations(){
    const { id } = useParams();
    const [one,setOne] = useState({ email:"", phone:"" });
    const [bulk,setBulk] = useState("");
    const [info,setInfo] = useState("");
    const [err,setErr] = useState(null);

    const sendOne = async (e)=>{
        e.preventDefault();
        setErr(null); setInfo("");
        try{
            await apiSendInvite(Number(id), { email: one.email || undefined, phone: one.phone || undefined });
            setInfo("Invitation envoyée.");
            setOne({email:"", phone:""});
        }catch(e){ setErr(e.message); }
    };

    const sendBulk = async (e)=>{
        e.preventDefault();
        setErr(null); setInfo("");
        try{
            const emails = bulk.split(/\s|,|;|\n/).map(s=>s.trim()).filter(Boolean);
            await apiSendInvitesBulk(Number(id), emails);
            setInfo(`${emails.length} invitations envoyées.`);
            setBulk("");
        }catch(e){ setErr(e.message); }
    };

    return (
        <div className="p-6 space-y-6">
            <h1 className="text-2xl font-semibold">Invitations — évènement #{id}</h1>
            {err && <ErrorMsg error={err}/>}
            {info && <div className="p-2 bg-emerald-600/10 text-emerald-400 rounded">{info}</div>}

            <section className="bg-white text-black border rounded-2xl p-4">
                <h2 className="font-medium mb-2">Inviter 1 contact</h2>
                <form onSubmit={sendOne} className="grid md:grid-cols-3 gap-3">
                    <label className="text-sm">
                        <div className="opacity-70 mb-1">Email</div>
                        <input type="email" className="border rounded px-2 py-1 w-full" value={one.email}
                               onChange={(e)=> setOne(o=>({...o, email:e.target.value}))}/>
                    </label>
                    <label className="text-sm">
                        <div className="opacity-70 mb-1">Téléphone (optionnel)</div>
                        <input type="text" className="border rounded px-2 py-1 w-full" value={one.phone}
                               onChange={(e)=> setOne(o=>({...o, phone:e.target.value}))}/>
                    </label>
                    <div className="flex items-end">
                        <button className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500">Envoyer</button>
                    </div>
                </form>
            </section>

            <section className="bg-white text-black border rounded-2xl p-4">
                <h2 className="font-medium mb-2">Invitations en masse</h2>
                <form onSubmit={sendBulk} className="space-y-2">
          <textarea rows={6} className="border rounded px-2 py-1 w-full"
                    placeholder="email1@x.com, email2@y.com, ... (séparés par virgule, espace ou retour ligne)"
                    value={bulk} onChange={(e)=> setBulk(e.target.value)}/>
                    <button className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500">Envoyer</button>
                </form>
            </section>
        </div>
    );
}
