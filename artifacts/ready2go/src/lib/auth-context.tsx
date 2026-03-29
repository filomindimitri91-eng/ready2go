import React, { createContext, useContext, useState, useEffect } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";

interface AuthState {
  userId: number | null;
  username: string | null;
  login: (id: number, username: string, token: string) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<number | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const storedId = localStorage.getItem("r2g_userId");
      const storedUsername = localStorage.getItem("r2g_username");
      const storedToken = localStorage.getItem("r2g_token");
      if (storedId && storedUsername && storedToken) {
        setUserId(parseInt(storedId, 10));
        setUsername(storedUsername);
        setToken(storedToken);
      }
    } catch (error) {
      console.error("Failed to load auth from localStorage", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setAuthTokenGetter(token ? () => token : null);
  }, [token]);

  const login = (id: number, name: string, jwtToken: string) => {
    setUserId(id);
    setUsername(name);
    setToken(jwtToken);
    localStorage.setItem("r2g_userId", id.toString());
    localStorage.setItem("r2g_username", name);
    localStorage.setItem("r2g_token", jwtToken);
  };

  const logout = () => {
    setUserId(null);
    setUsername(null);
    setToken(null);
    localStorage.removeItem("r2g_userId");
    localStorage.removeItem("r2g_username");
    localStorage.removeItem("r2g_token");
  };

  return (
    <AuthContext.Provider value={{ userId, username, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
