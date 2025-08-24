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

    return (
        <header className="h-20 flex items-center justify-between px-8 border-b border-[#2a2a2a] bg-[#1a1a1a]">
            <div className="font-semibold tracking-wide cursor-pointer" onClick={() => nav("/")}>
                Veg'N Bio POS
            </div>

            <nav className="flex gap-6 text-sm">
                <Link to="/">Accueil</Link>
                <Link to="/orders">Commandes</Link>
                <Link to="/menu">Menu</Link>
                <Link to="/dashboard">Dashboard</Link>
            </nav>

            <div className="flex items-center gap-6">
                {/* Sélecteur de restaurant (affiché si des restos existent) */}
                <div className="flex items-center gap-2">
                    <span className="text-xs opacity-70">Restaurant</span>
                    <select
                        className="bg-[#121212] border border-[#2a2a2a] rounded px-2 py-1 text-sm"
                        value={activeId || ""}
                        onChange={(e) =>
                            dispatch(setActiveRestaurant(Number(e.target.value) || null))
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

                <span className="text-xl font-bold text-emerald-400">{formattedTime}</span>
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
