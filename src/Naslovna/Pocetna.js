import React from "react";
import "../Styles/Pocetna.css";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../Login/AuthContext";
import axios from "axios";

const Pocetna = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const igrajHandler = async () => {
    console.log('Current user:', user);
    if (!user || !user.id) {
      console.error('Korisnik nije prijavljen!');
      return;
    }
  
    try {
      const response = await axios.post('http://localhost:5000/api/games', { userId: user.id });
      const { gameId } = response.data;
      navigate(`/game/${gameId}`);
    } catch (error) {
      console.error('Greška prilikom kreiranja ili pridruživanja igri:', error.response?.data || error.message);
    }
  };
  
  
  

  const loginHandler = () => {
    navigate("/login");
  };

  const logoutHandler = () => {
    logout();
    navigate("/login");
  };

  const pravilaHandler = () => {
    navigate("/pravila");
  };

  const profilHandler = () => {
    navigate("/profil");
  };

  return (
    <div className="pocetna">
      <header className="pocetna-header">
        <h1 className="pocetna-title">Dobrodošli u Meksiko</h1>
        <p className="pocetna-subtitle">Započnite igru i uživajte!</p>
      </header>
      <main className="pocetna-main">
        <button className="pocetna-btn" onClick={igrajHandler}>
          Igraj
        </button>
        <button className="pocetna-btn" onClick={profilHandler}>Moj Profil</button>
        <button className="pocetna-btn" onClick={pravilaHandler}>Pravila Igre</button>
        <button className="pocetna-btn">Privatna partija</button>
        <button className="pocetna-btn">Podesavanja</button>
        {user ? (
          <button className="pocetna-btn" onClick={logoutHandler}>
            Logout
          </button>
        ) : (
          <button className="pocetna-btn" onClick={loginHandler}>
            Login
          </button>
        )}
      </main>
      <footer className="pocetna-footer">
        <p>© 2024 Meksiko. Sva prava zadržana.</p>
      </footer>
    </div>
  );
};

export default Pocetna;
