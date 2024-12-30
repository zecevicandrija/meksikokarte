import React from "react";
import Pocetna from './Naslovna/Pocetna';
import GameBoard from "./Igra/GameBoard";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import PlayerHand from "./Igra/PlayerHand";


function App() {
  return (
    <Router>
      <div>
        <Routes>
          <Route path="/" element={<Pocetna />} />
          <Route path="/gameboard" element={<GameBoard />} />
          <Route path="/hand" element={<PlayerHand />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
