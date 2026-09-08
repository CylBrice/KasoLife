"use client";
import { useState, useEffect } from "react";
import { Bell, Cookie, Sun, Moon, Monitor, ShieldCheck, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useLocale } from "@/i18n/locale-context";
import { api } from "@/lib/api";
import Link from "next/link";

type Theme = "auto" | "light" | "dark";

function Toggle({ enabled, onChange, disabled = false }: {
  enabled: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!enabled)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed ${
        enabled ? "bg-gold" : "bg-ink-line"
      }`}
      role="switch"
      aria-checked={enabled}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
          enabled ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function SectionTitle({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <Icon className="h-5 w-5 text-gold" />
      <h2 className="font-display text-base font-medium text-cream">{label}</h2>
    </div>
  );
}

function SettingRow({
  label, desc, children, opacity = false,
}: {
  label: string; desc?: string; children: React.ReactNode; opacity?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-4 rounded-xl border border-ink-line bg-ink-raised px-4 py-3 ${opacity ? "opacity-60" : ""}`}>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-cream">{label}</p>
        {desc && <p className="mt-0.5 text-xs text-sage-muted">{desc}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function applyTheme(t: Theme) {
  const root = document.documentElement;
  if (t === "light") root.setAttribute("data-theme", "light");
  else if (t === "dark") root.setAttribute("data-theme", "dark");
  else root.removeAttribute("data-theme");
}

export function TabConfig() {
  const { user, refresh } = useAuth();
  const { locale } = useLocale();
  const isEn = locale === "en";
  const u = user as any;

  const [theme, setThemeState] = useState<Theme>("auto");
  const [emailNotifs, setEmailNotifs] = useState(false);
  const [savingNotifs, setSavingNotifs] = useState(false);
  const [cookieAnalytics, setCookieAnalytics] = useState(false);
  const [cookieErrors, setCookieErrors] = useState(false);

  useEffect(() => {
    try {
      const saved = (localStorage.getItem("kasolife_theme") as Theme) || "auto";
      setThemeState(saved);
      applyTheme(saved);
      setCookieAnalytics(localStorage.getItem("cookie_analytics") === "true");
      setCookieErrors(localStorage.getItem("cookie_errors") === "true");
    } catch {}
  }, []);

  useEffect(() => {
    if (u?.email_notifs !== undefined) setEmailNotifs(Boolean(u.email_notifs));
  }, [u?.email_notifs]);

  const handleTheme = (t: Theme) => {
    setThemeState(t);
    try { localStorage.setItem("kasolife_theme", t); } catch {}
    applyTheme(t);
  };

  const handleEmailNotifs = async (v: boolean) => {
    setEmailNotifs(v);
    setSavingNotifs(true);
    try {
      await api.put("/auth/profile", { email_notifs: v });
      await refresh();
    } catch {
      setEmailNotifs(!v);
    } finally {
      setSavingNotifs(false);
    }
  };

  const handleCookieAnalytics = (v: boolean) => {
    setCookieAnalytics(v);
    try { localStorage.setItem("cookie_analytics", String(v)); } catch {}
  };

  const handleCookieErrors = (v: boolean) => {
    setCookieErrors(v);
    try { localStorage.setItem("cookie_errors", String(v)); } catch {}
  };

  const THEMES: { key: Theme; labelFr: string; labelEn: string; icon: React.ElementType }[] = [
    { key: "auto",  labelFr: "Auto",   labelEn: "Auto",  icon: Monitor },
    { key: "light", labelFr: "Clair",  labelEn: "Light", icon: Sun     },
    { key: "dark",  labelFr: "Sombre", labelEn: "Dark",  icon: Moon    },
  ];

  return (
    <div className="space-y-4">

      {/* ── Thème ────────────────────────────────────────────────────── */}
      <div className="card-surface p-5">
        <SectionTitle icon={Sun} label={isEn ? "Theme" : "Thème"} />
        <div className="flex gap-2">
          {THEMES.map(({ key, labelFr, labelEn, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => handleTheme(key)}
              className={`flex flex-1 flex-col items-center gap-2 rounded-xl border py-3 text-xs font-medium transition-colors ${
                theme === key
                  ? "border-gold bg-gold/10 text-gold"
                  : "border-ink-line bg-ink-raised text-sage hover:text-cream"
              }`}
            >
              <Icon className="h-4 w-4" />
              {isEn ? labelEn : labelFr}
            </button>
          ))}
        </div>
      </div>

      {/* ── Notifications ───────────────────────────────────────────── */}
      <div className="card-surface p-5">
        <SectionTitle icon={Bell} label="Notifications" />
        <div className="space-y-2">
          <SettingRow
            label={isEn ? "Email notifications" : "Notifications email"}
            desc={isEn ? "New subscriptions, tips, payouts" : "Nouveaux abonnements, tips, retraits"}
          >
            <div className="flex items-center gap-2">
              {savingNotifs && (
                <span className="h-3 w-3 animate-spin rounded-full border border-gold border-t-transparent" />
              )}
              <Toggle enabled={emailNotifs} onChange={handleEmailNotifs} />
            </div>
          </SettingRow>

          <SettingRow
            label={isEn ? "Security alerts" : "Alertes sécurité"}
            desc={isEn ? "2FA, password change — always sent" : "2FA, changement mot de passe — toujours envoyées"}
            opacity
          >
            <Toggle enabled={true} onChange={() => {}} disabled />
          </SettingRow>

          {!(u?.email_confirmed) && (
            <div className="rounded-xl border border-gold/30 bg-gold/5 px-4 py-3">
              <p className="text-xs text-gold">
                {isEn
                  ? "Confirm your email address to receive notifications."
                  : "Confirme ton adresse email pour recevoir les notifications."}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Cookies ──────────────────────────────────────────────────── */}
      <div className="card-surface p-5">
        <SectionTitle icon={Cookie} label={isEn ? "Cookie preferences" : "Préférences cookies"} />
        <div className="space-y-2">
          <SettingRow
            label={isEn ? "Essential cookies" : "Cookies essentiels"}
            desc={isEn ? "Authentication & security — required" : "Authentification & sécurité — obligatoires"}
            opacity
          >
            <Toggle enabled={true} onChange={() => {}} disabled />
          </SettingRow>
          <SettingRow
            label={isEn ? "Analytics" : "Analytiques"}
            desc={isEn ? "Improve the app experience" : "Améliorer l'expérience de l'application"}
          >
            <Toggle enabled={cookieAnalytics} onChange={handleCookieAnalytics} />
          </SettingRow>
          <SettingRow
            label={isEn ? "Error reports" : "Rapports d'erreur"}
            desc={isEn ? "Help us detect and fix bugs" : "Nous aider à détecter et corriger les bugs"}
          >
            <Toggle enabled={cookieErrors} onChange={handleCookieErrors} />
          </SettingRow>
        </div>
      </div>

      {/* ── Documents légaux ─────────────────────────────────────────── */}
      <div className="card-surface p-5">
        <SectionTitle icon={ShieldCheck} label={isEn ? "Legal" : "Documents légaux"} />
        <div className="space-y-1">
          {[
            { href: "/confidentialite", labelFr: "Politique de confidentialité", labelEn: "Privacy Policy" },
            { href: "/cgu",             labelFr: "Conditions générales d'utilisation", labelEn: "Terms of Service" },
            { href: "/cookies",         labelFr: "Politique cookies", labelEn: "Cookie Policy" },
          ].map(({ href, labelFr, labelEn }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center justify-between rounded-xl border border-ink-line bg-ink-raised px-4 py-3 transition-colors hover:border-gold/30 hover:bg-ink-raised"
            >
              <span className="text-sm text-sage">{isEn ? labelEn : labelFr}</span>
              <ChevronRight className="h-4 w-4 text-sage-muted" />
            </Link>
          ))}
        </div>
      </div>

    </div>
  );
}
