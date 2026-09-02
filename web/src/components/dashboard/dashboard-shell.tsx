"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "@/components/layout/logo";
import { cn } from "@/lib/utils";
import { Crown, Moon, Sun, Search, PanelLeftClose, PanelLeftOpen, LogOut } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/auth-context";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  superAdminOnly?: boolean;
}

/* ── Palette Cmd+K ── */
const CMDK_ITEMS = [
  { label: "Tableau de bord",   href: "/admin" },
  { label: "Candidatures",      href: "/admin/candidatures" },
  { label: "Signalements",      href: "/admin/signalements" },
  { label: "Fraude",            href: "/admin/fraude" },
  { label: "Retraits",          href: "/admin/retraits" },
  { label: "Utilisateurs",      href: "/admin/utilisateurs" },
  { label: "IA",                href: "/admin/ia" },
  { label: "Maintenances",      href: "/admin/maintenance" },
  { label: "Finances",          href: "/admin/revenus" },
  { label: "Support",           href: "/admin/support" },
  { label: "Admins",            href: "/admin/admins" },
  { label: "Config",            href: "/admin/configuration" },
  { label: "Journal d'audit",   href: "/admin/audit" },
];

export function DashboardShell({
  navItems,
  children,
  isSuperAdmin = false,
}: {
  navItems: NavItem[];
  children: React.ReactNode;
  isSuperAdmin?: boolean;
}) {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, logout } = useAuth();

  /* Sidebar collapsible */
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem("kl_admin_collapsed") === "true";
    setCollapsed(saved);
  }, []);
  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("kl_admin_collapsed", String(next));
  };

  /* Dark mode — persisté dans localStorage */
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem("kl_admin_dark") === "true";
    setDark(saved);
    document.documentElement.classList.toggle("dark", saved);
  }, []);
  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem("kl_admin_dark", String(next));
    document.documentElement.classList.toggle("dark", next);
  };

  /* Cmd+K */
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [cmdkQuery, setCmdkQuery] = useState("");
  const cmdkRef = useRef<HTMLInputElement>(null);

  const openCmdk = useCallback(() => { setCmdkOpen(true); setCmdkQuery(""); }, []);
  const closeCmdk = useCallback(() => { setCmdkOpen(false); setCmdkQuery(""); }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); openCmdk(); }
      if (e.key === "Escape") closeCmdk();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [openCmdk, closeCmdk]);

  useEffect(() => {
    if (cmdkOpen) setTimeout(() => cmdkRef.current?.focus(), 40);
  }, [cmdkOpen]);

  const cmdkFiltered = CMDK_ITEMS.filter(
    (i) => !cmdkQuery || i.label.toLowerCase().includes(cmdkQuery.toLowerCase())
  );

  const commonItems = navItems.filter((i) => !i.superAdminOnly);
  const superItems  = navItems.filter((i) => i.superAdminOnly);

  const NavLink = ({
    href, label, icon: Icon, gold = false,
  }: NavItem & { gold?: boolean }) => {
    const active = pathname === href || (href !== "/admin" && pathname.startsWith(href));
    return (
      <Link
        href={href}
        title={collapsed ? label.replace(/^[^\s]*\s/, "") : undefined}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
          collapsed && "justify-center px-2",
          active
            ? gold
              ? "bg-gold/10 text-gold border-l-2 border-gold"
              : "bg-gold/10 text-gold-bright border-l-2 border-gold"
            : gold
            ? "text-gold/70 hover:bg-gold/5 hover:text-gold"
            : "text-sage hover:bg-ink-raised hover:text-cream"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {!collapsed && <span>{label}</span>}
      </Link>
    );
  };

  return (
    <div className="flex min-h-screen flex-col md:flex-row">

      {/* ── Sidebar desktop ── */}
      <aside className={cn(
        "hidden shrink-0 border-r border-ink-line/50 bg-ink-surface md:flex md:flex-col transition-all duration-200",
        collapsed ? "w-16" : "w-60"
      )}>
        <div className={cn("flex items-center p-4 pb-3", collapsed ? "justify-center" : "justify-between")}>
          {!collapsed && <Logo />}
          <div className="flex items-center gap-1">
            {!collapsed && (
              <button onClick={toggleDark} title={dark ? "Mode clair" : "Mode sombre"}
                className="rounded-lg p-1.5 text-sage hover:text-cream transition-colors">
                {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            )}
            <button onClick={toggleCollapsed} title={collapsed ? "Déplier" : "Réduire"}
              className="rounded-lg p-1.5 text-sage hover:text-cream transition-colors">
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Cmd+K */}
        {!collapsed && (
          <div className="px-3 pb-2">
            <button onClick={openCmdk}
              className="flex w-full items-center gap-2 rounded-lg border border-ink-line/50 bg-ink-raised px-3 py-2 text-xs text-sage hover:text-cream transition-colors">
              <Search className="h-3.5 w-3.5" />
              <span className="flex-1 text-left">Recherche rapide</span>
              <kbd className="rounded bg-ink-line px-1.5 py-0.5 text-[10px] font-mono text-sage-muted">⌘K</kbd>
            </button>
          </div>
        )}
        {collapsed && (
          <div className="px-2 pb-2">
            <button onClick={openCmdk} title="Recherche rapide (⌘K)"
              className="flex w-full items-center justify-center rounded-lg border border-ink-line/50 bg-ink-raised py-2 text-sage hover:text-cream transition-colors">
              <Search className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-3">
          {!collapsed && (
            <p className="mb-1 mt-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-sage-muted">Général</p>
          )}
          {collapsed && <div className="my-2 h-px bg-ink-line/50" />}
          {commonItems.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}

          {isSuperAdmin && superItems.length > 0 && (
            <>
              <div className="mx-1 my-3 h-px bg-gold/20" />
              {!collapsed && (
                <div className="mb-1 flex items-center gap-1.5 px-3">
                  <Crown className="h-3 w-3 text-gold/60" />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-gold/60">Super Admin</span>
                </div>
              )}
              {superItems.map((item) => (
                <NavLink key={item.href} {...item} gold />
              ))}
            </>
          )}
        </nav>

        {/* Footer utilisateur */}
        <div className="border-t border-ink-line/50 p-3 space-y-1">
          {user && !collapsed && (
            <div className="flex items-center gap-2.5 rounded-lg px-3 py-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold/20 text-sm font-bold text-gold-bright">
                {(user.pseudo || user.name || "?")[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-cream">@{user.pseudo}</p>
                <p className="truncate text-[10px] text-sage-muted capitalize">{user.role.replace("_", " ")}</p>
              </div>
            </div>
          )}
          <Link href="/" className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-sage hover:text-cream transition-colors",
            collapsed && "justify-center px-2"
          )}>
            {collapsed ? "←" : "← Retour au site"}
          </Link>
          {!collapsed && (
            <button onClick={toggleDark} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-sage hover:text-cream transition-colors">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {dark ? "Mode clair" : "Mode sombre"}
            </button>
          )}
          <button onClick={logout} title="Déconnexion" className={cn(
            "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-sage hover:text-brick transition-colors",
            collapsed && "justify-center px-2"
          )}>
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && "Déconnexion"}
          </button>
        </div>
      </aside>

      {/* ── Header mobile ── */}
      <header className="flex items-center justify-between border-b border-ink-line/50 bg-ink-surface px-4 py-3 md:hidden">
        <Logo />
        <div className="flex items-center gap-2">
          <button onClick={openCmdk} className="rounded-lg border border-ink-line p-2 text-sage">
            <Search className="h-4 w-4" />
          </button>
          <button onClick={toggleDark} className="rounded-lg border border-ink-line p-2 text-sage">
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          {isSuperAdmin && (
            <div className="flex items-center gap-1 rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5">
              <Crown className="h-3 w-3 text-gold" />
              <span className="text-[10px] font-bold text-gold">SUPER</span>
            </div>
          )}
        </div>
      </header>

      {/* ── Contenu ── */}
      <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>

      {/* ── Nav mobile bottom ── */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-ink-line/50 bg-ink/95 backdrop-blur-md md:hidden overflow-x-auto scrollbar-none">
        {commonItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/admin" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-1 py-2.5 px-1 text-[10px]",
                active ? "text-gold" : "text-sage-muted"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="truncate">{label.replace(/^[^\s]*\s/, "").slice(0, 9)}</span>
            </Link>
          );
        })}
      </nav>
      <div className="h-16 md:hidden" />

      {/* ── Palette Cmd+K ── */}
      {cmdkOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-20 backdrop-blur-sm"
          onClick={closeCmdk}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl border border-ink-line bg-ink-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-ink-line px-4 py-3">
              <Search className="h-4 w-4 shrink-0 text-sage-muted" />
              <input
                ref={cmdkRef}
                value={cmdkQuery}
                onChange={(e) => setCmdkQuery(e.target.value)}
                placeholder="Rechercher une section…"
                className="flex-1 bg-transparent text-sm text-cream placeholder:text-sage-muted focus:outline-none"
              />
              <kbd className="rounded bg-ink-line px-1.5 py-0.5 text-[10px] font-mono text-sage-muted">ESC</kbd>
            </div>
            <div className="max-h-72 overflow-y-auto p-2">
              {cmdkFiltered.length === 0 ? (
                <p className="py-6 text-center text-sm text-sage-muted">Aucun résultat</p>
              ) : cmdkFiltered.map((item) => (
                <button
                  key={item.href}
                  onClick={() => { router.push(item.href); closeCmdk(); }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-cream hover:bg-ink-raised transition-colors text-left"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-gold/60 shrink-0" />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
