import { useDispatch } from "react-redux";
import { getUserData } from "../https";
import { useEffect, useState } from "react";
import { removeUser, setUser } from "../redux/slices/userSlice";
import { useNavigate } from "react-router-dom";
import { mapDjangoUser } from "../utils/mapUser";


const useLoadData = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    const fetchUser = async () => {
      try {
        const { data } = await getUserData();
        console.log(data); // <-- ici tu voyais déjà: { email, first_name, last_name, role, profile }
        if (!alive) return;

        // ✅ on lit directement data (pas data.data)
        const user = mapDjangoUser(data);
        dispatch(setUser(user));
      } catch (error) {
        if (!alive) return;
        dispatch(removeUser());
        navigate("/auth");
        console.error(error);
      } finally {
        if (alive) setIsLoading(false);
      }
    };

    fetchUser();
    return () => {
      alive = false;
    };
  }, [dispatch, navigate]);

  return isLoading;
};

export default useLoadData;
