import React, { createContext, useState, useContext, useEffect } from "react";
import axios from "axios";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [tokens, setTokens] = useState(0); // Dodajemo novo stanje za tokene
  const [loading, setLoading] = useState(true);

  // Dohvatanje podataka korisnika i tokena prilikom inicijalizacije
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    console.log("Stored user:", storedUser);

    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      if (parsedUser?.id) {
        setUser(parsedUser);
        fetchUserData(parsedUser.id);
        fetchTokens(parsedUser.id); // Dohvati tokene odmah
      }
    }
    setLoading(false);
  }, []);

  // Periodično ažuriranje last_active
  useEffect(() => {
    let interval;
    if (user && user.id) {
      interval = setInterval(() => {
        axios
          .post("http://localhost:5000/api/korisnici/update-last-active", { userId: user.id })
          .catch((err) => console.error("Greška pri update-u last_active:", err));
      }, 30000); // 30 sekundi
    }
    return () => clearInterval(interval);
  }, [user]);

  // Funkcija za dohvatanje korisničkih podataka
  const fetchUserData = async (userId) => {
    if (!userId) return;
    try {
      const response = await axios.get(`http://localhost:5000/api/korisnici/${userId}`);
      setUser(response.data);
      localStorage.setItem("user", JSON.stringify(response.data));
    } catch (error) {
      console.error("Greška pri dohvatanju korisničkih podataka:", error);
    }
  };

  // Nova funkcija za dohvatanje tokena
  const fetchTokens = async (userId) => {
    if (!userId) return;
    try {
      const response = await axios.get(`http://localhost:5000/api/tokeni/moji?userId=${userId}`);
      setTokens(response.data.tokeni || 0); // Postavi tokene iz responsa
    } catch (error) {
      console.error("Greška pri dohvatanju tokena:", error);
    }
  };

  // Funkcija za ažuriranje korisnika
  const updateUser = (newData) => {
    const updatedUser = { ...user, ...newData };
    setUser(updatedUser);
    localStorage.setItem("user", JSON.stringify(updatedUser));
  };

  // Nova funkcija za ažuriranje tokena
  const updateTokens = async (userId) => {
    if (!userId) return;
    try {
      const response = await axios.get(`http://localhost:5000/api/tokeni/moji?userId=${userId}`);
      setTokens(response.data.tokeni || 0); // Ažuriraj tokene
    } catch (error) {
      console.error("Greška pri ažuriranju tokena:", error);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await axios.post("http://localhost:5000/api/korisnici/login", {
        email,
        sifra: password,
      });
      const userData = response.data;
      setUser(userData);
      localStorage.setItem("user", JSON.stringify(userData));
      fetchTokens(userData.id); // Dohvati tokene nakon logina
    } catch (error) {
      console.error("Login error:", error.response?.data || error.message);
      throw error;
    }
  };

  const googleLogin = async (token) => {
    try {
      const response = await axios.post(
        "http://localhost:5000/api/auth/google",
        { token },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      if (response.data?.token) {
        const userData = { ...response.data, token: response.data.token };
        setUser(userData);
        localStorage.setItem("user", JSON.stringify(userData));
        axios.defaults.headers.common["Authorization"] = `Bearer ${response.data.token}`;
        fetchTokens(userData.id); // Dohvati tokene nakon Google logina
      }
    } catch (error) {
      console.error("Google login error:", error);
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    setTokens(0); // Resetuj tokene na 0 prilikom logout-a
    localStorage.removeItem("user");
  };

  const value = {
    user,
    tokens, // Dodajemo tokene u kontekst
    login,
    googleLogin,
    logout,
    updateUser,
    updateTokens, // Dodajemo funkciju za ažuriranje tokena
    isLoggedIn: !!user,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);