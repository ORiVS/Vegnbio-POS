// src/components/restaurant/api.js

// ---------- Config ----------
const ENV_API = (import.meta?.env?.VITE_API_BASE_URL || "").replace(/\/+$/, "");
const API = ENV_API || "https://vegnbio.onrender.com/api"; // .env.local : VITE_API_BASE_URL=https://vegnbio.onrender.com/api

// Namespaces back (cf. urls.py de chaque app)
const RESTAURANTS_ROOT = `${API}/restaurants`;
const ACCOUNTS_ROOT = `${API}/accounts`;
const MARKET_ROOT = `${API}/market`;
const PURCHASING_ROOT = `${API}/purchasing`;
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
        if ("offer" in v && v.offer != null) return toId(v.offer);
        if ("supplier" in v && v.supplier != null) return toId(v.supplier);
        if ("order" in v && v.order != null) return toId(v.order);
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
function sanitizeQuery(obj, keys = [
    "restaurant", "room", "event", "reservation",
    "closure", "customer_id", "offer", "supplier", "order"
]) {
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
    if (url.includes("?")) {
        const qs2 = qs.replace(/^\?/, "&");
        return `${url}${qs2}`;
    }
    return `${url}${qs}`;
}

// ---------- Core HTTP (JWT, pas de cookies) ----------
async function httpRoot(ROOT, path, { method = "GET", body, headers, params } = {}) {
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

// HTTP absolu (pour /api/accounts/… ou tout URL complet)
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

// Shortcuts spécifiques aux roots
const httpResto = (p, opts) => httpRoot(RESTAURANTS_ROOT, p, opts);
const httpMarket = (p, opts) => httpRoot(MARKET_ROOT, p, opts);
const httpPurch  = (p, opts) => httpRoot(PURCHASING_ROOT, p, opts);

// ======================================================================
//                               RESTAURANTS
// ======================================================================
export function apiGetRestaurant(restaurantId) {
    const rid = mustId("apiGetRestaurant.restaurantId", restaurantId);
      // -> /api/restaurants/restaurants/:id/
          return httpResto(`/restaurants/${rid}/`, { method: "GET" });
}

export function apiUpdateRestaurant(restaurantId, payload) {
    const rid = mustId("apiUpdateRestaurant.restaurantId", restaurantId);
      // -> /api/restaurants/restaurants/:id/
          return httpResto(`/restaurants/${rid}/`, { method: "PATCH", body: payload });
}


export function apiGetAvailability(restaurantId, dateISO) {
    const rid = mustId("apiGetAvailability.restaurantId", restaurantId);
      // -> /api/restaurants/restaurants/:id/dashboard/
          return httpResto(`/restaurants/${rid}/dashboard/`, {
            method: "GET",
            params: { date: dateISO },
      });
}

export function apiGetRestaurantReservations(restaurantId, { status } = {}) {
    const rid = mustId("apiGetRestaurantReservations.restaurantId", restaurantId);
      // -> /api/restaurants/restaurants/:id/reservations/
          return httpResto(`/restaurants/${rid}/reservations/`, {
            method: "GET",
            params: { status },
      });
}

export function apiStatsReservations() {
    return httpResto(`/reservations/statistics/`, { method: "GET" });
}

export function apiListRestaurants(params = {}) {
      // -> /api/restaurants/restaurants/
          return httpResto(`/restaurants/`, { method: "GET", params });
}


// ======================================================================
//                                 ROOMS
// ======================================================================
export function apiCreateRoom({ restaurant, name, capacity }) {
    const rid = mustId("apiCreateRoom.restaurant", restaurant);
    return httpResto(`/rooms/`, { method: "POST", body: { restaurant: rid, name, capacity } });
}

export function apiUpdateRoom(roomId, patch) {
    const body = patch && patch.restaurant ? { ...patch, restaurant: toId(patch.restaurant) } : patch;
    return httpResto(`/rooms/${mustId("apiUpdateRoom.roomId", roomId)}/`, { method: "PATCH", body });
}

export function apiDeleteRoom(roomId) {
    return httpResto(`/rooms/${mustId("apiDeleteRoom.roomId", roomId)}/`, { method: "DELETE" });
}

// ======================================================================
//                                CLOSURES
// ======================================================================
export function apiListClosures() {
    return httpResto(`/closures/`, { method: "GET" });
}

export function apiCreateClosure({ restaurant, date, reason }) {
    const rid = mustId("apiCreateClosure.restaurant", restaurant);
    return httpResto(`/closures/`, { method: "POST", body: { restaurant: rid, date, reason } });
}

export function apiUpdateClosure(closureId, patch) {
    const body = patch && patch.restaurant ? { ...patch, restaurant: toId(patch.restaurant) } : patch;
    return httpResto(`/closures/${mustId("apiUpdateClosure.closureId", closureId)}/`, { method: "PATCH", body });
}

export function apiDeleteClosure(closureId) {
    return httpResto(`/closures/${mustId("apiDeleteClosure.closureId", closureId)}/`, { method: "DELETE" });
}

// ======================================================================
//                              RESERVATIONS
// ======================================================================
export function apiCreateReservation(payload) {
    const body = { ...payload };
    if (body.restaurant) body.restaurant = toId(body.restaurant);
    if (body.room) body.room = toId(body.room);
    return httpResto(`/reservations/`, { method: "POST", body });
}
export const apiCreateReservationAsRestaurateur = apiCreateReservation;

export function apiModerateReservation(reservationId, nextStatus) {
    return httpResto(
        `/reservations/${mustId("apiModerateReservation.reservationId", reservationId)}/moderate/`,
        { method: "POST", body: { status: nextStatus } }
    );
}

export function apiCancelReservation(reservationId) {
    return httpResto(`/reservations/${mustId("apiCancelReservation.reservationId", reservationId)}/cancel/`, {
        method: "POST",
    });
}

export function apiDeleteReservation(reservationId) {
    return httpResto(`/reservations/${mustId("apiDeleteReservation.reservationId", reservationId)}/`, {
        method: "DELETE",
    });
}

export function apiAssignReservation(reservationId, payload = {}) {
    // payload attendu :
    // - { full_restaurant: true }  OU
    // - { room: <id> }
    const body = {};
    if (payload.full_restaurant) body.full_restaurant = true;
    if (payload.room) body.room = toId(payload.room);

    return httpResto(
        `/reservations/${mustId("apiAssignReservation.reservationId", reservationId)}/assign/`,
        { method: "POST", body }
    );
}

// ======================================================================
//                                 EVENTS
// ======================================================================
export function apiListEvents(restaurantId, params = {}) {
    const rid = mustId("apiListEvents.restaurantId", restaurantId);
    const q = { ...params, restaurant: rid };
    return httpResto(`/evenements/`, { method: "GET", params: q });
    // Variante : /restaurants/:id/evenements/
}

export function apiCreateEvent(payload) {
    const body = { ...payload };
    if (body.restaurant) body.restaurant = toId(body.restaurant);
    if (body.room) body.room = toId(body.room);
    return httpResto(`/evenements/`, { method: "POST", body });
}

export function apiUpdateEvent(eventId, patch) {
    const body = { ...patch };
    if (body.restaurant) body.restaurant = toId(body.restaurant);
    if (body.room) body.room = toId(body.room);
    return httpResto(`/evenements/${mustId("apiUpdateEvent.eventId", eventId)}/`, { method: "PATCH", body });
}

export function apiDeleteEvent(eventId) {
    return httpResto(`/evenements/${mustId("apiDeleteEvent.eventId", eventId)}/`, { method: "DELETE" });
}

export function apiPublishEvent(eventId) {
    return httpResto(`/evenements/${mustId("apiPublishEvent.eventId", eventId)}/publish/`, { method: "POST" });
}

export function apiCancelEvent(eventId) {
    return httpResto(`/evenements/${mustId("apiCancelEvent.eventId", eventId)}/cancel/`, { method: "POST" });
}

export function apiCloseEvent(eventId) {
    return httpResto(`/evenements/${mustId("apiCloseEvent.eventId", eventId)}/close/`, { method: "POST" });
}

export function apiReopenEvent(eventId) {
    return httpResto(`/evenements/${mustId("apiReopenEvent.eventId", eventId)}/reopen/`, { method: "POST" });
}

export function apiGetRegistrations(eventId) {
    return httpResto(`/evenements/${mustId("apiGetRegistrations.eventId", eventId)}/registrations/`, { method: "GET" });
}

export function apiInvite(eventId, payload = {}) {
    // payload possible: { invited_user } ou { email } ou { phone } … (le back gère)
    return httpResto(`/evenements/${mustId("apiInvite.eventId", eventId)}/invite/`, {
        method: "POST",
        body: payload,
    });
}
export const apiSendInvite = apiInvite;

export function apiInviteBulk(eventId, emails = []) {
    return httpResto(`/evenements/${mustId("apiInviteBulk.eventId", eventId)}/invite_bulk/`, {
        method: "POST",
        body: { emails },
    });
}
export const apiSendInvitesBulk = apiInviteBulk;

export function apiGetEvent(eventId) {
    return httpResto(`/evenements/${mustId("apiGetEvent.eventId", eventId)}/`, { method: "GET" });
}

// ======================================================================
//                        ACCOUNTS — recherche clients
// ======================================================================
export async function apiSearchClients(search = "", limit = 50) {
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

            return users;
        } catch (e) {
            if (DEBUG) console.warn("[apiSearchClients] fallback failed for", base, e?.status || e);
        }
    }
    return [];
}

// ======================================================================
//                               MARKET (offers)
// ======================================================================
export function apiListOffers(params = {}) {
    // filtres supportés: q, is_bio, region, allergen, exclude_allergens, available_on, sort (price | -price)
    return httpMarket(`/offers/`, { method: "GET", params });
}

export function apiGetOffer(offerId) {
    return httpMarket(`/offers/${mustId("apiGetOffer.offerId", offerId)}/`, { method: "GET" });
}

export function apiPublishOffer(offerId) {
    return httpMarket(`/offers/${mustId("apiPublishOffer.offerId", offerId)}/publish/`, { method: "POST" });
}
export function apiUnlistOffer(offerId) {
    return httpMarket(`/offers/${mustId("apiUnlistOffer.offerId", offerId)}/unlist/`, { method: "POST" });
}
export function apiDraftOffer(offerId) {
    return httpMarket(`/offers/${mustId("apiDraftOffer.offerId", offerId)}/draft/`, { method: "POST" });
}

export function apiCompareOffers(ids = []) {
    const p = { ids: ids.filter(Boolean).join(",") };
    return httpMarket(`/offers/compare/`, { method: "GET", params: p });
}

export function apiImportOfferToProduct(offerId) {
    // réservé RESTAURATEUR (backend)
    return httpMarket(`/offers/${mustId("apiImportOfferToProduct.offerId", offerId)}/import_to_product/`, { method: "POST" });
}

export function apiFlagOffer(offerId, { reason, details = "" }) {
    return httpMarket(`/offers/${mustId("apiFlagOffer.offerId", offerId)}/flag/`, { method: "POST", body: { reason, details } });
}

// Reviews (restaurateur/admin peuvent créer)
export function apiCreateOfferReview({ offer, rating, comment = "" }) {
    const body = { offer: mustId("apiCreateOfferReview.offer", offer), rating, comment };
    return httpMarket(`/reviews/`, { method: "POST", body });
}
export function apiListOfferReviews(offerId) {
    return httpMarket(`/reviews/`, { method: "GET", params: { offer: mustId("apiListOfferReviews.offerId", offerId) } });
}

// Comments (publics par défaut; admin voit tout)
export function apiListOfferComments(offerId) {
    return httpMarket(`/comments/`, { method: "GET", params: { offer: mustId("apiListOfferComments.offerId", offerId) } });
}
export function apiCreateOfferComment({ offer, content, is_public = true }) {
    const body = { offer: mustId("apiCreateOfferComment.offer", offer), content, is_public };
    return httpMarket(`/comments/`, { method: "POST", body });
}
export function apiUpdateOfferComment(commentId, patch) {
    return httpMarket(`/comments/${mustId("apiUpdateOfferComment.commentId", commentId)}/`, { method: "PATCH", body: patch });
}
export function apiDeleteOfferComment(commentId) {
    return httpMarket(`/comments/${mustId("apiDeleteOfferComment.commentId", commentId)}/`, { method: "DELETE" });
}

// ======================================================================
//                             PURCHASING (orders)
// ======================================================================

export function apiCreateSupplierOrder({ supplier, note = "", items = [] }) {
    const body = {
        supplier: mustId("apiCreateSupplierOrder.supplier", supplier),
        note,
        items: items.map((it) => ({
            offer: mustId("apiCreateSupplierOrder.item.offer", it.offer),
            qty_requested: it.qty_requested,
        })),
    };
    return httpPurch(`/orders/`, { method: "POST", body });
}

// ✅ correspond à /api/purchasing/orders/my_restaurant/ côté back
export function apiMyRestaurantOrders() {
    return httpPurch(`/orders/my_restaurant/`, { method: "GET" });
}

// ✅ correspond à /api/purchasing/orders/supplier_inbox/ côté back
export function apiSupplierInbox() {
    return httpPurch(`/orders/supplier_inbox/`, { method: "GET" });
}

// ✅ correspond à /api/purchasing/orders/{id}/review/ côté back
export function apiSupplierReview(orderId, items) {
    return httpPurch(`/orders/${mustId("apiSupplierReview.orderId", orderId)}/review/`, {
        method: "POST",
        body: { items },
    });
}

// ---------- Exports utilitaires ----------
export const __debug = {
    API,
    RESTAURANTS_ROOT,
    MARKET_ROOT,
    PURCHASING_ROOT,
    ACCOUNTS_ROOT,
    getToken,
    toId,
    mustId,
    sanitizeQuery,
    buildQS,
};
