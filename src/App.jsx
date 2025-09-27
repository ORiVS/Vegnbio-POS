// src/App.jsx
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import useLoadData from "./hooks/useLoadData";
import Header from "./components/shared/Header";
import FullScreenLoader from "./components/shared/FullScreenLoader";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import Orders from "./pages/Orders";
import OrderDetail from "./pages/OrderDetails";
import Menu from "./pages/Menu";
import Dashboard from "./pages/Dashboard";
import RestaurantRoutes from "./components/restaurant/RestaurantRoutes.jsx";

function Protected({ children }) {
    const { isAuth } = useSelector((s) => s.user);
    return isAuth ? children : <Navigate to="/auth" />;
}

export default function App() {
    const loading = useLoadData();
    const location = useLocation();
    const hideHeader = location.pathname.startsWith("/auth");

    if (loading) return <FullScreenLoader />;

    return (
        <>
            {!hideHeader && <Header />}
            <Routes>
                {/* POS */}
                <Route
                    path="/"
                    element={
                        <Protected>
                            <Home />
                        </Protected>
                    }
                />
                <Route path="/auth" element={<Auth />} />
                <Route
                    path="/dashboard"
                    element={
                        <Protected>
                            <Dashboard />
                        </Protected>
                    }
                />
                <Route
                    path="/orders"
                    element={
                        <Protected>
                            <Orders />
                        </Protected>
                    }
                />
                <Route
                    path="/orders/:orderId"
                    element={
                        <Protected>
                            <OrderDetail />
                        </Protected>
                    }
                />
                <Route
                    path="/menu"
                    element={
                        <Protected>
                            <Menu />
                        </Protected>
                    }
                />

                {/* — Espace restaurateur (toutes les sous-routes ici) — */}
                <Route
                    path="/restaurant/*"
                    element={
                        <Protected>
                            <RestaurantRoutes />
                        </Protected>
                    }
                />

                {/* 404 */}
                <Route path="*" element={<div className="p-8">Page introuvable</div>} />
            </Routes>
        </>
    );
}
