"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Zap, Flame, TrendingUp, Sparkles, Rocket,
  ListFilter, Search, X, LayoutGrid,
  User, BookImage, LogOut, LayoutDashboard,
} from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Logo } from "@/components/layout/logo";
import { Footer } from "@/components/layout/footer";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { DiscoverFeed, type FeedMode } from "@/components/posts/discover-feed";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useAuth } from "@/contexts/auth-context";
import { useT } from "@/i18n/locale-context";
import { getCategoryIcon } from "@/lib/categories";
import { cn } from "@/lib/utils";
import type { Category } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

// ── Sections de navigation (inspirées de KasoPlex, adaptées à KasoLife)
const FEED_SECTIONS: { mode: FeedMode; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { mode: "boosted",      label: "Boostés",     Icon: Rocket },
  { mode: "popular",      label: "Populaires",  Icon: Flame },
  { mode: "trending",     label: "Tendances",   Icon: TrendingUp },
  { mode: "followed",     label: "Suivis",      Icon: Zap },
  { mode: "personalized", label: "Pour toi",    Icon: Sparkles },
];

export default function HomePage() {
  return (
    <Suspense>
      <HomeFeed />
    </Suspense>
  );
}

function HomeFeed() {
  const t = useT();
  const router = useRouter();
  const { user, logout } = useAuth();
  const searchParams = useSearchParams();
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [feedMode, setFeedMode] = useState<FeedMode>("boosted");

  // Recherche (debounced)
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Catégories sélectionnées — sync URL ?categories=a,b
  const selectedSlugs: string[] = searchParams.get("categories")
    ? searchParams.get("categories")!.split(",").filter(Boolean)
    : [];

  useEffect(() => {
    fetch(`${API_URL}/creators/categories`, { cache: "no-store" })
      .then((r) => r.ok ? r.json() : [])
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  const toggleCategory = (slug: string) => {
    const next = selectedSlugs.includes(slug)
      ? selectedSlugs.filter((s) => s !== slug)
      : [...selectedSlugs, slug];
    pushCategories(next);
  };
  const clearCategories = () => pushCategories([]);
  const pushCategories = (slugs: string[]) => {
    const params = new URLSearchParams(searchParams.toString());
    if (slugs.length > 0) params.set("categories", slugs.join(","));
    else params.delete("categories");
    router.push(`/?${params.toString()}`);
  };

  const handleSearchChange = (val: string) => {
    setSearchInput(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchQuery(val.trim()), 350);
  };
  const clearSearch = () => { setSearchInput(""); setSearchQuery(""); setSearchOpen(false); };

  // Quand une recherche est active, les modes/catégories sont ignorés
  const activeCats  = searchQuery ? undefined : (selectedSlugs.length > 0 ? selectedSlugs : undefined);
  const activeMode  = searchQuery ? "boosted" as FeedMode : feedMode;
  const feedKey     = searchQuery || `${feedMode}-${selectedSlugs.join(",")}` || "all";

  // Menu déroulant avatar
  const UserMenu = () => (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="flex items-center gap-2 rounded-full border border-ink-line bg-ink-raised px-2 py-1 hover:border-gold/50 transition-colors"
          aria-label="Mon compte"
        >
          <UserAvatar src={(user as any)?.avatar_url} pseudo={user?.pseudo} name={user?.name} size="xs" />
          <span className="text-sm font-medium text-cream">{user?.name?.split(" ")[0] || user?.pseudo}</span>
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          onCloseAutoFocus={(e) => e.preventDefault()}
          className="z-50 min-w-[200px] overflow-hidden rounded-xl border border-ink-line bg-ink-raised shadow-xl backdrop-blur-md animate-in fade-in-0 zoom-in-95"
        >
          <div className="border-b border-ink-line px-3 py-3">
            <p className="text-sm font-semibold text-cream">@{user?.pseudo}</p>
          </div>

          <div className="py-1">
            <DropdownMenu.Item
              onSelect={() => router.push("/profil")}
              className="flex cursor-pointer items-center gap-2.5 px-3 py-2.5 text-sm text-cream outline-none transition-colors hover:bg-ink-surface focus:bg-ink-surface"
            >
              <User className="h-4 w-4 text-sage-muted" />
              Mon profil
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={() => router.push("/profil?tab=posts")}
              className="flex cursor-pointer items-center gap-2.5 px-3 py-2.5 text-sm text-cream outline-none transition-colors hover:bg-ink-surface focus:bg-ink-surface"
            >
              <BookImage className="h-4 w-4 text-sage-muted" />
              Mes publications
            </DropdownMenu.Item>
            {["admin", "super_admin", "root_admin"].includes((user as any)?.role) && (
              <DropdownMenu.Item
                onSelect={() => router.push("/admin")}
                className="flex cursor-pointer items-center gap-2.5 px-3 py-2.5 text-sm text-gold outline-none transition-colors hover:bg-gold/10 focus:bg-gold/10"
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard admin
              </DropdownMenu.Item>
            )}
          </div>

          <div className="border-t border-ink-line py-1">
            <DropdownMenu.Item
              onSelect={() => { logout(); router.push("/connexion"); }}
              className="flex cursor-pointer items-center gap-2.5 px-3 py-2.5 text-sm text-brick outline-none transition-colors hover:bg-brick/10 focus:bg-brick/10"
            >
              <LogOut className="h-4 w-4" />
              Déconnexion
            </DropdownMenu.Item>
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );

  // Pills de section (partagées desktop + mobile)
  const SectionPills = ({ withSearch = false }: { withSearch?: boolean }) => (
    <div className="sticky top-0 z-10 bg-ink">
      <div className={cn(
        "flex items-center justify-center gap-1 overflow-x-auto px-3 py-2",
        "scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      )}>
        {FEED_SECTIONS.map(({ mode, label, Icon }) => {
          const active = feedMode === mode && !searchQuery;
          return (
            <button
              key={mode}
              onClick={() => { setFeedMode(mode); clearSearch(); }}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all duration-150",
                active
                  ? "bg-gold/15 text-gold shadow-sm ring-1 ring-gold/25"
                  : "text-sage hover:bg-ink-raised hover:text-cream"
              )}
            >
              <Icon className={cn("h-3.5 w-3.5 shrink-0", active ? "text-gold" : "text-sage-muted")} />
              <span>{label}</span>
              {active && <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-gold/70" />}
            </button>
          );
        })}

        {/* Loupe uniquement sur mobile */}
        {withSearch && (
          <button
            onClick={() => setSearchOpen((v) => !v)}
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-xl transition-colors",
              searchOpen || searchQuery
                ? "bg-gold/15 text-gold ring-1 ring-gold/25"
                : "text-sage hover:bg-ink-raised hover:text-cream"
            )}
            aria-label="Rechercher"
          >
            <Search className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Champ de recherche déroulant (mobile uniquement) */}
      {withSearch && (searchOpen || searchQuery) && (
        <div className="px-3 pb-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sage-muted" />
            <input
              autoFocus
              type="search"
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Rechercher posts, créateurs…"
              className="w-full rounded-xl border border-ink-line bg-ink-raised py-1.5 pl-8 pr-7 text-xs text-cream placeholder-sage-muted outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/30"
            />
            {searchInput && (
              <button
                onClick={clearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-sage-muted hover:text-cream"
                aria-label="Effacer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {searchQuery && (
            <p className="mt-1 text-center text-[10px] text-sage-muted">
              Résultats toutes catégories · <span className="text-gold">{searchQuery}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* ── DESKTOP (md+) ────────────────────────────────────────────── */}
      <div className="hidden md:flex h-screen flex-col overflow-hidden">

        {/* Header — grille 3 colonnes pour centrage exact de la recherche */}
        <header className="sticky top-0 z-20 grid h-16 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-x-6 bg-ink px-6">
          <Logo />

          {/* Barre de recherche — colonne centrale, toujours centrée */}
          <div className="relative w-[28rem]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sage-muted" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Rechercher posts, créateurs…"
              className="w-full rounded-xl border border-ink-line bg-ink-raised py-1.5 pl-9 pr-8 text-sm text-cream placeholder-sage-muted outline-none transition-colors focus:border-gold/50 focus:ring-1 focus:ring-gold/30"
            />
            {searchInput && (
              <button
                onClick={clearSearch}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sage-muted hover:text-cream"
                aria-label="Effacer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 justify-end">
            <LanguageSwitcher />
            <ThemeToggle />
            {user ? (
              <UserMenu />
            ) : (
              <button
                onClick={() => router.push("/connexion")}
                className="rounded-xl bg-gold/90 px-4 py-1.5 text-sm font-semibold text-ink hover:bg-gold transition-colors"
              >
                {t("nav.login")}
              </button>
            )}
          </div>
        </header>

        {/* Corps : sidebar (pleine hauteur) + colonne droite */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* Sidebar — pleine hauteur, non coupée par la barre de sections */}
          <aside className={cn(
            "relative shrink-0 overflow-hidden bg-ink py-4 pt-14 transition-all duration-300",
            collapsed ? "w-14 px-1" : "w-56 px-3"
          )}>
            {!collapsed && (
              <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-sage-muted">
                {t("nav.filterByCategory")}
              </p>
            )}

            <nav className="flex flex-col gap-0.5">
              <SidebarItem
                label={t("nav.all")}
                icon={LayoutGrid}
                active={selectedSlugs.length === 0}
                collapsed={collapsed}
                onClick={clearCategories}
              />
              {(categories ?? []).map((cat) => (
                <SidebarItem
                  key={cat.id}
                  label={cat.name}
                  icon={getCategoryIcon(cat.slug)}
                  active={selectedSlugs.includes(cat.slug)}
                  collapsed={collapsed}
                  onClick={() => toggleCategory(cat.slug)}
                />
              ))}
            </nav>

            <button
              onClick={() => setCollapsed((v) => !v)}
              className={cn(
                "mt-4 flex items-center gap-2 rounded-xl px-2 py-2 text-xs text-sage-muted transition-colors hover:bg-ink-raised hover:text-cream",
                collapsed ? "justify-center w-full" : "w-full"
              )}
            >
              {collapsed ? "›" : <><span className="text-base leading-none">‹</span><span>Réduire</span></>}
            </button>
          </aside>

          {/* Colonne droite : pills de section (au-dessus du feed uniquement) + feed */}
          <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
            <SectionPills />
            <main key={feedKey} className="flex-1 overflow-y-auto animate-in fade-in-0 duration-200">
              <DiscoverFeed categories={activeCats} search={searchQuery || undefined} mode={activeMode} />
            </main>
          </div>
        </div>

        <Footer />
      </div>

      {/* ── MOBILE (< md) ────────────────────────────────────────────── */}
      <div className="flex flex-col md:hidden">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-ink-line bg-ink/95 px-4 backdrop-blur-md">
          <Logo />
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />

            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  className={cn(
                    "relative flex h-9 w-9 items-center justify-center rounded-full bg-ink/60 text-cream backdrop-blur-sm transition-colors hover:bg-ink/80",
                    selectedSlugs.length > 0 && "ring-2 ring-gold ring-offset-1 ring-offset-transparent"
                  )}
                  aria-label={t("nav.filterByCategory")}
                >
                  <ListFilter className="h-4 w-4" />
                  {selectedSlugs.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-gold text-[9px] font-bold text-ink">
                      {selectedSlugs.length}
                    </span>
                  )}
                </button>
              </DropdownMenu.Trigger>

              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={8}
                  onCloseAutoFocus={(e) => e.preventDefault()}
                  className="z-50 min-w-[210px] max-w-[270px] overflow-hidden rounded-xl border border-ink-line bg-ink-raised shadow-xl backdrop-blur-md animate-in fade-in-0 zoom-in-95"
                >
                  <div className="flex items-center justify-between border-b border-ink-line px-3 py-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-sage-muted">
                      {t("nav.filterByCategory")}
                    </p>
                    {selectedSlugs.length > 0 && (
                      <button onClick={clearCategories} className="text-xs text-gold hover:underline">
                        Tout
                      </button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto py-1">
                    {(categories ?? []).map((cat) => {
                      const Icon = getCategoryIcon(cat.slug);
                      const isActive = selectedSlugs.includes(cat.slug);
                      return (
                        <DropdownMenu.Item
                          key={cat.id}
                          onSelect={(e) => { e.preventDefault(); toggleCategory(cat.slug); }}
                          className="flex cursor-pointer items-center gap-2.5 px-3 py-2.5 text-sm outline-none transition-colors hover:bg-ink-surface focus:bg-ink-surface"
                        >
                          <span className={cn(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                            isActive ? "border-gold bg-gold" : "border-sage/40"
                          )}>
                            {isActive && <span className="h-1.5 w-1.5 rounded-full bg-ink" />}
                          </span>
                          {Icon && <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-gold" : "text-sage-muted")} />}
                          <span className={cn("flex-1 font-medium", isActive ? "text-gold" : "text-cream")}>
                            {cat.name}
                          </span>
                        </DropdownMenu.Item>
                      );
                    })}
                    {categories === null && (
                      <div className="px-3 py-3 text-xs text-sage-muted">{t("common.loading")}</div>
                    )}
                  </div>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>

            {user ? (
              <UserMenu />
            ) : (
              <button
                onClick={() => router.push("/connexion")}
                className="rounded-full bg-gold/90 px-3 py-1.5 text-xs font-semibold text-ink backdrop-blur-sm hover:bg-gold transition-colors"
              >
                {t("nav.login")}
              </button>
            )}
          </div>
        </header>

        {/* Barre de sections mobile */}
        <SectionPills withSearch />

        <main key={feedKey} className="animate-in fade-in-0 duration-200">
          <DiscoverFeed categories={activeCats} search={searchQuery || undefined} mode={activeMode} />
        </main>
        <Footer />
      </div>
    </>
  );
}

function SidebarItem({
  label,
  icon: Icon,
  active,
  collapsed,
  onClick,
}: {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  active?: boolean;
  collapsed?: boolean;
  onClick: () => void;
}) {
  return (
    <div className="group relative">
      <button
        onClick={onClick}
        className={cn(
          "relative flex w-full items-center rounded-xl py-2.5 text-sm font-medium transition-all duration-150 text-left",
          collapsed ? "justify-center gap-0 px-1" : "gap-3 px-3",
          active ? "bg-gold/10 text-gold" : "text-sage hover:bg-ink-raised hover:text-cream"
        )}
      >
        <span className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-150",
          active ? "border-gold bg-gold" : "border-sage/40 group-hover:border-sage",
          collapsed && Icon ? "-mr-1" : ""
        )}>
          {active && <span className="h-1.5 w-1.5 rounded-full bg-ink" />}
        </span>

        {Icon && (
          <Icon className={cn(
            "h-4 w-4 shrink-0",
            active ? "text-gold" : "text-sage-muted",
            collapsed ? "ml-1" : ""
          )} />
        )}

        {!collapsed && <span className="flex-1 truncate">{label}</span>}
      </button>

      {/* Tooltip — sort vers la droite en mode réduit */}
      <div className={cn(
        "pointer-events-none absolute top-0 z-50 opacity-0 transition-opacity duration-150 group-hover:opacity-100",
        collapsed ? "left-full ml-2 w-48" : "inset-x-0"
      )}>
        <div className={cn(
          "flex items-center gap-2.5 rounded-xl px-3 py-2.5 shadow-lg ring-1",
          collapsed ? "mx-0" : "mx-1",
          active ? "bg-gold/15 ring-gold/30" : "bg-ink-raised ring-ink-line"
        )}>
          <span className={cn(
            "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
            active ? "border-gold bg-gold" : "border-sage/40"
          )}>
            {active && <span className="h-1.5 w-1.5 rounded-full bg-ink" />}
          </span>
          {Icon && <Icon className={cn("h-4 w-4 shrink-0", active ? "text-gold" : "text-sage-muted")} />}
          <span className={cn("text-sm font-medium", active ? "text-gold" : "text-cream")}>{label}</span>
        </div>
      </div>
    </div>
  );
}
