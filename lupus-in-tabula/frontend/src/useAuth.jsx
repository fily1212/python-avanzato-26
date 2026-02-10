import { useState, useEffect, createContext, useContext } from 'react';
import { api } from './api';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined=loading, null=not logged in

  const check = async () => {
    try {
      const u = await api.me();
      setUser(u);
    } catch {
      setUser(null);
    }
  };

  useEffect(() => { check(); }, []);

  const login = async (username, password) => {
    await api.login(username, password);
    await check();
  };

  const register = async (username, password) => {
    await api.register(username, password);
    await check();
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, login, register, logout, refresh: check }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  return useContext(AuthCtx);
}
