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
    const run = async () => {
      const token = localStorage.getItem("access");
      if (!token) { setIsLoading(false); return; }
      try {
        const { data } = await getUserData();
        if (!alive) return;
        dispatch(setUser(mapDjangoUser(data)));
      } catch (error) {
        if (!alive) return;
        dispatch(removeUser());
        navigate("/auth");
        console.error(error);
      } finally {
        if (alive) setIsLoading(false);
      }
    };
    run();
    return () => { alive = false; };
  }, [dispatch, navigate]);

  return isLoading;
};

export default useLoadData;
