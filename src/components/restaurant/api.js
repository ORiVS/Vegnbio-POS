// src/components/restaurant/api.js

// ---------- Config ----------
const ENV_API = (import.meta?.env?.VITE_API_BASE_URL || "").replace(/\/+$/, "");
const API = ENV_API || "https://vegnbio.onrender.com/api"; // .env.local : VITE_API_BASE_URL=https://vegnbio.onrender.com/api
// ⚠️ Ici on pointe bien sur le namespace "restaurants" (cf. urls.py)
const ROOT = `${API}/restaurants`;
const ACCOUNTS_ROOT = `${API}/accounts`;
const DEBUG = true;

// ---------- Helpers ----------
function ensureLeadingSlash(p) {
    if (!p) return "";
    return p.startsWith("/") ? p : `/${p}`;
}

// Cherche un id quel que soit le shape de l’objet
function toId(v) {
    if (v == null) return v;
    if (typeof v === "number") return v;
    if (typeof v === "string") {
        const n = Number(v);
        return Number.isFinite(n) ? n : v;
    }
    if (typeof v === "object") {
        if ("id" in v && v.id != null) return toId(v.id);
        if ("restaurant_id" in v && v.restaurant_id != null) return toId(v.restaurant_id);
        if ("restaurantId" in v && v.restaurantId != null) return toId(v.restaurantId);
        if ("value" in v && v.value != null) return toId(v.value);
        if ("pk" in v && v.pk != null) return toId(v.pk);
        if ("restaurant" in v && v.restaurant != null) return toId(v.restaurant);
        if ("data" in v && v.data != null) return toId(v.data);
    }
    return v;
}

function mustId(name, v) {
    const id = toId(v);
    const ok =
        (typeof id === "number" && Number.isFinite(id)) ||
        (typeof id === "string" && id.trim() !== "");
    if (!ok) {
        console.error(`[API] ${name}: id invalide`, v);
        throw new Error(`${name}: id invalide (reçu ${String(v)})`);
    }
    return id;
}

// convertit certaines clés objet -> id
function sanitizeQuery(obj, keys = ["restaurant", "room", "event", "reservation", "closure", "customer_id"]) {
    if (!obj) return obj;
    const out = { ...obj };
    for (const k of keys) {
        if (k in out) out[k] = toId(out[k]);
    }
    return out;
}

function buildQS(params = {}) {
    const clean = sanitizeQuery(params);
    const entries = Object.entries(clean).filter(
        ([, v]) => v !== undefined && v !== null && v !== ""
    );
    return entries.length ? `?${new URLSearchParams(entries).toString()}` : "";
}

function getToken() {
    return (
        localStorage.getItem("token") ||
        localStorage.getItem("accessToken") ||
        localStorage.getItem("access") ||
        sessionStorage.getItem("token") ||
        null
    );
}

function appendParams(url, params) {
    if (!params || Object.keys(params).length === 0) return url;
    const qs = buildQS(params);
    if (!qs) return url;
    // si l’URL a déjà un "?", on concatène
    if (url.includes("?")) {
        const qs2 = qs.replace(/^\?/, "&");
        return `${url}${qs2}`;
    }
    return `${url}${qs}`;
}

// ---------- Core HTTP (JWT, pas de cookies) ----------
async function http(path, { method = "GET", body, headers, params } = {}) {
    let url = `${ROOT}${ensureLeadingSlash(path)}`;
    url = appendParams(url, params);

    const token = getToken();
    if (DEBUG) console.info("[API] →", method, url, body || "");

    const isForm = typeof FormData !== "undefined" && body instanceof FormData;

    const res = await fetch(url, {
        method,
        credentials: "omit", // pas de cookies
        headers: {
            Accept: "application/json",
            ...(isForm ? {} : body ? { "Content-Type": "application/json" } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(headers || {}),
        },
        body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
    });

    const text = await res.text();
    const ctype = res.headers.get("content-type") || "";
    const isJSON = ctype.includes("application/json");
    let data = null;

    if (isJSON && text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = text;
        }
    } else {
        data = text || null;
    }

    if (DEBUG) {
        console.info("[API] ←", res.status, ctype || "(no content-type)");
        if (!res.ok) {
            const preview = (typeof data === "string" ? data : JSON.stringify(data || {})).slice(0, 200);
            console.info("[API] body first 200 chars:", preview);
        }
    }

    if (!res.ok) {
        const msg =
            (isJSON && data && typeof data === "object" && (data.detail || data.error || data.message)) ||
            (typeof data === "string" && data.slice(0, 200)) ||
            `${res.status} ${res.statusText}`;
        const err = new Error(`[${res.status}] ${url}\n${msg}`);
        err.status = res.status;
        err.data = data;
        err.url = url;
        throw err;
    }

    if (!text) return null;
    return isJSON ? data : text;
}

// HTTP absolu (pour /api/accounts/…)
async function httpAbs(url, { method = "GET", body, headers, params } = {}) {
    url = appendParams(url, params);

    const token = getToken();
    const isForm = typeof FormData !== "undefined" && body instanceof FormData;

    if (DEBUG) console.info("[API] →", method, url, body || "");

    const res = await fetch(url, {
        method,
        credentials: "omit",
        headers: {
            Accept: "application/json",
            ...(isForm ? {} : body ? { "Content-Type": "application/json" } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(headers || {}),
        },
        body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
    });

    const text = await res.text();
    const ctype = res.headers.get("content-type") || "";
    const isJSON = ctype.includes("application/json");
    let data = null;

    if (isJSON && text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = text;
        }
    } else {
        data = text || null;
    }

    if (DEBUG) {
        console.info("[API] ←", res.status, ctype || "(no content-type)");
        if (!res.ok) {
            const preview = (typeof data === "string" ? data : JSON.stringify(data || {})).slice(0, 200);
            console.info("[API] body first 200 chars:", preview);
        }
    }

    if (!res.ok) {
        const msg =
            (isJSON && data && typeof data === "object" && (data.detail || data.error || data.message)) ||
            (typeof data === "string" && data.slice(0, 200)) ||
            `${res.status} ${res.statusText}`;
        const err = new Error(`[${res.status}] ${url}\n${msg}`);
        err.status = res.status;
        err.data = data;
        err.url = url;
        throw err;
    }
    if (!text) return null;
    return isJSON ? data : text;
}

// ======================================================================
//                               RESTAURANTS
// ======================================================================
export function apiGetRestaurant(restaurantId) {
    const rid = mustId("apiGetRestaurant.restaurantId", restaurantId);
    return http(`/restaurants/${rid}/`, { method: "GET" });
}

export function apiUpdateRestaurant(restaurantId, payload) {
    const rid = mustId("apiUpdateRestaurant.restaurantId", restaurantId);
    return http(`/restaurants/${rid}/`, { method: "PATCH", body: payload });
}

export function apiGetAvailability(restaurantId, dateISO) {
    const rid = mustId("apiGetAvailability.restaurantId", restaurantId);
    // correspond à: /api/restaurants/restaurants/<id>/dashboard/?date=YYYY-MM-DD
    return http(`/restaurants/${rid}/dashboard/`, { method: "GET", params: { date: dateISO } });
}

export function apiGetRestaurantReservations(restaurantId, { status } = {}) {
    const rid = mustId("apiGetRestaurantReservations.restaurantId", restaurantId);
    // correspond à: /api/restaurants/restaurants/<id>/reservations/?status=...
    return http(`/restaurants/${rid}/reservations/`, { method: "GET", params: { status } });
}

export function apiStatsReservations() {
    return http(`/reservations/statistics/`, { method: "GET" });
}

export function apiListRestaurants(params = {}) {
    return http(`/restaurants/`, { method: "GET", params });
}

// ======================================================================
//                                 ROOMS
// ======================================================================
export function apiCreateRoom({ restaurant, name, capacity }) {
    const rid = mustId("apiCreateRoom.restaurant", restaurant);
    return http(`/rooms/`, { method: "POST", body: { restaurant: rid, name, capacity } });
}

export function apiUpdateRoom(roomId, patch) {
    const body = patch && patch.restaurant ? { ...patch, restaurant: toId(patch.restaurant) } : patch;
    return http(`/rooms/${mustId("apiUpdateRoom.roomId", roomId)}/`, { method: "PATCH", body });
}

export function apiDeleteRoom(roomId) {
    return http(`/rooms/${mustId("apiDeleteRoom.roomId", roomId)}/`, { method: "DELETE" });
}

// ======================================================================
//                                CLOSURES
// ======================================================================
export function apiListClosures() {
    return http(`/closures/`, { method: "GET" });
}

export function apiCreateClosure({ restaurant, date, reason }) {
    const rid = mustId("apiCreateClosure.restaurant", restaurant);
    return http(`/closures/`, { method: "POST", body: { restaurant: rid, date, reason } });
}

export function apiUpdateClosure(closureId, patch) {
    const body = patch && patch.restaurant ? { ...patch, restaurant: toId(patch.restaurant) } : patch;
    return http(`/closures/${mustId("apiUpdateClosure.closureId", closureId)}/`, { method: "PATCH", body });
}

export function apiDeleteClosure(closureId) {
    return http(`/closures/${mustId("apiDeleteClosure.closureId", closureId)}/`, { method: "DELETE" });
}

// ======================================================================
//                              RESERVATIONS
// ======================================================================
export function apiCreateReservation(payload) {
    const body = { ...payload };
    if (body.restaurant) body.restaurant = toId(body.restaurant);
    if (body.room) body.room = toId(body.room);
    // correspond au ViewSet reservations
    return http(`/reservations/`, { method: "POST", body });
}
export const apiCreateReservationAsRestaurateur = apiCreateReservation;

export function apiModerateReservation(reservationId, nextStatus) {
    return http(
        `/reservations/${mustId("apiModerateReservation.reservationId", reservationId)}/moderate/`,
        { method: "POST", body: { status: nextStatus } }
    );
}

export function apiCancelReservation(reservationId) {
    return http(`/reservations/${mustId("apiCancelReservation.reservationId", reservationId)}/cancel/`, {
        method: "POST",
    });
}

export function apiDeleteReservation(reservationId) {
    return http(`/reservations/${mustId("apiDeleteReservation.reservationId", reservationId)}/`, {
        method: "DELETE",
    });
}

// ======================================================================
//                                 EVENTS
// ======================================================================
export function apiListEvents(restaurantId, params = {}) {
    const rid = mustId("apiListEvents.restaurantId", restaurantId);
    // ViewSet Evenement + filtre ?restaurant=<id> (+ date/type/status/is_public)
    const q = { ...params, restaurant: rid };
    return http(`/evenements/`, { method: "GET", params: q });
    // Variante (action custom list par restaurant) si tu préfères:
    // return http(`/restaurants/${rid}/evenements/`, { method: "GET" });
}

export function apiCreateEvent(payload) {
    const body = { ...payload };
    if (body.restaurant) body.restaurant = toId(body.restaurant);
    if (body.room) body.room = toId(body.room);
    return http(`/evenements/`, { method: "POST", body });
}

export function apiUpdateEvent(eventId, patch) {
    const body = { ...patch };
    if (body.restaurant) body.restaurant = toId(body.restaurant);
    if (body.room) body.room = toId(body.room);
    return http(`/evenements/${mustId("apiUpdateEvent.eventId", eventId)}/`, { method: "PATCH", body });
}

export function apiDeleteEvent(eventId) {
    return http(`/evenements/${mustId("apiDeleteEvent.eventId", eventId)}/`, { method: "DELETE" });
}

export function apiPublishEvent(eventId) {
    return http(`/evenements/${mustId("apiPublishEvent.eventId", eventId)}/publish/`, { method: "POST" });
}

export function apiCancelEvent(eventId) {
    return http(`/evenements/${mustId("apiCancelEvent.eventId", eventId)}/cancel/`, { method: "POST" });
}

export function apiCloseEvent(eventId) {
    return http(`/evenements/${mustId("apiCloseEvent.eventId", eventId)}/close/`, { method: "POST" });
}

export function apiReopenEvent(eventId) {
    return http(`/evenements/${mustId("apiReopenEvent.eventId", eventId)}/reopen/`, { method: "POST" });
}

export function apiGetRegistrations(eventId) {
    return http(`/evenements/${mustId("apiGetRegistrations.eventId", eventId)}/registrations/`, { method: "GET" });
}

export function apiInvite(eventId, { email, phone }) {
    return http(`/evenements/${mustId("apiInvite.eventId", eventId)}/invite/`, {
        method: "POST",
        body: { email, phone },
    });
}
export const apiSendInvite = apiInvite;

export function apiInviteBulk(eventId, emails = []) {
    return http(`/evenements/${mustId("apiInviteBulk.eventId", eventId)}/invite_bulk/`, {
        method: "POST",
        body: { emails },
    });
}
export const apiSendInvitesBulk = apiInviteBulk;

export function apiGetEvent(eventId) {
    return http(`/evenements/${mustId("apiGetEvent.eventId", eventId)}/`, { method: "GET" });
}

// ======================================================================
//                        ACCOUNTS — recherche clients
// ======================================================================
export async function apiSearchClients(search = "", limit = 50) {
    // Essaie plusieurs endpoints potentiels (selon ton app "accounts")
    const urls = [
        `${ACCOUNTS_ROOT}/users/`,
        `${ACCOUNTS_ROOT}/clients/`,
        `${ACCOUNTS_ROOT}/users/search/`,
    ];

    for (const base of urls) {
        try {
            const raw = await httpAbs(base, { method: "GET", params: { role: "CLIENT", search, page_size: limit, q: search } });
            const arr = Array.isArray(raw) ? raw : (Array.isArray(raw?.results) ? raw.results : []);
            if (!Array.isArray(arr)) continue;

            const users = arr
                .map((x) => ({
                    id: x.id ?? x.pk ?? x.user_id,
                    email: x.email ?? x.user?.email ?? x.username ?? x.contact_email ?? "",
                    first_name: x.first_name ?? x.user?.first_name ?? "",
                    last_name: x.last_name ?? x.user?.last_name ?? "",
                }))
                .filter((u) => u.id && u.email);

            return users; // OK (même vide)
        } catch (e) {
            if (DEBUG) console.warn("[apiSearchClients] fallback failed for", base, e?.status || e);
        }
    }
    return [];
}

// ---------- Exports utilitaires ----------
export const __debug = { API, ROOT, ACCOUNTS_ROOT, getToken, toId, mustId, sanitizeQuery, buildQS };
