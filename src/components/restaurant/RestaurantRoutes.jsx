// src/components/restaurant/RestaurantRoutes.jsx
import { Routes, Route, Navigate } from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import Availability from "./pages/Availability";
import Reservations from "./pages/Reservations";

import EventsList from "./pages/events/EventsList";
import EventForm from "./pages/events/EventForm";
import EventInvitations from "./pages/events/EventInvitations";
import EventRegistrations from "./pages/events/EventRegistrations";

import RestaurantSettings from "./pages/settings/RestaurantSettings";
import Rooms from "./pages/settings/Rooms";
import Hours from "./pages/settings/Hours";
import Closures from "./pages/settings/Closures";

import MarketList from "./pages/market/MarketList";
import MyOrders from "./pages/purchasing/MyOrders";

export default function RestaurantRoutes() {
        return (
            <Routes>
                    <Route index element={<Navigate to="dashboard" replace />} />
                    <Route path="dashboard" element={<Dashboard />} />
                    <Route path="availability" element={<Availability />} />
                    <Route path="reservations" element={<Reservations />} />

                    {/* Évènements */}
                    <Route path="events" element={<EventsList />} />
                    <Route path="events/new" element={<EventForm mode="create" />} />
                    <Route path="events/:id/edit" element={<EventForm mode="edit" />} />
                    <Route path="events/:id/invitations" element={<EventInvitations />} />
                    <Route path="events/:id/registrations" element={<EventRegistrations />} />

                    {/* Paramètres */}
                    <Route path="settings" element={<RestaurantSettings />} />
                    <Route path="settings/rooms" element={<Rooms />} />
                    <Route path="settings/hours" element={<Hours />} />
                    <Route path="settings/closures" element={<Closures />} />

                    {/* ✅ Fournisseurs */}
                    <Route path="market" element={<MarketList />} />
                    <Route path="purchasing/orders" element={<MyOrders />} />

                    <Route path="*" element={<Navigate to="dashboard" replace />} />
            </Routes>
        );
}
