"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter, usePathname } from "next/navigation";
import {
  User, Wallet, Layers, MessageSquare, Video, LogOut,
  Cast, ShoppingBag, LayoutDashboard, ChevronDown,
} from "lucide-react";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useAuth } from "@/contexts/auth-context";
import { useT } from "@/i18n/locale-context";
import { cn } from "@/lib/utils";

const ADMIN_ROLES   = ["admin", "super_admin", "root_admin"];
const CREATOR_ROLES = ["influencer", "admin", "super_admin", "root_admin"];

export function UserDropdown() {
  const t        = useT();
  const router   = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const [open,     setOpen]    = useState(false);
  const [menuPos,  setMenuPos] = useState({ top: 0, right: 0 });
  const [mounted,  setMounted] = useState(false);

  const btnRef  = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  const openMenu = useCallback(() => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    }
    setOpen((v) => !v);
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (!btnRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mouseup", close);
    document.addEventListener("touchend", close);
    return () => {
      document.removeEventListener("mouseup", close);
      document.removeEventListener("touchend", close);
    };
  }, [open]);

  if (!user) return null;

  const isAdmin   = ADMIN_ROLES.includes((user as any).role);
  const isCreator = CREATOR_ROLES.includes((user as any).role);

  const navTo = (href: string) => { setOpen(false); router.push(href); };

  return (
    <>
      <button
        ref={btnRef}
        onClick={openMenu}
        className="flex items-center gap-2 rounded-full border border-ink-line bg-ink-raised px-2 py-1 hover:border-gold/50 transition-colors"
        aria-label="Mon compte"
        aria-expanded={open}
      >
        <UserAvatar src={(user as any).avatar_url} pseudo={user.pseudo} name={user.name} size="xs" />
        <span className="text-sm font-medium text-cream">{user.name?.split(" ")[0] || user.pseudo}</span>
        <ChevronDown className="h-3.5 w-3.5 text-sage-muted" />
      </button>

      {mounted && open && createPortal(
        <div
          ref={menuRef}
          style={{ position: "fixed", top: menuPos.top, right: menuPos.right, zIndex: 9999 }}
          className="w-56 overflow-hidden rounded-xl border border-ink-line bg-ink-surface shadow-2xl"
        >
          {/* En-tête */}
          <div className="border-b border-ink-line px-4 py-3">
            <p className="truncate text-sm font-semibold text-cream">@{user.pseudo}</p>
            <p className="text-xs capitalize text-sage-muted">{(user as any).role?.replace(/_/g, " ")}</p>
          </div>

          {/* Navigation */}
          <div className="py-1">
            <DropItem icon={<User size={15} />}         label={t("nav.profile")}       onClick={() => navTo("/profil")}       active={pathname === "/profil"} />
            <DropItem icon={<MessageSquare size={15} />} label={t("nav.messages")}      onClick={() => navTo("/messages")}     active={pathname.startsWith("/messages")} />

            {isCreator && (
              <DropItem icon={<Cast size={15} />}  label="Streamcast"       onClick={() => navTo("/createur/live")} active={pathname === "/createur/live"} />
            )}
            {isCreator && (
              <DropItem icon={<Video size={15} />} label="Studio Création"  onClick={() => navTo("/createur")}      active={pathname.startsWith("/createur") && pathname !== "/createur/live"} />
            )}

            <DropItem icon={<Layers size={15} />}      label={t("nav.subscriptions")} onClick={() => navTo("/abonnements")}  active={pathname === "/abonnements"} />
            <DropItem icon={<ShoppingBag size={15} />} label="Achats"                   onClick={() => navTo("/mes-achats")}   active={pathname === "/mes-achats"} />
            <DropItem icon={<Wallet size={15} />}      label={t("nav.wallet")}         onClick={() => navTo("/wallet")}       active={pathname === "/wallet"} />

            {isAdmin && (
              <DropItem icon={<LayoutDashboard size={15} />} label="Dashboard Admin" onClick={() => navTo("/admin")} active={pathname.startsWith("/admin")} gold />
            )}
          </div>

          {/* Déconnexion */}
          <div className="border-t border-ink-line py-1">
            <button
              onClick={() => { setOpen(false); logout(); }}
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
