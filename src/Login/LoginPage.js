// LoginPage.js
import React, { useState } from "react";
import { useAuth } from "./AuthContext";
import { useNavigate } from "react-router-dom";
import "../Styles/LoginPage.css";

const LoginPage = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      await login(username, password);
      navigate("/pocetna");
    } catch (error) {
      setErrorMessage("Invalid login credentials. Please try again.");
      console.error("Login error:", error);
    }
  };

  const handleSignUp = () => {
    navigate("/signup");
  };

  return (
    <div className="login-container">
      <div className="login-content">
        {/* Left section */}
        <div className="login-image">
          <div className="image-text">
            <h1>JOIN THE LARGEST ART COMMUNITY IN THE WORLD</h1>
            <p>
              Explore and discover art, become a better artist, connect with
              others over mutual hobbies, or buy and sell work - you can do it
              all here.
            </p>
          </div>
        </div>

        {/* Right section */}
        <div className="login-form">
          <h2>Log In</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Mail Adresa</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Lozinka</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="form-actions">
              <button type="submit" className="primary-button">
                Uloguj se
              </button>
              <p className="small-text">
                Zaboravili ste lozinku?{" "}
                <a href="#">Promeni.</a>
              </p>
            </div>
          </form>

          <div className="social-login">
            <p>ili</p>
            <div className="social-buttons">
              <button className="social-btn google-btn">Nastavite sa Google</button>
              <button className="social-btn apple-btn">Nastavite sa Apple</button>
            </div>
          </div>

          <div className="signup-section">
            <p>
              Nemate nalog?{" "}
              <button onClick={handleSignUp} className="signup-link">
                Registrujte se
              </button>
            </p>
          </div>

          {errorMessage && <div className="error-message">{errorMessage}</div>}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;