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
import {
  User, Wallet, MessageCircle, Heart, LayoutDashboard,
  Video, LogOut, Settings, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ADMIN_ROLES = ["admin", "super_admin", "root_admin"];
const CREATOR_ROLES = ["influencer", "admin", "super_admin", "root_admin"];

export function Navbar() {
  const t = useT();
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, loading } = useAuth();

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
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

  const hidden = ["/connexion", "/inscription"].some((p) => pathname.startsWith(p));
  const isAdminPanel = pathname.startsWith("/admin") || pathname.startsWith("/createur");
  if (hidden || isAdminPanel) return null;

  const isAdmin = user && ADMIN_ROLES.includes(user.role);
  const isCreator = user && CREATOR_ROLES.includes(user.role);

  const navTo = (href: string) => { setMenuOpen(false); router.push(href); };

  return (
    <header className="sticky top-0 z-30 border-b border-ink-line bg-ink/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Logo />

        <nav className="hidden items-center gap-6 md:flex">
          <Link href="/" className="text-sm text-sage hover:text-cream transition-colors">
            {t("nav.discover")}
          </Link>
          <Link href="/devenir-createur" className="text-sm text-sage hover:text-cream transition-colors">
            {t("nav.becomeCreator")}
          </Link>
        </nav>

        <div className="flex items-center gap-2">
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
                <span className="hidden text-sm font-medium text-cream md:block">@{user.pseudo}</span>
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
                    <p className="text-xs capitalize text-sage-muted">{user.role.replace("_", " ")}</p>
                  </div>

                  {/* Navigation */}
                  <div className="py-1">
                    <DropItem icon={<User size={15} />} label={t("nav.profile")} onClick={() => navTo("/profil")} active={pathname === "/profil"} />
                    <DropItem icon={<Wallet size={15} />} label={t("nav.wallet")} onClick={() => navTo("/wallet")} active={pathname === "/wallet"} />
                    <DropItem icon={<Heart size={15} />} label={t("nav.subscriptions")} onClick={() => navTo("/abonnements")} active={pathname === "/abonnements"} />
                    <DropItem icon={<MessageCircle size={15} />} label={t("nav.messages")} onClick={() => navTo("/messages")} active={pathname === "/messages"} />

                    {isCreator && (
                      <DropItem icon={<Video size={15} />} label="Espace créateur" onClick={() => navTo("/createur")} active={pathname.startsWith("/createur")} />
                    )}

                    {isAdmin && (
                      <DropItem icon={<Settings size={15} />} label="Administration" onClick={() => navTo("/admin")} active={pathname.startsWith("/admin")} gold />
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
