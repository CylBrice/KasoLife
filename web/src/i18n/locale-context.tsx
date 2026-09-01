"use client";

import {
  createContext, useContext, useEffect, useState, type ReactNode,
} from "react";
import Cookies from "js-cookie";
import fr from "./fr.json";
import en from "./en.json";

export type Locale = "fr" | "en";
export const LOCALES: Locale[] = ["fr", "en"];
export const DEFAULT_LOCALE: Locale = "fr";

const DICTIONARIES: Record<Locale, any> = { fr, en };

const LOCALE_COOKIE = "kasolife_locale";
const LOCALE_STORAGE_KEY = "kasolife_locale";

interface LocaleContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

/** Lit une valeur imbriquée d'un objet via une clé pointée (ex: "wallet.tx.DEPOT") */
function getNestedValue(obj: any, path: string): string | undefined {
  return path.split(".").reduce((acc, part) => (acc && typeof acc === "object" ? acc[part] : undefined), obj);
}

/** Remplace les placeholders {xxx} dans une chaîne de traduction */
function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) => (params[key] !== undefined ? String(params[key]) : match));
}

function detectInitialLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;

  // 1. Préférence sauvegardée (cookie, puis localStorage en fallback pour Capacitor)
  const fromCookie = Cookies.get(LOCALE_COOKIE);
  if (fromCookie === "fr" || fromCookie === "en") return fromCookie;

  try {
    const fromStorage = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (fromStorage === "fr" || fromStorage === "en") return fromStorage;
  } catch { /* localStorage indisponible (rare) */ }

  // 2. Langue du navigateur/appareil
  const browserLang = navigator.language?.slice(0, 2).toLowerCase();
  if (browserLang === "en") return "en";

  // 3. Par défaut : français (marché principal francophone)
  return DEFAULT_LOCALE;
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    setLocaleState(detectInitialLocale());
  }, []);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    Cookies.set(LOCALE_COOKIE, newLocale, { expires: 365, sameSite: "lax" });
    try { localStorage.setItem(LOCALE_STORAGE_KEY, newLocale); } catch { /* ignore */ }
    if (typeof document !== "undefined") document.documentElement.lang = newLocale;
    // Synchronise avec le backend (best-effort) pour que les contenus IA
    // générés (légendes, résumés, notifications) respectent la langue choisie.
    try {
      const token = Cookies.get("kasolife_token") || (typeof localStorage !== "undefined" ? localStorage.getItem("kasolife_token") : null);
      if (token) {
        fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/auth/profile`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ language: newLocale }),
        }).catch(() => {});
      }
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = locale;
  }, [locale]);

  const t = (key: string, params?: Record<string, string | number>): string => {
    const dict = DICTIONARIES[locale] || DICTIONARIES[DEFAULT_LOCALE];
    const value = getNestedValue(dict, key) ?? getNestedValue(DICTIONARIES[DEFAULT_LOCALE], key);
    if (typeof value !== "string") return key; // clé manquante — utile en dev pour repérer les oublis
    return interpolate(value, params);
  };

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}

/** Raccourci pratique pour accéder uniquement à la fonction de traduction */
export function useT() {
  return useLocale().t;
}
