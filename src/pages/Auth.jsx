import React, { useEffect, useState } from "react";
import restaurant from "../assets/images/restaurant-img.jpg";
import logo from "../assets/images/logo.png";
import Register from "../components/auth/Register";
import Login from "../components/auth/Login";

const Auth = () => {
  useEffect(() => {
    document.title = "Veg'N Bio | Auth";
  }, []);

  const [isRegister, setIsRegister] = useState(false);

  return (
      <div className="flex min-h-screen w-full">
        {/* Section gauche */}
        <div className="w-1/2 relative flex items-center justify-center bg-cover">
          {/* BG Image */}
          <img className="w-full h-full object-cover" src={restaurant} alt="Restaurant Veg'N Bio" />

          {/* Overlay */}
          <div className="absolute inset-0 bg-black bg-opacity-80"></div>

          {/* Citation bas */}
          <blockquote className="absolute bottom-10 px-8 mb-10 text-2xl italic text-white max-w-[90%]">
            « Servez une cuisine de qualité avec un service rapide et chaleureux, dans une
            ambiance accueillante, et vos clients reviendront toujours. »
            <br />
            <span className="block mt-4 text-green-600">— Veg'N Bio</span>
          </blockquote>
        </div>

        {/* Section droite */}
        <div className="w-1/2 min-h-screen bg-[#1a1a1a] p-10">
          <div className="flex flex-col items-center gap-2">
            <img src={logo} alt="Logo Veg'N Bio" className="h-14 w-14 border-2 rounded-full p-1" />
            <h1 className="text-lg font-semibold text-[#f5f5f5] tracking-wide">Veg'N Bio — POS</h1>
          </div>

          <h2 className="text-4xl text-center mt-10 font-semibold text-green-600 mb-10">
            {isRegister ? "Créer un compte employé" : "Connexion employé"}
          </h2>

          {/* Formulaires */}
          {isRegister ? <Register setIsRegister={setIsRegister} /> : <Login />}

          <div className="flex justify-center mt-6">
            <p className="text-sm text-[#ababab] space-x-2">
              <span>{isRegister ? "Déjà inscrit ?" : "Pas encore de compte ?"}</span>
              <a
                  onClick={() => setIsRegister(!isRegister)}
                  className="text-green-600 font-semibold hover:underline cursor-pointer"
              >
                {isRegister ? "Se connecter" : "Créer un compte"}
              </a>
            </p>
          </div>
        </div>
      </div>
  );
};

export default Auth;
