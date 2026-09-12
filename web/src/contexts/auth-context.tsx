"use client";

import {
  createContext, useContext, useEffect, useState, type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { api, setApiToken, clearApiToken, getApiToken, AUTH_UNAUTHORIZED_EVENT } from "@/lib/api";
import type { UserProfile, Wallet } from "@/types";

interface AuthContextType {
  user: UserProfile | null;
  wallet: Wallet | null;
  loading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  register: (data: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

export interface RegisterPayload {
  phone: string;
  pseudo: string;
  password: string;
  country_iso: string;
  name?: string;
  birth_date?: string;
  ref?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchMe = async () => {
    const { data } = await api.get("/auth/me");
    setUser(data);
    try {
      const { data: w } = await api.get("/wallet");
      setWallet(w);
    } catch {
      setWallet(null);
    }
  };

  // Au démarrage de l'app : restaure la session depuis le cookie HttpOnly kaso_rt.
  // Le BFF /api/auth/refresh lit le cookie serveur-side et retourne un nouvel access token.
  useEffect(() => {
    fetch("/api/auth/refresh", { method: "POST" })
      .then(async (r) => {
        if (!r.ok) return;
        const { accessToken } = await r.json();
        if (accessToken) {
          setApiToken(accessToken);
          await fetchMe();
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Token expiré non-récupérable (refresh échoué) → déconnexion immédiate
  useEffect(() => {
    const handle = () => {
      setUser(null);
      setWallet(null);
      router.push("/connexion");
    };
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handle);
    return () => window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handle);
  }, [router]);

  const login = async (phone: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Connexion échouée");

    // Access token en mémoire, refresh token dans le cookie HttpOnly (posé par le BFF)
    setApiToken(data.accessToken);
    setUser(data.user);
    await fetchMe();
  };

  const register = async (payload: RegisterPayload) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Inscription échouée");

    if (data.accessToken) {
      setApiToken(data.accessToken);
      await fetchMe();
    }
  };

  const logout = async () => {
    const token = getApiToken();
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).catch(() => {});
    clearApiToken();
    setUser(null);
    setWallet(null);
    router.push("/connexion");
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
