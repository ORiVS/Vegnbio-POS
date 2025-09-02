// src/components/restaurant/hooks/useActiveRestaurantId.js
import { useSelector } from "react-redux";

export default function useActiveRestaurantId() {
    return useSelector((s) => s.user?.activeRestaurantId || null);
}
