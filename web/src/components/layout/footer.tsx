"use client";

import Link from "next/link";
import { FileText, ShieldCheck, HelpCircle, LifeBuoy } from "lucide-react";
import { Logo } from "./logo";
import { useT } from "@/i18n/locale-context";

/**
 * Pied de page desktop (masqué en mobile — la BottomNav couvre ce rôle
 * sur petit écran). Inspiré de la structure KasoPlex : logo, liens légaux,
 * rappel de la parité monétaire, copyright.
 */
export function Footer() {
  const t = useT();
  const year = new Date().getFullYear();

  return (
    <footer className="hidden md:block border-t border-ink-line bg-ink-surface/60 mt-8">
      <div className="mx-auto max-w-5xl px-4 py-4">
        <div className="flex flex-col items-center justify-between gap-3 md:flex-row">
          <Logo />
          <nav className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-sage">
            <Link href="/cgu" className="flex items-center gap-1 transition-colors hover:text-cream">
              <FileText size={13} /> {t("footer.terms")}
            </Link>
            <Link href="/confidentialite" className="flex items-center gap-1 transition-colors hover:text-cream">
              <ShieldCheck size={13} /> {t("footer.privacy")}
            </Link>
            <Link href="/aide" className="flex items-center gap-1 transition-colors hover:text-cream">
              <HelpCircle size={13} /> {t("footer.help")}
            </Link>
            <Link href="/support" className="flex items-center gap-1 transition-colors hover:text-cream">
              <LifeBuoy size={13} /> {t("footer.support")}
            </Link>
          </nav>
        </div>
        <div className="mt-3 border-t border-ink-line pt-2 text-center text-[10px] text-sage-muted">
          {t("footer.tagline")} · 1 xcon = 1 FCFA = 1 XAF · © {year} KasoLife · {t("footer.rights")}
        </div>
      </div>
    </footer>
  );
}
