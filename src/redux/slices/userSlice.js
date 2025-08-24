import { createSlice } from "@reduxjs/toolkit";

// Hydrate depuis localStorage si présent
function readActiveFromStorage() {
    const raw = localStorage.getItem("activeRestaurantId");
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
}

const initialState = {
    isAuth: false,
    email: null,
    name: null,
    role: null,
    restaurants: [],          // [{ id, name, city }]
    activeRestaurantId: readActiveFromStorage(), // ← hydrate ici
};

const userSlice = createSlice({
    name: "user",
    initialState,
    reducers: {
        // payload: { email, name, role, restaurants?:[], activeRestaurantId?:number }
        setUser: (s, a) => {
            const {
                email,
                name,
                role,
                restaurants = [],
                activeRestaurantId = null,
            } = a.payload || {};

            s.isAuth = true;
            s.email = email || null;
            s.name  = name  || null;
            s.role  = role  || null;

            s.restaurants = Array.isArray(restaurants) ? restaurants : [];

            // ordre de priorité pour l'actif:
            // 1) localStorage (si correspond à un resto renvoyé)
            // 2) payload.activeRestaurantId
            // 3) premier resto de la liste
            const fromStorage = readActiveFromStorage();
            const ids = new Set(s.restaurants.map(r => r.id));

            const fallbackId = s.restaurants.length ? s.restaurants[0].id : null;
            const chosen =
                (fromStorage != null && ids.has(fromStorage)) ? fromStorage :
                    (activeRestaurantId != null && ids.has(activeRestaurantId)) ? activeRestaurantId :
                        fallbackId;

            s.activeRestaurantId = chosen;
            if (chosen == null) {
                localStorage.removeItem("activeRestaurantId");
            } else {
                localStorage.setItem("activeRestaurantId", String(chosen));
            }
        },

        // Remplace complètement la liste des restos
        setRestaurants: (s, a) => {
            const list = Array.isArray(a.payload) ? a.payload : [];
            s.restaurants = list;

            // si l'actif courant n'existe plus → 1er / null
            const stillThere = list.some(r => r.id === s.activeRestaurantId);
            if (!stillThere) {
                s.activeRestaurantId = list.length ? list[0].id : null;
                if (s.activeRestaurantId == null) {
                    localStorage.removeItem("activeRestaurantId");
                } else {
                    localStorage.setItem("activeRestaurantId", String(s.activeRestaurantId));
                }
            }
        },

        setActiveRestaurant: (s, a) => {
            const id = Number(a.payload);
            s.activeRestaurantId = Number.isFinite(id) ? id : null;
            if (s.activeRestaurantId == null) {
                localStorage.removeItem("activeRestaurantId");
            } else {
                localStorage.setItem("activeRestaurantId", String(s.activeRestaurantId));
            }
        },

        removeUser: (s) => {
            Object.assign(s, {
                isAuth: false,
                email: null,
                name: null,
                role: null,
                restaurants: [],
                activeRestaurantId: null,
            });
            localStorage.removeItem("activeRestaurantId"); // ← nettoie au logout
        },
    },
});

export const {
    setUser,
    setRestaurants,
    setActiveRestaurant,
    removeUser,
} = userSlice.actions;

export default userSlice.reducer;
