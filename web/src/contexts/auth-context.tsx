"use client";

import {
  createContext, useContext, useEffect, useState, type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { api, setAuthToken, clearAuthToken, getAuthToken, AUTH_UNAUTHORIZED_EVENT } from "@/lib/api";
import type { UserProfile, Wallet } from "@/types";

interface AuthContextType {
  user: UserProfile | null;
  wallet: Wallet | null;
  loading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  register: (data: RegisterPayload) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

export interface RegisterPayload {
  phone: string;
  pseudo: string;
  name: string;
  password: string;
  country_iso: string;
  birth_date: string;
  ref?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchMe = async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
      const walletRes = await api.get("/wallet");
      setWallet(walletRes.data);
    } catch {
      setUser(null);
      setWallet(null);
    }
  };

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setLoading(false);
      return;
    }
    fetchMe().finally(() => setLoading(false));
  }, []);

  // Session expirée/révoquée (401 sur une requête API) : purge l'état en
  // mémoire immédiatement, sinon l'UI continue d'afficher "connecté" jusqu'au
  // prochain rechargement de page.
  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      setWallet(null);
      router.push("/connexion");
    };
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
  }, [router]);

  const login = async (phone: string, password: string) => {
    const { data } = await api.post("/auth/login", { phone, password });
    setAuthToken(data.accessToken || data.token);
    await fetchMe();
  };

  const register = async (payload: RegisterPayload) => {
    const { data } = await api.post("/auth/register", payload);
    if (data.accessToken || data.token) {
      setAuthToken(data.accessToken || data.token);
      await fetchMe();
    }
  };

  const logout = () => {
    clearAuthToken();
    setUser(null);
    setWallet(null);
  };

  return (
    <AuthContext.Provider value={{ user, wallet, loading, login, register, logout, refresh: fetchMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
