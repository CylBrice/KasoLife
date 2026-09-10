"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "./logo";
import { LanguageSwitcher } from "./language-switcher";
import { ThemeToggle } from "./theme-toggle";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useAuth } from "@/contexts/auth-context";
import { useT } from "@/i18n/locale-context";
import { api } from "@/lib/api";
import {
  User, Wallet, Coins, MessageSquare, Layers,
  Video, LogOut, Settings, ChevronDown, Compass, Shield, Radio, LayoutDashboard, Cast, ShoppingBag,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ADMIN_ROLES = ["admin", "super_admin", "root_admin"];
const CREATOR_ROLES = ["influencer", "admin", "super_admin", "root_admin"];

export function Navbar() {
  const t = useT();
  const pathname = usePathname();
  const router = useRouter();
  const { user, wallet, logout, loading } = useAuth();

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const [liveCount, setLiveCount] = useState(0);

  useEffect(() => {
    api.get("/live").then(({ data }) => setLiveCount(data?.streams?.length ?? 0)).catch(() => {});
    const interval = setInterval(() => {
      api.get("/live").then(({ data }) => setLiveCount(data?.streams?.length ?? 0)).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);
  const [mounted, setMounted] = useState(false);
  const avatarRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  const openMenu = useCallback(() => {
    if (avatarRef.current) {
      const rect = avatarRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    }
    setMenuOpen((v) => !v);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (!avatarRef.current?.contains(t) && !dropdownRef.current?.contains(t)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mouseup", close);
    document.addEventListener("touchend", close);
    return () => {
      document.removeEventListener("mouseup", close);
      document.removeEventListener("touchend", close);
    };
  }, [menuOpen]);

  const hidden = ["/connexion", "/inscription", "/admin", "/createur", "/"].some(
    (p) => p === "/" ? pathname === "/" : pathname.startsWith(p)
  );
  if (hidden) return null;

  const isAdmin = user && ADMIN_ROLES.includes(user.role);
  const isCreator = user && CREATOR_ROLES.includes(user.role);

  const navTo = (href: string) => { setMenuOpen(false); router.push(href); };

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
            <>
              <button
                ref={avatarRef}
                onClick={openMenu}
                className="flex items-center gap-2 rounded-full border border-ink-line bg-ink-raised px-2 py-1 hover:border-gold/50 transition-colors"
              >
                <UserAvatar src={(user as any).avatar_url} pseudo={user.pseudo} name={user.name} size="xs" />
                <span className="text-sm font-medium text-cream">{user.name?.split(" ")[0] || user.pseudo}</span>
                <ChevronDown className="h-3.5 w-3.5 text-sage-muted" />
              </button>

              {mounted && menuOpen && createPortal(
                <div
                  ref={dropdownRef}
                  style={{ position: "fixed", top: menuPos.top, right: menuPos.right, zIndex: 9999 }}
                  className="w-56 overflow-hidden rounded-xl border border-ink-line bg-ink-surface shadow-2xl"
                >
                  {/* En-tête */}
                  <div className="border-b border-ink-line px-4 py-3">
                    <p className="truncate text-sm font-semibold text-cream">@{user.pseudo}</p>
                    <p className="text-xs capitalize text-sage-muted">{user.role?.replace("_", " ")}</p>
                  </div>

                  {/* Navigation */}
                  <div className="py-1">
                    <DropItem icon={<User size={15} />} label={t("nav.profile")} onClick={() => navTo("/profil")} active={pathname === "/profil"} />
                    <DropItem icon={<MessageSquare size={15} />} label="Messages" onClick={() => navTo("/messages")} active={pathname.startsWith("/messages")} />

                    {isCreator && (
                      <DropItem icon={<Cast size={15} />} label="Streamcast" onClick={() => navTo("/createur/live")} active={pathname === "/createur/live"} />
                    )}

                    {isCreator && (
                      <DropItem icon={<Video size={15} />} label="Espace Créateur" onClick={() => navTo("/createur")} active={pathname.startsWith("/createur") && pathname !== "/createur/live"} />
                    )}

                    <DropItem icon={<Layers size={15} />} label={t("nav.subscriptions")} onClick={() => navTo("/abonnements")} active={pathname === "/abonnements"} />
                    <DropItem icon={<ShoppingBag size={15} />} label="Mes achats" onClick={() => navTo("/mes-achats")} active={pathname === "/mes-achats"} />
                    <DropItem icon={<Wallet size={15} />} label={t("nav.wallet")} onClick={() => navTo("/wallet")} active={pathname === "/wallet"} />

                    {isAdmin && (
                      <DropItem icon={<LayoutDashboard size={15} />} label="Dashboard Admin" onClick={() => navTo("/admin")} active={pathname.startsWith("/admin")} gold />
                    )}
                  </div>

                  {/* Déconnexion */}
                  <div className="border-t border-ink-line py-1">
                    <button
                      onClick={() => { setMenuOpen(false); logout(); }}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-brick hover:bg-brick/10 transition-colors"
                    >
                      <LogOut size={15} />
                      {t("profile.logout")}
                    </button>
                  </div>
                </div>,
                document.body,
              )}
            </>
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

function DropItem({
  icon, label, onClick, active = false, gold = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  gold?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 px-4 py-2.5 text-sm transition-colors",
        active
          ? gold ? "bg-gold/10 text-gold font-semibold" : "bg-gold/5 text-cream font-semibold"
          : gold ? "text-gold/80 hover:bg-gold/10 hover:text-gold" : "text-sage hover:bg-ink-raised hover:text-cream",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
