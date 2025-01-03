import React from "react";
import { BrowserRouter as Router, Route, Routes, Navigate } from "react-router-dom";
import Pocetna from "./Naslovna/Pocetna";
import GameBoard from "./Igra/GameBoard";
import PlayerHand from "./Igra/PlayerHand";
import LoginPage from "./Login/LoginPage";
import SignUpPage from "./Login/SignUpPage";
import { AuthProvider, useAuth } from './Login/AuthContext';

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
            <Route path="/" element={<ProtectedRoute><Pocetna /></ProtectedRoute>} />
            <Route path="/pocetna" element={<Pocetna />} />
            <Route path="/game/:gameId" element={<GameBoard />} />
            <Route path="/hand" element={<ProtectedRoute><PlayerHand /></ProtectedRoute>} />
          </Routes>
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;
