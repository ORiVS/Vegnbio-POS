// src/components/shared/Header.jsx
import { useSelector, useDispatch } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { logout } from "../../https";
import { removeUser, setActiveRestaurant } from "../../redux/slices/userSlice";
import { useState, useEffect } from "react";

export default function Header() {
    const user = useSelector((s) => s.user);
    const nav = useNavigate();
    const dispatch = useDispatch();

    const [time, setTime] = useState(new Date());
    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
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

    // Sélection par défaut : si on a des restos mais pas d'actif, prendre le premier
    useEffect(() => {
        if (!activeId && restaurants.length > 0) {
            dispatch(setActiveRestaurant(restaurants[0].id));
        }
    }, [activeId, restaurants, dispatch]);

    return (
        <header className="h-20 flex items-center justify-between px-8 border-b border-[#2a2a2a] bg-[#1a1a1a]">
            <div
                className="font-semibold tracking-wide cursor-pointer"
                onClick={() => nav("/")}
            >
                Veg'N Bio POS
            </div>

            {/* Nav principale (POS + Restaurant) */}
            <nav className="flex gap-6 text-sm">
                {/* POS */}
                <Link to="/">Accueil</Link>
                <Link to="/orders">Commandes</Link>
                <Link to="/menu">Menu</Link>
                <Link to="/dashboard">Dashboard</Link>

                {/* Bloc Restaurant (frontend restaurateur) */}
                <Link to="/restaurant/dashboard">Resto • Board</Link>
                <Link to="/restaurant/availability">Resto • Dispos</Link>
                <Link to="/restaurant/reservations">Resto • Réservations</Link>
                <Link to="/restaurant/events">Resto • Évènements</Link>
                <Link to="/restaurant/settings">Resto • Paramètres</Link>
            </nav>

            <div className="flex items-center gap-6">
                {/* Sélecteur de restaurant (si des restos existent) */}
                <div className="flex items-center gap-2">
                    <span className="text-xs opacity-70">Restaurant</span>
                    <select
                        className="bg-[#121212] border border-[#2a2a2a] rounded px-2 py-1 text-sm"
                        value={activeId || ""}
                        onChange={(e) =>
                            dispatch(setActiveRestaurant(Number(e.target.value) || null))
                        }
                        disabled={restaurants.length === 0}
                        title={
                            restaurants.length === 0
                                ? "Aucun restaurant disponible"
                                : "Choisir un restaurant"
                        }
                    >
                        {restaurants.length === 0 && <option value="">—</option>}
                        {restaurants.map((r) => (
                            <option key={r.id} value={r.id}>
                                {r.name} {r.city ? `• ${r.city}` : ""}
                            </option>
                        ))}
                    </select>
                </div>

                <span className="text-xl font-bold text-emerald-400">
          {formattedTime}
        </span>
                <span className="text-sm opacity-80">{user?.name || user?.email}</span>
                <button
                    className="px-3 py-1 rounded bg-red-600/80 hover:bg-red-600 text-sm"
                    onClick={onLogout}
                >
                    Déconnexion
                </button>
            </div>
        </header>
    );
}
