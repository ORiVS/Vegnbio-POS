// src/components/restaurant/pages/settings/RestaurantSettings.jsx
import { useEffect, useState } from "react";
import useActiveRestaurantId from "../../hooks/useActiveRestaurantId";
import { apiGetRestaurant, apiUpdateRestaurant } from "../../api";

function Loading(){return <div className="p-4 text-sm opacity-70">Chargement…</div>;}

// -------- Helpers erreurs: extrait les messages utiles depuis l’objet d’erreur (DRF, string, etc.)
function extractApiErrors(error) {
    const out = [];
    if (!error) return out;

    // string directe
    if (typeof error === "string") return [error];

    const data = error?.data;

    // 1) texte brut
    if (typeof data === "string" && data.trim()) out.push(data.trim());

    // 2) tableau racine
    if (Array.isArray(data)) {
        data.forEach((v) => out.push(typeof v === "string" ? v : JSON.stringify(v)));
    }

    // 3) objet DRF { detail, non_field_errors, field:[...], ... }
    if (data && typeof data === "object" && !Array.isArray(data)) {
        const pushVal = (label, val) => {
            if (val == null) return;
            if (Array.isArray(val)) {
                val.forEach((v) =>
                    out.push(label ? `${label}: ${typeof v === "string" ? v : JSON.stringify(v)}` : String(v))
                );
            } else if (typeof val === "object") {
                try {
                    out.push(label ? `${label}: ${JSON.stringify(val)}` : JSON.stringify(val));
                } catch {
                    out.push(label ? `${label}: ${String(val)}` : String(val));
                }
            } else {
                out.push(label ? `${label}: ${String(val)}` : String(val));
            }
        };

        if (data.detail) pushVal("", data.detail);
        if (data.error) pushVal("", data.error);
        if (data.non_field_errors) pushVal("", data.non_field_errors);

        Object.entries(data).forEach(([k, v]) => {
            if (["detail", "error", "non_field_errors"].includes(k)) return;
            pushVal(k, v);
        });
    }

    if (out.length === 0 && error?.message) out.push(String(error.message));
    if (out.length === 0) out.push(String(error));

    return out;
}

function ErrorMsg({ error, onClose }) {
    const msgs = extractApiErrors(error);
    const status = error?.status;
    return (
        <div className="p-3 bg-red-600/10 text-red-400 rounded text-sm space-y-2">
            <div className="flex items-start justify-between gap-3">
                <div className="font-medium">{status ? `Erreur ${status}` : `Erreur`}</div>
                {onClose && (
                    <button
                        type="button"
                        className="opacity-70 hover:opacity-100 underline"
                        onClick={onClose}
                    >
                        fermer
                    </button>
                )}
            </div>
            <ul className="list-disc pl-5 space-y-1">
                {msgs.map((m, i) => (
                    <li key={i}>{m}</li>
                ))}
            </ul>
        </div>
    );
}

// Récupère les erreurs spécifiques à un champ (ex: "name", "capacity", ...)
function fieldErrors(err, field) {
    const d = err?.data;
    if (!d || typeof d !== "object") return [];
    const val = d[field];
    if (!val) return [];
    if (Array.isArray(val)) return val.map((v) => String(v));
    return [String(val)];
}

function FieldErrors({ errors }) {
    if (!errors?.length) return null;
    return (
        <ul className="mt-1 text-xs text-red-500 list-disc pl-5">
            {errors.map((m, i) => (
                <li key={i}>{m}</li>
            ))}
        </ul>
    );
}

export default function RestaurantSettings(){
    const restaurantId = useActiveRestaurantId();
    const [loading,setLoading]=useState(false);
    const [saving,setSaving]=useState(false);
    const [err,setErr]=useState(null);
    const [info,setInfo]=useState("");
    const [f,setF] = useState({
        name:"", address:"", city:"", postal_code:"", capacity:"",
        wifi_available:true, printer_available:true,
        member_trays_available:false, delivery_trays_available:false,
        animations_enabled:false, animation_day:"",
    });

    const load = ()=>{
        if(!restaurantId) return;
        setLoading(true); setErr(null); setInfo("");
        apiGetRestaurant(restaurantId)
            .then(d=> setF({
                name:d.name||"", address:d.address||"", city:d.city||"", postal_code:d.postal_code||"",
                capacity:d.capacity ?? "", wifi_available:!!d.wifi_available, printer_available:!!d.printer_available,
                member_trays_available:!!d.member_trays_available, delivery_trays_available:!!d.delivery_trays_available,
                animations_enabled:!!d.animations_enabled, animation_day:d.animation_day || "",
            }))
            .catch(e=> setErr(e)) // ⬅️ garder l’objet complet
            .finally(()=> setLoading(false));
    };

    useEffect(()=>{ load(); /* eslint-disable-next-line */ },[restaurantId]);

    const onSave = async (e)=>{
        e.preventDefault();
        setSaving(true); setErr(null); setInfo("");
        try{
            await apiUpdateRestaurant(restaurantId, {
                ...f,
                capacity: f.capacity === "" ? 0 : Number(f.capacity),
                animation_day: f.animation_day || null,
            });
            setInfo("Enregistré.");
        }catch(e){ setErr(e); } // ⬅️ garder l’objet complet pour afficher toutes les erreurs
        finally{ setSaving(false); }
    };

    // erreurs par champ (affichées sous les inputs)
    const nameErr = fieldErrors(err, "name");
    const capacityErr = fieldErrors(err, "capacity");
    const addressErr = fieldErrors(err, "address");
    const cityErr = fieldErrors(err, "city");
    const postalErr = fieldErrors(err, "postal_code");
    const wifiErr = fieldErrors(err, "wifi_available");
    const printerErr = fieldErrors(err, "printer_available");
    const memberTraysErr = fieldErrors(err, "member_trays_available");
    const deliveryTraysErr = fieldErrors(err, "delivery_trays_available");
    const animationsEnabledErr = fieldErrors(err, "animations_enabled");
    const animationDayErr = fieldErrors(err, "animation_day");

    return (
        <div className="p-6 space-y-4">
            <h1 className="text-2xl font-semibold">Paramètres du restaurant</h1>
            {!restaurantId && <ErrorMsg error={"Sélectionne un restaurant."}/>}
            {err && <ErrorMsg error={err} onClose={()=>setErr(null)} />}
            {loading && <Loading/>}

            <form onSubmit={onSave} className="bg-white text-black border rounded-2xl p-4 grid md:grid-cols-2 gap-4">
                <Field label="Nom">
                    <input
                        className="border rounded px-2 py-1 w-full"
                        value={f.name}
                        onChange={(e)=> setF(v=>({...v,name:e.target.value}))}
                    />
                    <FieldErrors errors={nameErr} />
                </Field>

                <Field label="Capacité">
                    <input
                        type="number"
                        className="border rounded px-2 py-1 w-full"
                        value={f.capacity}
                        onChange={(e)=> setF(v=>({...v,capacity:e.target.value}))}
                    />
                    <FieldErrors errors={capacityErr} />
                </Field>

                <Field label="Adresse" full>
                    <input
                        className="border rounded px-2 py-1 w-full"
                        value={f.address}
                        onChange={(e)=> setF(v=>({...v,address:e.target.value}))}
                    />
                    <FieldErrors errors={addressErr} />
                </Field>

                <Field label="Ville">
                    <input
                        className="border rounded px-2 py-1 w-full"
                        value={f.city}
                        onChange={(e)=> setF(v=>({...v,city:e.target.value}))}
                    />
                    <FieldErrors errors={cityErr} />
                </Field>

                <Field label="Code postal">
                    <input
                        className="border rounded px-2 py-1 w-full"
                        value={f.postal_code}
                        onChange={(e)=> setF(v=>({...v,postal_code:e.target.value}))}
                    />
                    <FieldErrors errors={postalErr} />
                </Field>

                <div className="md:col-span-2 grid md:grid-cols-2 gap-3">
                    <div>
                        <Toggle label="Wi-Fi" v={f.wifi_available} onChange={(v)=> setF(s=>({...s,wifi_available:v}))}/>
                        <FieldErrors errors={wifiErr} />
                    </div>
                    <div>
                        <Toggle label="Imprimante" v={f.printer_available} onChange={(v)=> setF(s=>({...s,printer_available:v}))}/>
                        <FieldErrors errors={printerErr} />
                    </div>
                    <div>
                        <Toggle label="Plateaux membres" v={f.member_trays_available} onChange={(v)=> setF(s=>({...s,member_trays_available:v}))}/>
                        <FieldErrors errors={memberTraysErr} />
                    </div>
                    <div>
                        <Toggle label="Plateaux livrables" v={f.delivery_trays_available} onChange={(v)=> setF(s=>({...s,delivery_trays_available:v}))}/>
                        <FieldErrors errors={deliveryTraysErr} />
                    </div>
                    <div>
                        <Toggle label="Animations" v={f.animations_enabled} onChange={(v)=> setF(s=>({...s,animations_enabled:v}))}/>
                        <FieldErrors errors={animationsEnabledErr} />
                    </div>
                    <Field label="Jour des animations">
                        <input
                            className="border rounded px-2 py-1 w-full"
                            value={f.animation_day ?? ""}
                            onChange={(e)=> setF(v=>({...v,animation_day:e.target.value}))}
                        />
                        <FieldErrors errors={animationDayErr} />
                    </Field>
                </div>

                <div className="md:col-span-2 flex gap-2">
                    <button
                        disabled={saving}
                        className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
                    >
                        {saving ? "Enregistrement…" : "Enregistrer"}
                    </button>
                    <button type="button" className="px-3 py-2 rounded border" onClick={load}>Annuler</button>
                    {info && <span className="text-emerald-400">{info}</span>}
                </div>
            </form>
        </div>
    );
}

function Field({label, children, full}){
    return (
        <label className={`text-sm ${full ? "md:col-span-2" : ""}`}>
            <div className="opacity-70 mb-1">{label}</div>
            {children}
        </label>
    );
}
function Toggle({label,v,onChange}){
    return (
        <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!v} onChange={(e)=> onChange(e.target.checked)} />
            {label}
        </label>
    );
}
