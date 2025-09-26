// src/components/restaurant/pages/events/EventsList.jsx
import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import useActiveRestaurantId from "../../hooks/useActiveRestaurantId";
import {
    apiListEvents,
    apiPublishEvent,
    apiCancelEvent,
    apiCloseEvent,
    apiReopenEvent,
    apiDeleteEvent,
} from "../../api";

/* ---------- UI helpers ---------- */
function Loading() {
    return <div className="p-4 text-sm opacity-70">Chargement…</div>;
}
function extractApiErrors(error) {
    const out = [];
    if (!error) return out;
    if (typeof error === "string") return [error];
    const data = error?.data;
    if (typeof data === "string" && data.trim()) out.push(data.trim());
    if (Array.isArray(data)) data.forEach((v) => out.push(typeof v === "string" ? v : JSON.stringify(v)));
    if (data && typeof data === "object" && !Array.isArray(data)) {
        const push = (label, val) => {
            if (val == null) return;
            if (Array.isArray(val)) val.forEach((v) => out.push(label ? `${label}: ${String(v)}` : String(v)));
            else if (typeof val === "object") out.push(label ? `${label}: ${JSON.stringify(val)}` : JSON.stringify(val));
            else out.push(label ? `${label}: ${String(val)}` : String(val));
        };
        if (data.detail) push("", data.detail);
        if (data.error) push("", data.error);
        if (data.non_field_errors) push("", data.non_field_errors);
        Object.entries(data).forEach(([k, v]) => {
            if (["detail", "error", "non_field_errors"].includes(k)) return;
            push(k, v);
        });
    }
    if (!out.length && error?.message) out.push(String(error.message));
    if (!out.length) out.push(String(error));
    return out;
}
function ErrorMsg({ error, onClose }) {
    const msgs = extractApiErrors(error);
    const status = error?.status;
    if (!msgs.length) return null;
    return (
        <div className="p-3 bg-red-600/10 text-red-400 rounded text-sm space-y-2">
            <div className="flex items-start justify-between gap-3">
                <div className="font-medium">{status ? `Erreur ${status}` : "Erreur"}</div>
                {onClose && (
                    <button type="button" className="opacity-70 hover:opacity-100 underline" onClick={onClose}>
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
function Empty({ children }) {
    return <div className="p-3 opacity-60">{children}</div>;
}

const TYPES = ["", "ANNIVERSAIRE", "CONFERENCE", "SEMINAIRE", "ANIMATION", "AUTRE"];
const STATUSES = ["", "DRAFT", "PUBLISHED", "FULL", "CANCELLED"];

export default function EventsList() {
    const restaurantId = useActiveRestaurantId();
    const user = useSelector((s) => s.user);

    const isRestaurateur = String(user?.role || "").toUpperCase() === "RESTAURATEUR";

    // filtres
    const [fDate, setFDate] = useState("");
    const [fType, setFType] = useState("");
    const [fStatus, setFStatus] = useState("");
    const [fPublic, setFPublic] = useState(""); // "", "true", "false"

    const params = useMemo(() => {
        const p = {};
        if (fDate) p.date = fDate; // YYYY-MM-DD
        if (fType) p.type = fType;
        if (fStatus) p.status = fStatus;
        if (fPublic) p.is_public = fPublic;
        return p;
    }, [fDate, fType, fStatus, fPublic]);

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState(null);

    const load = () => {
        if (!restaurantId) return;
        setLoading(true);
        setErr(null);
        apiListEvents(restaurantId, params)
            .then((list) => setRows(Array.isArray(list) ? list : []))
            .catch((e) => setErr(e))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [restaurantId, params]);

    const act = async (fn, id) => {
        try {
            await fn(id);
            load();
        } catch (e) {
            setErr(e);
        }
    };

    return (
        <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Évènements</h1>
                <div className="flex items-center gap-2">
                    <Link
                        to="/restaurant/events/new"
                        className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500"
                    >
                        Créer
                    </Link>
                </div>
            </div>

            {!restaurantId && <ErrorMsg error={"Sélectionne un restaurant."} />}
            {err && <ErrorMsg error={err} onClose={() => setErr(null)} />}

            {/* Filtres */}
            <div className="bg-white text-black border rounded-2xl p-4 grid md:grid-cols-5 gap-3">
                <label className="text-sm">
                    <div className="opacity-70 mb-1">Date</div>
                    <input
                        type="date"
                        className="border rounded px-2 py-1 w-full"
                        value={fDate}
                        onChange={(e) => setFDate(e.target.value)}
                    />
                </label>

                <label className="text-sm">
                    <div className="opacity-70 mb-1">Type</div>
                    <select className="border rounded px-2 py-1 w-full" value={fType} onChange={(e) => setFType(e.target.value)}>
                        {TYPES.map((t) => (
                            <option key={t || "all"} value={t}>
                                {t || "Tous"}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="text-sm">
                    <div className="opacity-70 mb-1">Statut</div>
                    <select
                        className="border rounded px-2 py-1 w-full"
                        value={fStatus}
                        onChange={(e) => setFStatus(e.target.value)}
                    >
                        {STATUSES.map((s) => (
                            <option key={s || "all"} value={s}>
                                {s || "Tous"}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="text-sm">
                    <div className="opacity-70 mb-1">Visibilité</div>
                    <select
                        className="border rounded px-2 py-1 w-full"
                        value={fPublic}
                        onChange={(e) => setFPublic(e.target.value)}
                    >
                        <option value="">Public & Privé</option>
                        <option value="true">Public</option>
                        <option value="false">Privé</option>
                    </select>
                </label>

                <div className="flex items-end gap-2">
                    <button className="px-3 py-2 rounded border" onClick={load}>
                        Filtrer
                    </button>
                    <button
                        className="px-3 py-2 rounded border"
                        onClick={() => {
                            setFDate("");
                            setFType("");
                            setFStatus("");
                            setFPublic("");
                        }}
                    >
                        Réinitialiser
                    </button>
                </div>
            </div>

            {loading && <Loading />}

            {!loading && !err && (
                rows.length ? (
                    <table className="w-full text-sm bg-white text-black border rounded-2xl overflow-hidden">
                        <thead className="bg-gray-100">
                        <tr className="text-left">
                            <th className="py-2 px-3">Titre</th>
                            <th>Type</th>
                            <th>Date</th>
                            <th>Heures</th>
                            <th>Cap.</th>
                            <th>Public</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                        </thead>
                        <tbody>
                        {rows.map((ev) => {
                            const showPublish = ev.status === "DRAFT" || ev.status === "CANCELLED";
                            const showCancel = ev.status !== "CANCELLED";
                            const showClose = ev.status !== "FULL";
                            const showReopen = ev.status !== "PUBLISHED";

                            // Option : si tu veux verrouiller par rôle côté UI
                            const canManage = isRestaurateur; // ou affiner en comparant restaurant actif vs ev.restaurant

                            return (
                                <tr key={ev.id} className="border-t">
                                    <td className="py-2 px-3">
                                        <div className="flex items-center gap-2">
                                            <div className="font-medium">{ev.title}</div>
                                            {/* badge producteurs */}
                                            {ev.requires_supplier_confirmation ? (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                            producteurs
                          </span>
                                            ) : null}
                                        </div>
                                        <div className="text-xs opacity-70">#{ev.id}</div>
                                    </td>
                                    <td>{ev.type}</td>
                                    <td>{ev.date}</td>
                                    <td>
                                        {ev.start_time?.slice(0, 5)}–{ev.end_time?.slice(0, 5)}
                                    </td>
                                    <td>{ev.capacity ?? "—"}</td>
                                    <td>{ev.is_public ? "Public" : "Privé"}</td>
                                    <td>{ev.status}</td>
                                    <td className="space-x-2">
                                        <Link className="px-2 py-1 border rounded" to={`/restaurant/events/${ev.id}/registrations`}>
                                            Inscrits
                                        </Link>
                                        <Link className="px-2 py-1 border rounded" to={`/restaurant/events/${ev.id}/invitations`}>
                                            Invitations
                                        </Link>
                                        <Link className="px-2 py-1 border rounded" to={`/restaurant/events/${ev.id}/edit`}>
                                            Éditer
                                        </Link>

                                        {/* Actions statut — affichées selon status */}
                                        {canManage && showPublish && (
                                            <button className="px-2 py-1 rounded bg-emerald-600" onClick={() => act(apiPublishEvent, ev.id)}>
                                                Publier
                                            </button>
                                        )}
                                        {canManage && showCancel && (
                                            <button className="px-2 py-1 rounded bg-red-600" onClick={() => act(apiCancelEvent, ev.id)}>
                                                Annuler
                                            </button>
                                        )}
                                        {canManage && showClose && (
                                            <button className="px-2 py-1 rounded bg-yellow-600" onClick={() => act(apiCloseEvent, ev.id)}>
                                                Marquer complet
                                            </button>
                                        )}
                                        {canManage && showReopen && (
                                            <button className="px-2 py-1 rounded bg-blue-600" onClick={() => act(apiReopenEvent, ev.id)}>
                                                Réouvrir
                                            </button>
                                        )}
                                        {canManage && (
                                            <button className="px-2 py-1 rounded bg-red-700" onClick={() => act(apiDeleteEvent, ev.id)}>
                                                Supprimer
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                        </tbody>
                    </table>
                ) : (
                    <Empty>Aucun évènement.</Empty>
                )
            )}
        </div>
    );
}
