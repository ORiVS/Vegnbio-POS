// src/components/shared/Header.jsx
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { logout } from "../../https";
import { removeUser, setActiveRestaurant } from "../../redux/slices/userSlice";
import { useState, useEffect, useRef } from "react";

const POS_LINKS = [
    { to: "/", label: "Accueil" },
    { to: "/orders", label: "Commandes" },
    { to: "/menu", label: "Menu" },
    { to: "/dashboard", label: "Dashboard" },
];

// Restaurant: plus de "Resto •", pas de "Dispos"
const RESTO_LINKS = [
    { to: "/restaurant/dashboard", label: "Board" },
    { to: "/restaurant/reservations", label: "Réservations" },
    { to: "/restaurant/events", label: "Évènements" },
    { to: "/restaurant/settings", label: "Paramètres" },
];

// ✅ Ajout : liens “Fournisseurs”
const SUPPLIER_LINKS = [
    { to: "/restaurant/market", label: "Marketplace" },
    { to: "/restaurant/purchasing/orders", label: "Mes commandes fournisseurs" },
];

export default function Header() {
    const user = useSelector((s) => s.user);
    const nav = useNavigate();
    const dispatch = useDispatch();

    const [time, setTime] = useState(new Date());
    const [open, setOpen] = useState(false);
    const panelRef = useRef(null);
    const btnRef = useRef(null);

    useEffect(() => {
        const t = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    const onLogout = async () => {
        await logout();
        dispatch(removeUser());
        nav("/auth");
    };

    const formattedTime = time.toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });

    const restaurants = user?.restaurants || [];
    const activeId = user?.activeRestaurantId ?? "";

    // sélection par défaut
    useEffect(() => {
        if (!activeId && restaurants.length > 0) {
            dispatch(setActiveRestaurant(restaurants[0].id));
        }
    }, [activeId, restaurants, dispatch]);

    // fermeture au clic extérieur / ESC
    useEffect(() => {
        if (!open) return;
        const onClickOutside = (e) => {
            if (
                panelRef.current &&
                !panelRef.current.contains(e.target) &&
                btnRef.current &&
                !btnRef.current.contains(e.target)
            ) {
                setOpen(false);
            }
        };
        const onEsc = (e) => e.key === "Escape" && setOpen(false);
        document.addEventListener("mousedown", onClickOutside);
        document.addEventListener("keydown", onEsc);
        return () => {
            document.removeEventListener("mousedown", onClickOutside);
            document.removeEventListener("keydown", onEsc);
        };
    }, [open]);

    const go = (to) => {
        nav(to);
        setOpen(false);
    };

    return (
        <header className="h-16 flex items-center justify-between px-4 md:px-8 border-b border-[#2a2a2a] bg-[#1a1a1a]">
            <div className="flex items-center gap-3">
                {/* Bouton hamburger */}
                <button
                    ref={btnRef}
                    aria-label="Ouvrir le menu"
                    aria-expanded={open}
                    aria-controls="main-menu"
                    onClick={() => setOpen((v) => !v)}
                    className="inline-flex items-center justify-center w-10 h-10 rounded hover:bg-[#222] focus:outline-none focus:ring focus:ring-emerald-500/40"
                >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                </button>

                <div
                    className="font-semibold tracking-wide cursor-pointer select-none"
                    onClick={() => nav("/")}
                    title="Accueil POS"
                >
                    Veg'N Bio POS
                </div>
            </div>

            {/* bloc droite */}
            <div className="flex items-center gap-3 md:gap-6">
                {/* Sélecteur de restaurant */}
                <div className="hidden sm:flex items-center gap-2">
                    <span className="text-xs opacity-70">Restaurant</span>
                    <select
                        className="bg-[#121212] border border-[#2a2a2a] rounded px-2 py-1 text-sm"
                        value={activeId || ""}
                        onChange={(e) => dispatch(setActiveRestaurant(Number(e.target.value) || null))}
                        disabled={restaurants.length === 0}
                        title={restaurants.length === 0 ? "Aucun restaurant disponible" : "Choisir un restaurant"}
                    >
                        {restaurants.length === 0 && <option value="">—</option>}
                        {restaurants.map((r) => (
                            <option key={r.id} value={r.id}>
                                {r.name} {r.city ? `• ${r.city}` : ""}
                            </option>
                        ))}
                    </select>
                </div>

                <span className="hidden sm:inline text-lg font-bold text-emerald-400">{formattedTime}</span>
                <span className="hidden sm:inline text-sm opacity-80">{user?.name || user?.email}</span>

                <button
                    className="px-3 py-1 rounded bg-red-600/80 hover:bg-red-600 text-sm"
                    onClick={onLogout}
                >
                    Déconnexion
                </button>
            </div>

            {/* Menu déroulant classique */}
            {open && (
                <div
                    id="main-menu"
                    ref={panelRef}
                    role="menu"
                    aria-label="Navigation"
                    className="absolute top-16 left-4 z-50 w-64 rounded-lg border border-[#2a2a2a] bg-[#101010] shadow-2xl md:left-8"
                >
                    <ul className="py-2">
                        <GroupTitle>POS</GroupTitle>
                        {POS_LINKS.map(({ to, label }) => (
                            <li key={to}>
                                <button
                                    onClick={() => go(to)}
                                    className="w-full text-left px-4 py-2 text-sm hover:bg-[#161616] focus:outline-none focus:ring focus:ring-emerald-500/30"
                                >
                                    {label}
                                </button>
                            </li>
                        ))}

                        <Divider />

                        <GroupTitle>Restaurant</GroupTitle>
                        {RESTO_LINKS.map(({ to, label }) => (
                            <li key={to}>
                                <button
                                    onClick={() => go(to)}
                                    className="w-full text-left px-4 py-2 text-sm hover:bg-[#161616] focus:outline-none focus:ring focus:ring-emerald-500/30"
                                >
                                    {label}
                                </button>
                            </li>
                        ))}

                        <Divider />

                        {/* ✅ Section Fournisseurs */}
                        <GroupTitle>Fournisseurs</GroupTitle>
                        {SUPPLIER_LINKS.map(({ to, label }) => (
                            <li key={to}>
                                <button
                                    onClick={() => go(to)}
                                    className="w-full text-left px-4 py-2 text-sm hover:bg-[#161616] focus:outline-none focus:ring focus:ring-emerald-500/30"
                                >
                                    {label}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </header>
    );
}

function GroupTitle({ children }) {
    return (
        <li className="px-4 py-1 text-[11px] uppercase tracking-wider text-emerald-400/90">
            {children}
        </li>
    );
}
function Divider() {
    return <li className="my-2 h-px bg-[#222]" />;
}
