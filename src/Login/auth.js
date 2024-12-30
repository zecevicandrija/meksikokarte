import { useState } from 'react';
import { login } from '../services/api';

const useAuth = () => {
  const [user, setUser] = useState(null);

  const handleLogin = async (email, password) => {
    const userData = await login(email, password);
    setUser(userData);
  };

  return {
    user,
    handleLogin,
  };
};

export default useAuth;