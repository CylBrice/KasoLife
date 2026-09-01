"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { PillToggle } from "@/components/ui/pill-toggle";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/auth-context";
import { useT } from "@/i18n/locale-context";

// Indicatif → pays. Le sélecteur de pays est déduit automatiquement du numéro
// de téléphone saisi plutôt que demandé explicitement — un champ en moins.
const DIAL_CODE_TO_COUNTRY: Record<string, string> = {
  "237": "CM", "225": "CI", "221": "SN", "241": "GA", "226": "BF", "228": "TG", "229": "BJ",
};
function inferCountryFromPhone(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, "");
  for (const [dial, code] of Object.entries(DIAL_CODE_TO_COUNTRY)) {
    if (digits.startsWith(dial)) return code;
  }
  return "CM"; // marché principal par défaut
}

type Tab = "login" | "signup";

/**
 * Carte d'authentification unifiée — bascule Connexion/Inscription instantanée
 * (état local, pas de rechargement de page), à la manière d'un switch de modal.
 * /connexion et /inscription rendent ce même composant avec un onglet initial
 * différent ; l'URL est mise à jour en douceur (router.replace) sans navigation
 * visible pour que le lien reste partageable et le bouton retour cohérent.
 */
export function AuthCard({ initialTab, referralCode }: { initialTab: Tab; referralCode?: string }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const router = useRouter();
  const t = useT();

  const [loginForm, setLoginForm] = useState({ phone: "", password: "" });
  const [signupForm, setSignupForm] = useState({
    phone: "", pseudo: "", name: "", password: "", birth_date: "",
  });

  const switchTab = (next: Tab) => {
    setTab(next);
    setError(null);
    router.replace(next === "login" ? "/connexion" : "/inscription", { scroll: false });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(loginForm.phone, loginForm.password);
      router.push("/");
    } catch (err: any) {
      setError(err?.response?.data?.error || t("auth.loginError"));
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register({
        ...signupForm,
        country_iso: inferCountryFromPhone(signupForm.phone),
        ref: referralCode,
      });
      router.push("/");
    } catch (err: any) {
      setError(err?.response?.data?.error || t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  const update = (key: keyof typeof signupForm, value: string) =>
    setSignupForm((f) => ({ ...f, [key]: value }));

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Langue + thème */}
        <div className="mb-4 flex items-center justify-end gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>

        {/* En-tête : logo centré + tagline */}
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Logo />
          <p className="rounded-full bg-ink-surface/60 px-3 py-1 text-xs text-sage backdrop-blur-sm">
            KasoLife — Soutenez vos créateurs préférés
          </p>
        </div>

        {/* Carte */}
        <div className="rounded-2xl border border-ink-line bg-ink-surface p-6 shadow-lg shadow-black/20">
          {/* Onglets : bascule instantanée, pas de rechargement */}
          <div className="mb-6 flex rounded-xl bg-ink p-1">
            <PillToggle active={tab === "login"} onClick={() => switchTab("login")} className="flex-1 py-2.5 text-sm font-semibold">
              {t("nav.login")}
            </PillToggle>
            <PillToggle active={tab === "signup"} onClick={() => switchTab("signup")} className="flex-1 py-2.5 text-sm font-semibold">
              {t("nav.signup")}
            </PillToggle>
          </div>

          {error && (
            <p className="mb-4 rounded-xl border border-brick/30 bg-brick/10 px-3 py-2 text-sm text-brick">
              {error}
            </p>
          )}

          {tab === "login" ? (
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <Input
                label={t("auth.phone")} type="tel" placeholder="+237690000000" required
                value={loginForm.phone}
                onChange={(e) => setLoginForm((f) => ({ ...f, phone: e.target.value }))}
              />
              <div className="relative">
                <Input
                  label={t("auth.password")} type={showPwd ? "text" : "password"} required
                  value={loginForm.password}
                  onChange={(e) => setLoginForm((f) => ({ ...f, password: e.target.value }))}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-9 text-sage-muted hover:text-sage"
                  tabIndex={-1}
                  aria-label={showPwd ? t("common.close") : t("auth.password")}
                >
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <Button type="submit" size="lg" disabled={loading} className="mt-2 gap-2">
                {loading && <Loader2 size={18} className="animate-spin" />}
                {loading ? t("auth.loggingIn") : t("auth.loginButton")}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="flex flex-col gap-4">
              <Input
                label={t("auth.pseudo")} required placeholder={t("auth.pseudoHint")}
                value={signupForm.pseudo} onChange={(e) => update("pseudo", e.target.value)}
              />
              <Input
                label={t("auth.phone")} type="tel" placeholder="+237690000000" required
                value={signupForm.phone} onChange={(e) => update("phone", e.target.value)}
              />
              <div className="relative">
                <Input
                  label={t("auth.password")} type={showPwd ? "text" : "password"} required minLength={8}
                  value={signupForm.password} onChange={(e) => update("password", e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-9 text-sage-muted hover:text-sage"
                  tabIndex={-1}
                  aria-label={showPwd ? t("common.close") : t("auth.password")}
                >
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <Input
                label={t("auth.fullName")} required
                value={signupForm.name} onChange={(e) => update("name", e.target.value)}
              />
              <Input
                label={t("auth.birthDate")} type="date" required
                value={signupForm.birth_date} onChange={(e) => update("birth_date", e.target.value)}
              />
              <Button type="submit" size="lg" disabled={loading} className="mt-2 gap-2">
                {loading && <Loader2 size={18} className="animate-spin" />}
                {loading ? t("auth.signingUp") : t("auth.signupButton")}
              </Button>
              <p className="text-center text-xs text-sage-muted">{t("auth.ageNotice")}</p>
            </form>
          )}
        </div>

        {/* Pied de page légal */}
        <p className="mt-6 rounded-full bg-ink-surface/60 px-4 py-2 text-center text-xs text-sage backdrop-blur-sm">
          {tab === "login" ? t("auth.noAccount") : t("auth.hasAccount")}{" "}
          <button
            type="button"
            onClick={() => switchTab(tab === "login" ? "signup" : "login")}
            className="font-semibold text-gold hover:underline"
          >
            {tab === "login" ? t("nav.signup") : t("auth.loginButton")}
          </button>
        </p>
      </div>
    </main>
  );
}
