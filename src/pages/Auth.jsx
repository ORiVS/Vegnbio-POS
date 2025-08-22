// src/pages/Auth.jsx
import { useState, useEffect } from "react";
import { login, getUserData } from "../https";
import { useDispatch } from "react-redux";
import { setUser } from "../redux/slices/userSlice";
import { useNavigate } from "react-router-dom";
import { mapDjangoUser } from "../utils/mapUser";

export default function Auth(){
  useEffect(()=>{ document.title="Veg'N Bio | Auth"; },[]);
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  const dispatch = useDispatch(); const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const res = await login({ email, password });
      const access = res?.data?.access || res?.data?.token;
      if (access) localStorage.setItem("access", access);
      const me = await getUserData();
      dispatch(setUser(mapDjangoUser(me.data)));
      nav("/");
    } catch(err){ setError("Identifiants invalides"); }
    finally { setLoading(false); }
  };

  return (
      <div className="min-h-[100vh] grid place-items-center">
        <form onSubmit={submit} className="w-[380px] bg-[#1a1a1a] p-6 rounded-xl border border-[#2a2a2a] space-y-3">
          <h1 className="text-xl font-semibold">Connexion</h1>
          <input className="w-full bg-[#121212] p-3 rounded" placeholder="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} />
          <input className="w-full bg-[#121212] p-3 rounded" placeholder="Mot de passe" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
          {error && <div className="text-red-400 text-sm">{error}</div>}
          <button disabled={loading} className="w-full py-3 rounded bg-emerald-600/90 hover:bg-emerald-600">
            {loading? "Connexion…" : "Se connecter"}
          </button>
        </form>
      </div>
  );
}
