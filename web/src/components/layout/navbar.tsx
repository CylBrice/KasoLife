"use client";

import Link from "next/link";
import { Logo } from "./logo";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "./language-switcher";
import { useT } from "@/i18n/locale-context";

export function Navbar() {
  const t = useT();

  return (
    <header className="sticky top-0 z-30 border-b border-ink-line bg-ink/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Logo />
        <nav className="hidden items-center gap-6 md:flex">
          <Link href="/" className="text-sm text-sage hover:text-cream">
            {t("nav.discover")}
          </Link>
          <Link href="/devenir-createur" className="text-sm text-sage hover:text-cream">
            {t("nav.becomeCreator")}
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Button asChild variant="ghost" size="sm">
            <Link href="/connexion">{t("nav.login")}</Link>
          </Button>
          <Button asChild variant="primary" size="sm">
            <Link href="/inscription">{t("nav.signup")}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
