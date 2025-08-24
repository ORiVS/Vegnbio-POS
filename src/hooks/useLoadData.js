// src/hooks/useLoadData.js (exemple d’implémentation)
import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { getUserData } from "../https";
import { setUser } from "../redux/slices/userSlice";

export default function useLoadData() {
  const [loading, setLoading] = useState(true);
  const dispatch = useDispatch();

  useEffect(() => {
    (async () => {
      try {
        const r = await getUserData(); // GET /accounts/me/
        const u = r?.data || {};
        dispatch(
            setUser({
              email: u.email,
              name: `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.email,
              role: u.role,
              restaurants: Array.isArray(u.restaurants) ? u.restaurants : [],
              activeRestaurantId: u.active_restaurant_id ?? null,
            })
        );
      } catch {
        // pas authentifié → on laisse isAuth=false
      } finally {
        setLoading(false);
      }
    })();
  }, [dispatch]);

  return loading;
}
