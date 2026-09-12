"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "@/components/layout/logo";
import { cn } from "@/lib/utils";
import { Crown, Search, PanelLeftClose, PanelLeftOpen, LogOut, Home, User, Flag, FileText, ArrowLeftRight, Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/auth-context";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { api } from "@/lib/api";

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
  defaultCollapsed = false,
  storageKey = "kl_admin_collapsed",
}: {
  navItems: NavItem[];
  children: React.ReactNode;
  isSuperAdmin?: boolean;
  defaultCollapsed?: boolean;
  storageKey?: string;
}) {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, logout } = useAuth();

  /* Sidebar collapsible */
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    // Si jamais sauvegardé, utiliser defaultCollapsed ; sinon lire localStorage
    setCollapsed(saved !== null ? saved === "true" : defaultCollapsed);
  }, [storageKey, defaultCollapsed]);
  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(storageKey, String(next));
  };

  /* Cmd+K */
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [cmdkQuery, setCmdkQuery] = useState("");
  const [cmdkLoading, setCmdkLoading] = useState(false);
  const [cmdkResults, setCmdkResults] = useState<{
    users: {id: string; pseudo: string; name: string; role: string; is_active: boolean}[];
    reports: {id: string; reason: string; status: string; reporter?: {pseudo: string}; reported?: {pseudo: string}}[];
    applications: {id: string; display_name: string; status: string; user?: {pseudo: string}}[];
    transactions: {id: string; type: string; amount_xcon: number; user?: {pseudo: string}}[];
  } | null>(null);
  const cmdkRef = useRef<HTMLInputElement>(null);
  const cmdkDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openCmdk = useCallback(() => { setCmdkOpen(true); setCmdkQuery(""); setCmdkResults(null); }, []);
  const closeCmdk = useCallback(() => { setCmdkOpen(false); setCmdkQuery(""); setCmdkResults(null); }, []);

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

  useEffect(() => {
    if (cmdkDebounce.current) clearTimeout(cmdkDebounce.current);
    if (cmdkQuery.trim().length < 2) { setCmdkResults(null); return; }
    setCmdkLoading(true);
    cmdkDebounce.current = setTimeout(async () => {
      try {
        const { data } = await api.get(`/admin/search?q=${encodeURIComponent(cmdkQuery.trim())}`);
        setCmdkResults(data);
      } catch { setCmdkResults(null); }
      finally { setCmdkLoading(false); }
    }, 300);
    return () => { if (cmdkDebounce.current) clearTimeout(cmdkDebounce.current); };
  }, [cmdkQuery]);

  const cmdkNavFiltered = CMDK_ITEMS.filter(
    (i) => !cmdkQuery || i.label.toLowerCase().includes(cmdkQuery.toLowerCase())
  );

  const commonItems = navItems.filter((i) => !i.superAdminOnly);
  const superItems  = navItems.filter((i) => i.superAdminOnly);

  const NavLink = ({
    href, label, icon: Icon, gold = false,
  }: NavItem & { gold?: boolean }) => {
    const isRootRoute = href === "/admin" || href === "/createur";
    const active = pathname === href || (!isRootRoute && pathname.startsWith(href));
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
          <button onClick={toggleCollapsed} title={collapsed ? "Déplier" : "Réduire"}
            className="rounded-xl p-1.5 text-sage hover:text-cream transition-colors">
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

        {/* Cmd+K */}
        {!collapsed && (
          <div className="px-3 pb-2">
            <button onClick={openCmdk}
              className="flex w-full items-center gap-2 rounded-xl border border-ink-line/50 bg-ink-raised px-3 py-2 text-xs text-sage hover:text-cream transition-colors">
              <Search className="h-3.5 w-3.5" />
              <span className="flex-1 text-left">Recherche rapide</span>
              <kbd className="rounded bg-ink-line px-1.5 py-0.5 text-[10px] font-mono text-sage-muted">⌘K</kbd>
            </button>
          </div>
        )}
        {collapsed && (
          <div className="px-2 pb-2">
            <button onClick={openCmdk} title="Recherche rapide (⌘K)"
              className="flex w-full items-center justify-center rounded-xl border border-ink-line/50 bg-ink-raised py-2 text-sage hover:text-cream transition-colors">
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
        <div className="border-t border-ink-line/50 p-2">
          {collapsed ? (
            /* Mode réduit — icônes uniquement */
            <div className="flex flex-col items-center gap-1">
              <ThemeToggle />
              <Link href="/" title="Retour au site"
                className="flex items-center justify-center rounded-xl p-2 text-sage hover:bg-ink-raised hover:text-cream transition-colors">
                <Home className="h-4 w-4" />
              </Link>
              <button onClick={logout} title="Déconnexion"
                className="flex items-center justify-center rounded-xl p-2 text-sage hover:bg-brick/10 hover:text-brick transition-colors">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            /* Mode étendu */
            <div className="space-y-0.5">
              {/* Ligne 1 : avatar + thème + langue */}
              <div className="flex items-center gap-2 px-2 py-2">
                {user?.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.pseudo ?? ""}
                    className="h-8 w-8 shrink-0 rounded-lg object-cover border border-ink-line/60"
                  />
                ) : (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-ink-line/60 bg-ink-raised text-xs font-bold text-sage uppercase">
                    {(user?.pseudo ?? "?")[0]}
                  </div>
                )}
                <div className="flex flex-1 items-center justify-end gap-2">
                  <ThemeToggle />
                  <LanguageSwitcher />
                </div>
              </div>

              <div className="mx-1 my-1 h-px bg-ink-line/40" />

              {/* Retour au site */}
              <Link href="/"
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-sage hover:bg-ink-raised hover:text-cream transition-colors">
                <Home className="h-4 w-4 shrink-0" />
                Retour au site
              </Link>

              <div className="mx-1 my-1 h-px bg-ink-line/40" />

              {/* Ligne 4 : Déconnexion */}
              <button onClick={logout}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-brick/80 hover:bg-brick/10 hover:text-brick transition-colors">
                <LogOut className="h-4 w-4 shrink-0" />
                Déconnexion
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Header mobile ── */}
      <header className="flex items-center justify-between bg-ink-surface px-4 py-3 md:hidden">
        <Logo />
        <div className="flex items-center gap-2">
          <button onClick={openCmdk} className="rounded-xl border border-ink-line p-2 text-sage">
            <Search className="h-4 w-4" />
          </button>
          <ThemeToggle />
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
          const isRootRoute = href === "/admin" || href === "/createur";
    const active = pathname === href || (!isRootRoute && pathname.startsWith(href));
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
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-ink-line bg-ink-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-ink-line px-4 py-3">
              {cmdkLoading
                ? <Loader2 className="h-4 w-4 shrink-0 text-gold animate-spin" />
                : <Search className="h-4 w-4 shrink-0 text-sage-muted" />
              }
              <input
                ref={cmdkRef}
                value={cmdkQuery}
                onChange={(e) => setCmdkQuery(e.target.value)}
                placeholder="Rechercher utilisateur, signalement, candidature…"
                className="flex-1 bg-transparent text-sm text-cream placeholder:text-sage-muted focus:outline-none"
              />
              <kbd className="rounded bg-ink-line px-1.5 py-0.5 text-[10px] font-mono text-sage-muted">ESC</kbd>
            </div>
            <div className="max-h-[480px] overflow-y-auto p-2">
              {/* Résultats backend */}
              {cmdkResults && (
                <>
                  {cmdkResults.users.length > 0 && (
                    <div className="mb-1">
                      <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-sage-muted">Utilisateurs</p>
                      {cmdkResults.users.map((u) => (
                        <button key={u.id}
                          onClick={() => { router.push(`/admin/utilisateurs/${u.id}`); closeCmdk(); }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-cream hover:bg-ink-raised transition-colors text-left">
                          <User className="h-3.5 w-3.5 shrink-0 text-sage-muted" />
                          <span className="flex-1">@{u.pseudo} {u.name && <span className="text-sage-muted">— {u.name}</span>}</span>
                          <span className={`text-[10px] rounded-full px-1.5 py-0.5 ${u.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-brick/10 text-brick'}`}>{u.role}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {cmdkResults.applications.length > 0 && (
                    <div className="mb-1">
                      <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-sage-muted">Candidatures</p>
                      {cmdkResults.applications.map((a) => (
                        <button key={a.id}
                          onClick={() => { router.push(`/admin/candidatures`); closeCmdk(); }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-cream hover:bg-ink-raised transition-colors text-left">
                          <FileText className="h-3.5 w-3.5 shrink-0 text-sage-muted" />
                          <span className="flex-1">{a.display_name} {a.user?.pseudo && <span className="text-sage-muted">(@{a.user.pseudo})</span>}</span>
                          <span className="text-[10px] text-sage-muted">{a.status}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {cmdkResults.reports.length > 0 && (
                    <div className="mb-1">
                      <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-sage-muted">Signalements</p>
                      {cmdkResults.reports.map((r) => (
                        <button key={r.id}
                          onClick={() => { router.push(`/admin/signalements`); closeCmdk(); }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-cream hover:bg-ink-raised transition-colors text-left">
                          <Flag className="h-3.5 w-3.5 shrink-0 text-brick/70" />
                          <span className="flex-1 truncate">{r.reason}</span>
                          <span className="text-[10px] text-sage-muted">{r.status}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {cmdkResults.transactions.length > 0 && (
                    <div className="mb-1">
                      <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-sage-muted">Transactions</p>
                      {cmdkResults.transactions.map((tx) => (
                        <button key={tx.id}
                          onClick={() => { router.push(`/admin/revenus`); closeCmdk(); }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-cream hover:bg-ink-raised transition-colors text-left">
                          <ArrowLeftRight className="h-3.5 w-3.5 shrink-0 text-sage-muted" />
                          <span className="flex-1">{tx.type} {tx.user?.pseudo && <span className="text-sage-muted">(@{tx.user.pseudo})</span>}</span>
                          <span className="font-mono text-[11px] text-gold">{tx.amount_xcon > 0 ? '+' : ''}{tx.amount_xcon}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {!cmdkResults.users.length && !cmdkResults.reports.length && !cmdkResults.applications.length && !cmdkResults.transactions.length && (
                    <p className="py-4 text-center text-sm text-sage-muted">Aucun résultat pour « {cmdkQuery} »</p>
                  )}
                  <div className="my-1 h-px bg-ink-line/50" />
                </>
              )}

              {/* Navigation sections */}
              {cmdkNavFiltered.length > 0 && (
                <>
                  {cmdkResults && <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-sage-muted">Sections</p>}
                  {cmdkNavFiltered.map((item) => (
                    <button
                      key={item.href}
                      onClick={() => { router.push(item.href); closeCmdk(); }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-cream hover:bg-ink-raised transition-colors text-left"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-gold/60 shrink-0" />
                      {item.label}
                    </button>
                  ))}
                </>
              )}
              {cmdkNavFiltered.length === 0 && !cmdkResults && (
                <p className="py-6 text-center text-sm text-sage-muted">Aucun résultat</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
