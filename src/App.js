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
import GledajVideo from "./Naslovna/GledajVideo";
import TopLista from "./Naslovna/TopLista";
import Kontakt from "./Naslovna/Kontakt";

// ProtectedRoute komponenta za zaštitu ruta
const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
};

const RootRedirect = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return null; // Ili neki loading spinner
  }

  return user ? <Navigate to="/pocetna" replace /> : <Navigate to="/login" replace />;
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
            <Route path='/kontakt' element={<Kontakt />} />
            <Route path='/top-liste' element={<TopLista />} />
            <Route path='/gledaj-video' element={<GledajVideo />} />
            <Route path="/game/:gameId" element={<GameBoard />} />
            <Route path="/dodavanjetokena" element={<DodavanjeTokena />} allowedRoles={['admin']} />
            <Route path="/hand" element={<ProtectedRoute><PlayerHand /></ProtectedRoute>} />
            <Route path="/" element={<RootRedirect />} />
          </Routes>
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;
