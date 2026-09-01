"use client";

import { Languages } from "lucide-react";
import { useLocale, LOCALES, type Locale } from "@/i18n/locale-context";
import { cn } from "@/lib/utils";

const LOCALE_LABELS: Record<Locale, string> = { fr: "FR", en: "EN" };

/**
 * Sélecteur de langue compact (FR/EN). Affiché dans la navbar (page d'accueil
 * et pages publiques) et dans la page profil.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale } = useLocale();

  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-full border border-ink-line bg-ink/60 p-0.5 backdrop-blur-sm",
        className
      )}
      role="group"
      aria-label="Langue / Language"
    >
      <Languages className="ml-1.5 h-3.5 w-3.5 text-sage-muted" />
      {LOCALES.map((loc) => (
        <button
          key={loc}
          onClick={() => setLocale(loc)}
          aria-pressed={locale === loc}
          className={cn(
            "rounded-full px-2 py-1 text-xs font-medium transition-colors",
            locale === loc ? "bg-gold text-ink" : "text-sage hover:text-cream"
          )}
        >
          {LOCALE_LABELS[loc]}
        </button>
      ))}
    </div>
  );
}
