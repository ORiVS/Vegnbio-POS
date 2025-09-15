import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://vegnbio.onrender.com/api";

// public: pas de token
export const publicApi = axios.create({ baseURL: API_BASE });

// privé: ajoute Authorization
export const api = axios.create({ baseURL: API_BASE });
api.interceptors.request.use((cfg) => {
    const token = localStorage.getItem("access");
    if (token) cfg.headers.Authorization = `Bearer ${token}`;
    return cfg;
});

/* ============ AUTH ============ */
export const login = (data) => publicApi.post("/accounts/login/", data);
export const register = (data) => publicApi.post("/accounts/register/", data);
export const getUserData = () => api.get("/accounts/me/");
export const logout = async () => { try { await api.post("/accounts/logout/"); } catch {} localStorage.removeItem("access"); };

/* ============ TABLES (optionnel) ============ */
export const addTable = (data) => api.post("/pos/tables/", data);
export const getTables = (params) => api.get("/pos/tables/", { params });
export const updateTable = ({ tableId, ...tableData }) => api.put(`/pos/tables/${tableId}/`, tableData);

/* ============ ORDERS (POS) ============ */
export const addOrder = (data) => api.post("/pos/orders/", data);

export const getOrders = async (params) => {
    const res = await api.get("/pos/orders/", { params });
    const d = res?.data;
    if (Array.isArray(d)) return d;
    if (Array.isArray(d?.results)) return d.results;
    if (Array.isArray(d?.data)) return d.data;
    return [];
};

export const hold = (orderId)   => api.post(`/pos/orders/${orderId}/hold/`, {});
export const reopen = (orderId) => api.post(`/pos/orders/${orderId}/reopen/`, {});
export const cancelOrder = (orderId) => api.post(`/pos/orders/${orderId}/cancel/`, {});

// encaissement: { method: "CASH|CARD|ONLINE", amount: number|null }
export const checkout = (orderId, method, amount, note = "") =>
    api.post(`/pos/orders/${orderId}/checkout/`, { method, amount, note });

export const ticket  = (orderId) => api.get(`/pos/orders/${orderId}/ticket/`);
export const summary = (params)  => api.get("/pos/orders/summary/", { params });

// lignes
export const addItem = (orderId, payload) =>
    api.post(`/pos/orders/${orderId}/add_item/`, payload);
export const updateItem = (orderId, itemId, partialData) =>
    api.patch(`/pos/orders/${orderId}/items/${itemId}/update/`, partialData);
export const removeItem = (orderId, itemId) =>
    api.delete(`/pos/orders/${orderId}/items/${itemId}/remove/`);

/* ============ DISHES / MENUS ============ */
export const getDishes = async (params) => {
    try { return (await publicApi.get("/menu/dishes/", { params })).data; }
    catch { return []; }
};

export const getMenus = async (params) => {
    const res = await publicApi.get("/menu/menus/", { params });
    return Array.isArray(res?.data) ? res.data : (res?.data?.results || []);
};

/* ============ DISPO PLATS (optionnel) ============ */
export const getDishAvailability = async (params) => {
    const res = await publicApi.get("/menu/dish-availability/", { params });
    return Array.isArray(res?.data) ? res.data : (res?.data?.results || []);
};

/* ============ DISCOUNT ============ */
export const applyDiscount = (orderId, payload) =>
    api.post(`/pos/orders/${orderId}/apply_discount/`, payload);
