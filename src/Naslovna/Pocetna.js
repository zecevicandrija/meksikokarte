import React from "react";
import '../Styles/Pocetna.css'

const Pocetna = () => {
  return (
    <div className="pocetna">
      <header className="pocetna-header">
        <h1 className="pocetna-title">Dobrodošli u Meksiko</h1>
        <p className="pocetna-subtitle">Započnite igru i uživajte!</p>
      </header>
      <main className="pocetna-main">
        <button className="pocetna-btn" >
          Igraj
        </button>
        <button className="pocetna-btn">
          Moj Profil
        </button>
        <button
          className="pocetna-btn"
        >
          Pravila Igre
        </button>
        <button
          className="pocetna-btn"
        >
          Podesavanja
        </button>
      </main>
      <footer className="pocetna-footer">
        <p>© 2024 Meksiko. Sva prava zadržana.</p>
      </footer>
    </div>
  );
};

export default Pocetna;
