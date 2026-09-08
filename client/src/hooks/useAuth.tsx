import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { PublicUser } from "@kisansetu/shared";
import { authApi, getToken, setToken, type RegisterPayload } from "../lib/api";

interface AuthContextValue {
  user: PublicUser | null;
  status: "loading" | "authenticated" | "guest";
  login: (email: string, password: string) => Promise<PublicUser>;
  register: (payload: RegisterPayload) => Promise<PublicUser>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [status, setStatus] = useState<AuthContextValue["status"]>("loading");

  const hydrate = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setStatus("guest");
      return;
    }
    try {
      const { user: me } = await authApi.me();
      setUser(me);
      setStatus("authenticated");
    } catch {
      // Token expired/invalid — fall back to a clean guest state rather
      // than looping the app on a broken session.
      setToken(null);
      setUser(null);
      setStatus("guest");
    }
  }, []);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const login = useCallback(async (email: string, password: string) => {
    const { token, user: loggedIn } = await authApi.login(email, password);
    setToken(token);
    setUser(loggedIn);
    setStatus("authenticated");
    return loggedIn;
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const { token, user: created } = await authApi.register(payload);
    setToken(token);
    setUser(created);
    setStatus("authenticated");
    return created;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setStatus("guest");
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, login, register, logout, refresh: hydrate }),
    [user, status, login, register, logout, hydrate]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
