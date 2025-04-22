import React from 'react';
import '../Styles/Pravila.css';

const Pravila = () => {
  return (
    <div className="pravila-container1">
      <h1 className="pravila-header1">📜 Pravila Igre Meksiko</h1>

      <div className="rule-card1 fade-in1">
        <h2>🎴 Osnovne Informacije</h2>
        <p>Meksiko je kartaška igra za tri igrača. Igra se sa 32 karte:</p>
        <ul className="animated-list1">
          <li>Jačina karata: <span className="highlight1">7, 8, 9, 10, B, Q, K, A</span> (A je najjači)</li>
          <li>Boje: <span className="hearts1">♥ Herc</span>, <span className="diamonds1">♦ Karo</span>, <span className="clubs1">♣ Tref</span>, <span className="spades1">♠ Pik</span></li>
        </ul>
      </div>

      <div className="rule-card1 fade-in1 delay-11">
        <h2>🃏 Početak Igre</h2>
        <ul className="animated-list1">
          <li>Svaki igrač dobija po 10 karata</li>
          <li>2 karte čine "talon"</li>
          <li>U svakoj rundi igrači bacaju po 1 kartu</li>
          <li>Najjača karta odnosi ruku (adut pobedjuje bilo koju drugu boju)</li>
        </ul>
      </div>

      <div className="rule-card1 fade-in1 delay-21">
        <h2>🎯 Cilj i Licitacija</h2>
        <div className="licitacija-animation1">
          <div className="bid-bubble1">5</div>
          <div className="bid-bubble1 higher1">6</div>
          <div className="bid-bubble1 higher1">7</div>
        </div>
        <ul className="animated-list1">
          <li>Cilj: Odneti što više ruku</li>
          <li>Prvi igrač može licitirati 5, ostali moraju reći 6+</li>
          <li>Pobednik licitacije bira adut i baci 2 karte iz talona</li>
          <li>Pobednik partije: prvi koji dosegne 51 poen</li>
        </ul>
      </div>

      <div className="rule-card1 fade-in1 delay-31">
        <h2>🔥 Specijalna Pravila</h2>
        <ul className="animated-list1">
          <li>Ako igrač ne ispuni licitaciju - pada za duplu licitiranu vrednost</li>
          <li>U slučaju jednakih poena - igra se do kraja</li>
        </ul>
      </div>

      <div className="rule-card1 fade-in1 delay-41">
        <h2>🧠 Taktike i Saveti</h2>
        <div className="strategy-animation1">
          <img src="/Slike/A_hearts.png" alt="As" className="pravila-card1 ace1" />
          <img src="/Slike/K_spades.png" alt="Kralj" className="pravila-card1 king1" />
          <img src="/Slike/Q_diamonds.png" alt="Kraljica" className="pravila-card1 queen1" />
        </div>
        <ul className="animated-list1">
          <li>Fokus na rušenje licitatora</li>
          <li>Kroz prijatelja igraj najjačom kartom</li>
          <li>Kroz protivnika igraj najslabijom kartom</li>
          <li>Prati protivničke odbačene karte</li>
          <li>Svaka dama se jaše osim adutske</li>
        </ul>
      </div>
    </div>
  );
};

export default Pravila;