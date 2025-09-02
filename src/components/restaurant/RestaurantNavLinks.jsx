// src/components/restaurant/RestaurantNavLinks.jsx
import { NavLink } from 'react-router-dom';

const linkCls = ({ isActive }) =>
    `flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 ${isActive ? 'bg-green-100 text-green-700' : 'text-gray-700'}`;

export default function RestaurantNavLinks() {
    return (
        <>
            <NavLink to="/restaurant/dashboard" className={linkCls}>Tableau de bord</NavLink>
            <NavLink to="/restaurant/availability" className={linkCls}>Disponibilité du jour</NavLink>
            <NavLink to="/restaurant/reservations" className={linkCls}>Réservations</NavLink>
            <NavLink to="/restaurant/events" className={linkCls}>Évènements</NavLink>
            <NavLink to="/restaurant/settings" className={linkCls}>Paramètres établissement</NavLink>
            <NavLink to="/restaurant/settings/rooms" className={linkCls}>Salles</NavLink>
            <NavLink to="/restaurant/settings/hours" className={linkCls}>Horaires</NavLink>
        </>
    );
}
