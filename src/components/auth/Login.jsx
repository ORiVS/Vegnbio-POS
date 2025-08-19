import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { login, getMe } from "../../https";
import { enqueueSnackbar } from "notistack";
import { useDispatch } from "react-redux";
import { setUser } from "../../redux/slices/userSlice";
import { useNavigate } from "react-router-dom";
import { mapDjangoUser } from "../../utils/mapUser";


const Login = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const [formData, setFormData] = useState({ email: "", password: "" });

    const handleChange = (e) => {
        setFormData((s) => ({ ...s, [e.target.name]: e.target.value }));
    };

    const loginMutation = useMutation({
        mutationFn: (reqData) => login(reqData),
        onSuccess: async (res) => {
            const access = res?.data?.access;
            const userFromLogin = res?.data?.user; // selon ton endpoint
            if (access) localStorage.setItem("access", access);

            let user = userFromLogin;
            if (!user) {
                const me = await getMe();       // ou getUserData()
                user = me.data;                 // <-- pas me.data.data
            }
            dispatch(setUser(mapDjangoUser(user)));
            navigate("/");
        },
        onError: (error) => {
            const message = error?.response?.data?.message || "Identifiants invalides.";
            enqueueSnackbar(message, { variant: "error" });
        },
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        loginMutation.mutate(formData);
    };

    return (
        <div>
            <form onSubmit={handleSubmit}>
                <div>
                    <label className="block text-[#ababab] mb-2 mt-3 text-sm font-medium">
                        Email restaurateur
                    </label>
                    <div className="flex item-center rounded-lg p-5 px-4 bg-[#1f1f1f]">
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            placeholder="chef@vegnbio.com"
                            className="bg-transparent flex-1 text-white focus:outline-none"
                            required
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-[#ababab] mb-2 mt-3 text-sm font-medium">
                        Mot de passe
                    </label>
                    <div className="flex item-center rounded-lg p-5 px-4 bg-[#1f1f1f]">
                        <input
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            placeholder="••••••••"
                            className="bg-transparent flex-1 text-white focus:outline-none"
                            required
                        />
                    </div>
                </div>

                <button
                    type="submit"
                    className="w-full rounded-lg mt-6 py-3 text-lg bg-green-600 hover:bg-green-700 text-white font-bold"
                >
                    Se connecter
                </button>
            </form>
        </div>
    );
};

export default Login;
