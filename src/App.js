import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Pocetna from "./Naslovna/Pocetna";
import GameBoard from "./Igra/GameBoard";
import PlayerHand from "./Igra/PlayerHand";
import LoginPage from "./Login/LoginPage";
import SignUpPage from "./Login/SignUpPage";
import { AuthProvider } from './Login/AuthContext';


function App() {
  return (
    <Router>
      <AuthProvider>
      <div>
        <Routes>
          <Route path="/" element={<Pocetna />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/game/:gameId/:userId" element={<GameBoard />} allowedRoles={['admin']}/>
          <Route path="/hand" element={<PlayerHand />} />
        </Routes>
      </div>
      </AuthProvider>
    </Router>
  );
}

export default App;
