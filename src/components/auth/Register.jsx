import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { register } from "../../https";
import { enqueueSnackbar } from "notistack";

const Register = ({ setIsRegister }) => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    role: "RESTAURATEUR", // valeur par défaut
    restaurant_name: "",
    location: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    // champs plats + champs du profile (on les garde à plat, on assemblera avant l’appel API)
    setFormData((s) => ({ ...s, [name]: value }));
  };

  const handleRoleSelection = (selectedRole) => {
    // Map affichage -> rôle API si besoin
    // Waiter/Cashier/Admin côté UI -> "SERVEUR" / "CAISSIER" / "ADMIN" ?
    // Ici, on colle à ton enum API (RESTAURATEUR / ADMIN / ...)
    setFormData((s) => ({ ...s, role: selectedRole }));
  };

  const registerMutation = useMutation({
    mutationFn: (reqData) => {
      // On assemble exactement le payload attendu par Django
      const payload = {
        email: reqData.email,
        password: reqData.password,
        first_name: reqData.first_name,
        last_name: reqData.last_name,
        role: reqData.role, // "RESTAURATEUR" | "ADMIN" | etc.
        profile: {
          restaurant_name: reqData.restaurant_name,
          location: reqData.location,
        },
      };
      return register(payload);
    },
    onSuccess: (res) => {
      const { data } = res;
      enqueueSnackbar(data?.message || "Compte créé avec succès.", { variant: "success" });

      setFormData({
        email: "",
        password: "",
        first_name: "",
        last_name: "",
        role: "RESTAURATEUR",
        restaurant_name: "",
        location: "",
      });

      setTimeout(() => setIsRegister(false), 1000);
    },
    onError: (error) => {
      const message = error?.response?.data?.message || "Inscription impossible.";
      enqueueSnackbar(message, { variant: "error" });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    registerMutation.mutate(formData);
  };

  const roleOptions = [
    { label: "Restaurateur", value: "RESTAURATEUR" },
    { label: "Admin", value: "ADMIN" },
    // ajoute d’autres rôles si ton API les gère (CAISSIER, SERVEUR, etc.)
  ];

  return (
      <div>
        <form onSubmit={handleSubmit}>
          {/* Nom */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[#ababab] mb-2 text-sm font-medium">Prénom</label>
              <div className="flex item-center rounded-lg p-5 px-4 bg-[#1f1f1f]">
                <input
                    type="text"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleChange}
                    placeholder="Michel"
                    className="bg-transparent flex-1 text-white focus:outline-none"
                    required
                />
              </div>
            </div>
            <div>
              <label className="block text-[#ababab] mb-2 text-sm font-medium">Nom</label>
              <div className="flex item-center rounded-lg p-5 px-4 bg-[#1f1f1f]">
                <input
                    type="text"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleChange}
                    placeholder="Resto"
                    className="bg-transparent flex-1 text-white focus:outline-none"
                    required
                />
              </div>
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-[#ababab] mb-2 mt-3 text-sm font-medium">Email</label>
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

          {/* Password */}
          <div>
            <label className="block text-[#ababab] mb-2 mt-3 text-sm font-medium">Mot de passe</label>
            <div className="flex item-center rounded-lg p-5 px-4 bg-[#1f1f1f]">
              <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Password123!"
                  className="bg-transparent flex-1 text-white focus:outline-none"
                  required
              />
            </div>
          </div>

          {/* Profile: restaurant_name & location */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[#ababab] mb-2 mt-3 text-sm font-medium">Nom du restaurant</label>
              <div className="flex item-center rounded-lg p-5 px-4 bg-[#1f1f1f]">
                <input
                    type="text"
                    name="restaurant_name"
                    value={formData.restaurant_name}
                    onChange={handleChange}
                    placeholder="Veg'N Bio Bastille"
                    className="bg-transparent flex-1 text-white focus:outline-none"
                    required
                />
              </div>
            </div>
            <div>
              <label className="block text-[#ababab] mb-2 mt-3 text-sm font-medium">Localisation</label>
              <div className="flex item-center rounded-lg p-5 px-4 bg-[#1f1f1f]">
                <input
                    type="text"
                    name="location"
                    value={formData.location}
                    onChange={handleChange}
                    placeholder="Paris 11e"
                    className="bg-transparent flex-1 text-white focus:outline-none"
                    required
                />
              </div>
            </div>
          </div>

          {/* Role */}
          <div>
            <label className="block text-[#ababab] mb-2 mt-3 text-sm font-medium">Rôle</label>
            <div className="grid grid-cols-2 gap-3 mt-1">
              {roleOptions.map((r) => (
                  <button
                      key={r.value}
                      type="button"
                      onClick={() => handleRoleSelection(r.value)}
                      className={`px-4 py-3 w-full rounded-lg text-[#e5e5e5] transition
                  ${formData.role === r.value ? "bg-green-700" : "bg-[#1f1f1f] hover:bg-[#242424]"}`}
                  >
                    {r.label}
                  </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <button
              type="submit"
              className="w-full rounded-lg mt-6 py-3 text-lg bg-green-600 hover:bg-green-700 text-white font-bold"
          >
            Créer mon compte
          </button>
        </form>
      </div>
  );
};

export default Register;
