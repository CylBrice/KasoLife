"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "./logo";
import { LanguageSwitcher } from "./language-switcher";
import { ThemeToggle } from "./theme-toggle";
import { UserDropdown } from "./user-dropdown";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { useT } from "@/i18n/locale-context";
import { api } from "@/lib/api";
import {
  Coins, MessageSquare, Layers,
  Video, Compass, Radio, LayoutDashboard,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ADMIN_ROLES   = ["admin", "super_admin", "root_admin"];
const CREATOR_ROLES = ["influencer", "admin", "super_admin", "root_admin"];

export function Navbar() {
  const t        = useT();
  const pathname = usePathname();
  const router   = useRouter();
  const { user, wallet, loading } = useAuth();

  const [liveCount, setLiveCount] = useState(0);

  useEffect(() => {
    api.get("/live").then(({ data }) => setLiveCount(data?.streams?.length ?? 0)).catch(() => {});
    const interval = setInterval(() => {
      api.get("/live").then(({ data }) => setLiveCount(data?.streams?.length ?? 0)).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const hidden = ["/connexion", "/inscription", "/admin", "/createur", "/"].some(
    (p) => p === "/" ? pathname === "/" : pathname.startsWith(p)
  );
  if (hidden) return null;

  const isAdmin   = user && ADMIN_ROLES.includes(user.role);
  const isCreator = user && CREATOR_ROLES.includes(user.role);

  return (
    <header className="sticky top-0 z-30 bg-ink/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Logo />

        <nav className="hidden items-center gap-1 md:flex">
          {!user ? (
            <>
              <Link href="/" className={cn("flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm transition-colors", pathname === "/" ? "bg-gold/10 text-gold font-medium" : "text-sage hover:bg-ink-raised hover:text-cream")}>
                <Compass className="h-3.5 w-3.5" />
                {t("nav.discover")}
              </Link>
              <Link href="/devenir-createur" className={cn("flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm transition-colors", pathname === "/devenir-createur" ? "bg-gold/10 text-gold font-medium" : "text-sage hover:bg-ink-raised hover:text-cream")}>
                {t("nav.becomeCreator")}
              </Link>
            </>
          ) : (
            <>
              <div className="relative">
                <button
                  onClick={() => router.push("/?live=1")}
                  className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold transition-all duration-150 bg-gold text-white dark:text-[#0B2545] hover:bg-gold-bright active:bg-gold-dim shadow-sm hover:shadow hover:-translate-y-0.5 active:translate-y-0"
                >
                  <Radio className="h-3.5 w-3.5 shrink-0" />
                  Livestreams
                </button>
                <span className={cn(
                  "pointer-events-none absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-ink",
                  liveCount > 0 ? "bg-emerald animate-pulse" : "bg-brick"
                )} />
              </div>
              <Link href="/messages" className={cn("flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm transition-colors", pathname.startsWith("/messages") ? "bg-gold/10 text-gold font-medium" : "text-sage hover:bg-ink-raised hover:text-cream")}>
                <MessageSquare className="h-3.5 w-3.5" />
                Messages
              </Link>
              {isCreator ? (
                <Link href="/createur" className={cn("flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm transition-colors", pathname.startsWith("/createur") ? "bg-gold/10 text-gold font-medium" : "text-sage hover:bg-ink-raised hover:text-cream")}>
                  <Video className="h-3.5 w-3.5" />
                  Mon espace
                </Link>
              ) : (
                <Link href="/abonnements" className={cn("flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm transition-colors", pathname === "/abonnements" ? "bg-gold/10 text-gold font-medium" : "text-sage hover:bg-ink-raised hover:text-cream")}>
                  <Layers className="h-3.5 w-3.5" />
                  Abonnements
                </Link>
              )}
              {isAdmin && (
                <Link href="/admin" className={cn("flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm transition-colors", pathname.startsWith("/admin") ? "bg-gold/10 text-gold font-medium" : "text-gold/70 hover:bg-gold/10 hover:text-gold")}>
                  <LayoutDashboard className="h-3.5 w-3.5" />
                  Admin
                </Link>
              )}
            </>
          )}
        </nav>

        <div className="flex items-center gap-2">
          {user && wallet != null && (
            <Link
              href="/wallet"
              className="flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-mono font-semibold tabular-nums text-gold hover:border-gold/60 hover:bg-gold/15 transition-colors"
            >
              <Coins className="h-3.5 w-3.5 shrink-0" />
              <span>{wallet.balance_xcon.toLocaleString("fr-FR")}</span>
              <span className="text-gold/60">XC</span>
            </Link>
          )}

          <LanguageSwitcher />
          <ThemeToggle />

          {user ? (
            <UserDropdown />
          ) : !loading ? (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/connexion">{t("nav.login")}</Link>
              </Button>
              <Button asChild variant="primary" size="sm">
                <Link href="/inscription">{t("nav.signup")}</Link>
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
