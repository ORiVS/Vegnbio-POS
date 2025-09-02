// src/components/restaurant/RestaurantSwitcher.jsx
import { useEffect, useState } from 'react';
import { apiListRestaurants } from './api';

const KEY = 'vegnbio_active_restaurant_id';

export default function RestaurantSwitcher({ className }) {
    const [restaurants, setRestaurants] = useState([]);
    const [activeId, setActiveId] = useState(() => {
        const saved = localStorage.getItem(KEY);
        return saved ? Number(saved) : null;
    });

    useEffect(() => {
        let alive = true;
        apiListRestaurants().then((data) => {
            if (!alive) return;
            setRestaurants(data || []);
            if (!activeId && data?.length) {
                localStorage.setItem(KEY, String(data[0].id));
                setActiveId(data[0].id);
            }
        }).catch(()=>{});
        return () => { alive = false; };
    }, []); // load once

    function onChange(e) {
        const id = Number(e.target.value);
        setActiveId(id);
        localStorage.setItem(KEY, String(id));
        window.dispatchEvent(new CustomEvent('vegnbio:restaurant:change', { detail: { id } }));
    }

    if (!restaurants.length) return <div className={className}>Aucun restaurant</div>;

    return (
        <select className={className || 'border rounded px-3 py-2 w-full'} value={activeId || ''} onChange={onChange}>
            {restaurants.map(r => <option key={r.id} value={r.id}>{r.name} — {r.city}</option>)}
        </select>
    );
}

export function useActiveRestaurantId() {
    const [id, setId] = useState(() => {
        const saved = localStorage.getItem(KEY);
        return saved ? Number(saved) : null;
    });
    useEffect(() => {
        const handler = (e) => setId(e.detail?.id ?? null);
        window.addEventListener('vegnbio:restaurant:change', handler);
        return () => window.removeEventListener('vegnbio:restaurant:change', handler);
    }, []);
    return id;
}
