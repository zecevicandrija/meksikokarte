import React from 'react';
import '../Styles/Pravila.css';

const Pravila = () => {
  return (
    <div className="pravila-container">
      <h1 className="pravila-header">📜 Pravila Igre Meksiko</h1>

      <div className="rule-card fade-in">
        <h2>🎴 Osnovne Informacije</h2>
        <p>Meksiko je kartaška igra za tri igrača. Poznata je i po imenu Gangsteri. Igra se sa 32 karte:</p>
        <ul className="animated-list">
          <li>Jačina karata: <span className="highlight">7, 8, 9, 10, B, Q, K, A</span> (A je najjači)</li>
          <li>Boje: <span className="hearts">♥ Herc</span>, <span className="diamonds">♦ Karo</span>, <span className="clubs">♣ Tref</span>, <span className="spades">♠ Pik</span></li>
          <li>Alternativni špil ("mađarice"): Srce ♥, Žir 🌰, Tikva 🎃, List 🍃</li>
        </ul>
      </div>

      <div className="rule-card fade-in delay-1">
        <h2>🃏 Početak Igre</h2>
        <ul className="animated-list">
          <li>Svaki igrač dobija po 10 karata</li>
          <li>2 karte čine "talon"</li>
          <li>U svakoj rundi igrači bacaju po 1 kartu</li>
          <li>Najjača karta odnosi ruku (adut pobedjuje bilo koju drugu boju)</li>
        </ul>
      </div>

      <div className="rule-card fade-in delay-2">
        <h2>🎯 Cilj i Licitacija</h2>
        <div className="licitacija-animation">
          <div className="bid-bubble">5</div>
          <div className="bid-bubble higher">6</div>
          <div className="bid-bubble higher">7</div>
        </div>
        <ul className="animated-list">
          <li>Cilj: Odneti što više ruku</li>
          <li>Prvi igrač može licitirati 5, ostali moraju reći 6+</li>
          <li>Pobednik licitacije bira adut i baci 2 karte iz talona</li>
          <li>Pobednik partije: prvi koji dosegne 51 poen</li>
        </ul>
      </div>

      <div className="rule-card fade-in delay-3">
        <h2>🔥 Specijalna Pravila</h2>
        <div className="chili-medal">🌶️ Ljuta Papričica!</div>
        <ul className="animated-list">
          <li>Ako igrač ne ispuni licitaciju - pada za licitiranu vrednost</li>
          <li>Ako samostalno srušite licitatora - dobijate medalju</li>
          <li>U slučaju jednakih poena - podela pobede</li>
        </ul>
      </div>

      <div className="rule-card fade-in delay-4">
        <h2>🧠 Taktike i Saveti</h2>
        <div className="strategy-animation">
          <div className="card ace">A</div>
          <div className="card king">K</div>
          <div className="card queen">Q</div>
        </div>
        <ul className="animated-list">
          <li>Fokus na rušenje licitatora</li>
          <li>Kroz prijatelja igraj najjačom kartom</li>
          <li>Kroz protivnika igraj najslabijom kartom</li>
          <li>Prati protivničke odbacene karte</li>
        </ul>
      </div>
    </div>
  );
};

export default Pravila;