"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText, ShieldCheck, HelpCircle, LifeBuoy, Share2, Download, CreditCard } from "lucide-react";
import { Logo } from "./logo";
import { useT } from "@/i18n/locale-context";
import { useAuth } from "@/contexts/auth-context";

export function Footer() {
  const t = useT();
  const year = new Date().getFullYear();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://kasolife.com";
    const url = user?.referral_code ? `${origin}/?ref=${user.referral_code}` : origin;
    if (navigator.share) {
      navigator.share({ title: "KasoLife", text: t("footer.share"), url });
    } else {
      navigator.clipboard.writeText(url).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <footer className="hidden md:block border-t border-ink-line bg-ink-surface/60 mt-8">
      <div className="mx-auto max-w-5xl px-4 py-4">
        <div className="flex flex-col items-center justify-between gap-3 md:flex-row">
          <Logo />
          <nav className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-sage">
            <Link href="/cgu" className="flex items-center gap-1 transition-colors hover:text-cream">
              <FileText size={13} /> {t("footer.terms")}
            </Link>
            <Link href="/cgf" className="flex items-center gap-1 transition-colors hover:text-cream">
              <CreditCard size={13} /> {t("footer.cgf")}
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
            <button
              type="button"
              onClick={handleShare}
              className="flex items-center gap-1 transition-colors hover:text-cream"
            >
              <Share2 size={13} />
              {copied ? t("footer.shareCopied") : t("footer.share")}
            </button>
            <Link href="/installer" className="flex items-center gap-1 transition-colors hover:text-cream">
              <Download size={13} /> {t("footer.install")}
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
