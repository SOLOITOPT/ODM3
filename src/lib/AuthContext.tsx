import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, setApiAuthToken, setUnauthorizedHandler } from '@/lib/api';

type AuthContextValue = {
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);

  const login = useCallback((newToken: string) => {
    setApiAuthToken(newToken);
    setToken(newToken);
  }, []);

  const logout = useCallback(() => {
    if (token) {
      api.auth.logout().catch(() => {
        // Ignore network errors on logout
      });
    }
    setApiAuthToken(null);
    setToken(null);
  }, [token]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setApiAuthToken(null);
      setToken(null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated: token !== null, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
