import React, { createContext, useState, useContext, useEffect } from "react";
import axios from "axios";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize user from localStorage when the provider mounts
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    console.log('Stored user:', storedUser);

    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      
      if (parsedUser?.id) { // Proveri da li postoji ID
        setUser(parsedUser);
        fetchUserData(parsedUser.id);
      }
    }
    
    setLoading(false);
  }, []);

  const fetchUserData = async (userId) => {
    if (!userId) return; // Ako userId nije definisan, ne radi ništa
  
    try {
      const response = await axios.get(`http://localhost:5000/api/korisnici/${userId}`);
      setUser(response.data);
      localStorage.setItem('user', JSON.stringify(response.data));
    } catch (error) {
      console.error('Greška pri dohvatanju korisničkih podataka:', error);
    }
  };
  
  

  const updateUser = (newData) => {
    const updatedUser = { ...user, ...newData };
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };
  
  
  const login = async (email, password) => {
    try {
      const response = await axios.post('http://localhost:5000/api/korisnici/login', {
        email,
        sifra: password,
      });
      const userData = response.data;
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
    } catch (error) {
      console.error('Login error:', error.response?.data || error.message);
      throw error;
    }
  };
  
  

  const logout = () => {
    setUser(null);
    localStorage.removeItem("user"); // Remove user from localStorage
  };

  const value = {
    user,
    login,
    logout,
    updateUser, // dodato
    isLoggedIn: !!user,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
