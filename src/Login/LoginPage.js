import React, { useState } from "react";
import { useAuth } from "./AuthContext";
import { useNavigate } from "react-router-dom";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";
import "../Styles/LoginPage.css";

const LoginPage = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const { login, googleLogin  } = useAuth();
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

  // Funkcija koja se poziva kada Google login uspe
  const handleGoogleSuccess = async (response) => {
    try {
      // Koristimo originalni Google token (response.credential)
      await googleLogin(response.credential);
      navigate("/pocetna");
    } catch (error) {
      console.error("Greška pri Google prijavi:", error);
      setErrorMessage(error.message || "Greška pri Google prijavi.");
    }
  };

  // Funkcija koja se poziva ako Google login ne uspe
  const handleGoogleFailure = (error) => {
    console.error("Google login nije uspeo:", error);
    setErrorMessage("Google prijava nije uspela. Pokušaj ponovo.");
  };

  return (
    <div className="login-container">
      <div className="login-content">
        {/* Left section */}
        <div className="login-image">
          <div className="image-text">
            <h1>Pridruži se najvećoj zajednici ljubitelja kartanja!</h1>
          </div>
        </div>
        {/* <h1 className="meksikoheader">MEKSIKO</h1> */}
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
                Zaboravili ste lozinku? <a href="#">Promeni.</a>
              </p>
            </div>
          </form>

          <div className="social-login">
            <p>ili</p>
            <div className="social-buttons">
              {/* Google OAuth Provider sa tvojim Client ID-om */}
              <GoogleOAuthProvider clientId='885612842021-gjcbruahl4h33qd6rfm7i5g00nq03v0v.apps.googleusercontent.com' redirectUri='http://localhost:3000'>
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleFailure}
                  text="signin_with" // Tekst na dugmetu: "Sign in with Google"
                />
              </GoogleOAuthProvider>
              {/* <button className="social-btn apple-btn">Nastavite sa Apple</button> */}
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