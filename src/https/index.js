// src/https/index.js
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

// --- client public: AUCUN header Authorization
export const publicApi = axios.create({ baseURL: API_BASE });

// --- client privé: ajoute Authorization si token présent
export const api = axios.create({ baseURL: API_BASE });
api.interceptors.request.use((cfg) => {
    const token = localStorage.getItem("access");
    if (token) cfg.headers.Authorization = `Bearer ${token}`;
    return cfg;
});

/* ===================== AUTH ===================== */
// Login & register DOIVENT passer par publicApi (pas de token)
export const login = (data) => publicApi.post("/accounts/login/", data);
export const register = (data) => publicApi.post("/accounts/register/", data);

// Routes privées → api (avec token)
export const getUserData = () => api.get("/accounts/me/");
export const logout = async () => {
    try { await api.post("/accounts/logout/"); } catch {}
    localStorage.removeItem("access");
    return Promise.resolve();
};

/* ===================== TABLES ===================== */
export const addTable = (data) => api.post("/pos/tables/", data);
export const getTables = (params) => api.get("/pos/tables/", { params });
export const updateTable = ({ tableId, ...tableData }) =>
    api.put(`/pos/tables/${tableId}/`, tableData);

/* ===================== PAYMENTS (Razorpay off) ===================== */
export const createOrderRazorpay = () => { throw new Error("Razorpay off"); };
export const verifyPaymentRazorpay = () => { throw new Error("Razorpay off"); };

/* ===================== ORDERS (POS) ===================== */
export const addOrder = (data) => api.post("/pos/orders/", data);

export const getOrders = async (params) => {
    const res = await api.get("/pos/orders/", { params });
    const data = res?.data;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.results)) return data.results;
    if (Array.isArray(data?.data)) return data.data;
    return [];
};

export const updateOrderStatus = async ({ orderId, orderStatus }) => {
    const status = String(orderStatus).toUpperCase();
    const action =
        status === "HOLD" ? "hold" :
            status === "REOPEN" ? "reopen" :
                status === "CANCELLED" ? "cancel" :
                    status === "PAID" ? "checkout" : null;

    if (action === "checkout") {
        return api.post(`/pos/orders/${orderId}/checkout/`, { method: "CASH", amount: null });
    }
    if (action) return api.post(`/pos/orders/${orderId}/${action}/`, {});
    return api.put(`/pos/orders/${orderId}/`, { status });
};

export const addItem = (orderId, payload) => api.post(`/pos/orders/${orderId}/add_item/`, payload);
export const updateItem = (orderId, itemId, quantity) =>
    api.post(`/pos/orders/${orderId}/update_item/`, { item_id: itemId, quantity });
export const removeItem = (orderId, itemId) =>
    api.post(`/pos/orders/${orderId}/remove_item/`, { item_id: itemId });

export const hold = (orderId) => api.post(`/pos/orders/${orderId}/hold/`, {});
export const reopen = (orderId) => api.post(`/pos/orders/${orderId}/reopen/`, {});
export const checkout = (orderId, method, amount) =>
    api.post(`/pos/orders/${orderId}/checkout/`, { method, amount });

export const ticket = (orderId) =>
    api.get(`/pos/orders/${orderId}/ticket/`, { responseType: "blob" });

export const summary = (params) => api.get("/pos/orders/summary/", { params });

// alias pratique si ton Login.jsx importe getMe
export const getMe = getUserData;
