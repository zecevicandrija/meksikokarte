import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "../Styles/SignUpPage.css";


const SignUpPage = () => {
  const [ime, setIme] = useState("");
  const [prezime, setPrezime] = useState("");
  const [email, setEmail] = useState("");
  const [sifra, setSifra] = useState("");
  const [uloga, setUloga] = useState("player");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post("http://localhost:5000/api/korisnici", {
        ime,
        prezime,
        email,
        sifra,
        uloga,
      });
      alert("Uspešno ste se registrovali!");
      navigate("/");
    } catch (error) {
      console.error("Greška prilikom registracije:", error);
    }
  };

  return (
    <div className="signup-container">
      <div className="signup-box">
        <h2>Sign Up</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Ime</label>
            <input
              type="text"
              value={ime}
              onChange={(e) => setIme(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Prezime</label>
            <input
              type="text"
              value={prezime}
              onChange={(e) => setPrezime(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Šifra</label>
            <input
              type="password"
              value={sifra}
              onChange={(e) => setSifra(e.target.value)}
              required
            />
          </div>
          {/* <div className="form-group">
            <label>Uloga</label>
            <select
              value={uloga}
              onChange={(e) => setUloga(e.target.value)}
              required
            >
              <option value="player" disabled>
                Odaberi ulogu
              </option>
              <option value="admin">Admin</option>
              <option value="player">Player</option>
            </select>
          </div> */}
          <button type="submit" className="signup-button">
            Sign Up
          </button>
        </form>
      </div>
    </div>
  );
};

export default SignUpPage;
