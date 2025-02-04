import React from "react";
import { BrowserRouter as Router, Route, Routes, Navigate } from "react-router-dom";
import Pocetna from "./Naslovna/Pocetna";
import GameBoard from "./Igra/GameBoard";
import PlayerHand from "./Igra/PlayerHand";
import LoginPage from "./Login/LoginPage";
import SignUpPage from "./Login/SignUpPage";
import { AuthProvider, useAuth } from './Login/AuthContext';
import Pravila from "./Naslovna/Pravila";
import MojProfil from "./Profil/MojProfil";
import DodavanjeTokena from "./Profil/DodavanjeTokena";

// ProtectedRoute komponenta za zaštitu ruta
const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <div>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignUpPage />} />
            <Route path="/pocetna" element={<Pocetna />} />
            <Route path='/pravila' element={<Pravila />} />
            <Route path='/profil' element={<MojProfil />} />
            <Route path="/game/:gameId" element={<GameBoard />} />
            <Route path="/dodavanjetokena" element={<DodavanjeTokena />} />
            <Route path="/hand" element={<ProtectedRoute><PlayerHand /></ProtectedRoute>} />
            <Route path="/" element={<ProtectedRoute><Pocetna /></ProtectedRoute>} />
          </Routes>
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;
