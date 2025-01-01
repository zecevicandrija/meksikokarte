import React, { createContext, useState, useContext, useEffect } from "react";
import axios from "axios";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  // Initialize user from localStorage when the provider mounts
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    console.log('Stored user:', storedUser); // Debug log
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);
  
  
  const login = async (email, password) => {
    try {
      const response = await axios.post('http://localhost:5000/api/korisnici/login', {
        email,
        sifra: password,
      });
      const userData = response.data;
      console.log('Login response:', userData); // Debug log
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
    isLoggedIn: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
