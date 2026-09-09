"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ListFilter, Check } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Logo } from "@/components/layout/logo";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Footer } from "@/components/layout/footer";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { DiscoverFeed } from "@/components/posts/discover-feed";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useAuth } from "@/contexts/auth-context";
import { useT } from "@/i18n/locale-context";
import { getCategoryIcon } from "@/lib/categories";
import { cn } from "@/lib/utils";
import type { Category } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

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
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const category = searchParams.get("category") || undefined;
  const [categories, setCategories] = useState<Category[] | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/creators/categories`, { cache: "no-store" })
      .then((r) => r.ok ? r.json() : [])
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  const setCategory = (slug?: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (slug) params.set("category", slug);
    else params.delete("category");
    router.push(`/?${params.toString()}`);
  };

  return (
    <>
      {/* ── DESKTOP (md+) : layout avec sidebar gauche ──────────────── */}
      <div className="hidden md:flex min-h-screen">

        {/* Sidebar catégories */}
        <aside className="sticky top-0 h-screen w-56 shrink-0 overflow-y-auto border-r border-ink-line bg-ink px-3 py-6">
          <div className="mb-4 px-2">
            <Logo />
          </div>
          <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-sage-muted">
            {t("nav.filterByCategory")}
          </p>
          <nav className="flex flex-col gap-0.5">
            <SidebarCategoryItem
              label={t("nav.all")}
              active={!category}
              onClick={() => setCategory(undefined)}
            />
            {(categories ?? []).map((cat) => {
              const Icon = getCategoryIcon(cat.slug);
              return (
                <SidebarCategoryItem
                  key={cat.id}
                  label={cat.name}
                  icon={Icon}
                  active={category === cat.slug}
                  onClick={() => setCategory(cat.slug)}
                />
              );
            })}
          </nav>
        </aside>

        {/* Feed + header desktop */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <header className="flex items-center justify-between border-b border-ink-line bg-ink px-6 py-3">
            <span />
            <div className="flex items-center gap-2">
              <LanguageSwitcher />
              <ThemeToggle />
              {user ? (
                <button
                  onClick={() => router.push("/profil")}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-raised"
                  aria-label="Mon profil"
                >
                  <UserAvatar src={(user as any).avatar_url} pseudo={user.pseudo} name={user.name} size="xs" />
                </button>
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
          <main className="flex-1 overflow-y-auto">
            <DiscoverFeed category={category} />
          </main>
          <Footer />
        </div>
      </div>

      {/* ── MOBILE (< md) : plein écran avec bouton filtre ──────────── */}
      <div className="relative md:hidden">
        <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-4 py-3">
          <Logo />
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />

            {/* Dropdown filtre — mobile uniquement */}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full bg-ink/60 text-cream backdrop-blur-sm transition-colors hover:bg-ink/80",
                    category && "ring-2 ring-gold ring-offset-1 ring-offset-transparent"
                  )}
                  aria-label={t("nav.filterByCategory")}
                >
                  <ListFilter className="h-4 w-4" />
                </button>
              </DropdownMenu.Trigger>

              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={8}
                  className="z-50 min-w-[200px] max-w-[260px] overflow-hidden rounded-xl border border-ink-line bg-ink-raised shadow-xl backdrop-blur-md animate-in fade-in-0 zoom-in-95"
                >
                  <div className="border-b border-ink-line px-3 py-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-sage-muted">
                      {t("nav.filterByCategory")}
                    </p>
                  </div>
                  <div className="max-h-72 overflow-y-auto py-1">
                    <DropdownMenu.Item
                      onSelect={() => setCategory(undefined)}
                      className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm outline-none transition-colors hover:bg-ink-surface focus:bg-ink-surface"
                    >
                      <span className={cn("flex-1 font-medium", !category ? "text-gold" : "text-cream")}>
                        {t("nav.all")}
                      </span>
                      {!category && <Check className="h-3.5 w-3.5 shrink-0 text-gold" />}
                    </DropdownMenu.Item>
                    {(categories ?? []).map((cat) => {
                      const Icon = getCategoryIcon(cat.slug);
                      const isActive = category === cat.slug;
                      return (
                        <DropdownMenu.Item
                          key={cat.id}
                          onSelect={() => setCategory(cat.slug)}
                          className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm outline-none transition-colors hover:bg-ink-surface focus:bg-ink-surface"
                        >
                          {Icon && <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-gold" : "text-sage-muted")} />}
                          <span className={cn("flex-1 font-medium", isActive ? "text-gold" : "text-cream")}>
                            {cat.name}
                          </span>
                          {isActive && <Check className="h-3.5 w-3.5 shrink-0 text-gold" />}
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
              <button
                onClick={() => router.push("/profil")}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-ink/60 backdrop-blur-sm"
                aria-label="Mon profil"
              >
                <UserAvatar src={(user as any).avatar_url} pseudo={user.pseudo} name={user.name} size="xs" />
              </button>
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

        <main className="pt-16">
          <DiscoverFeed category={category} />
        </main>
        <BottomNav />
        <Footer />
      </div>
    </>
  );
}

function SidebarCategoryItem({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors text-left",
        active
          ? "bg-gold/10 text-gold"
          : "text-sage hover:bg-ink-raised hover:text-cream"
      )}
    >
      {Icon && <Icon className={cn("h-4 w-4 shrink-0", active ? "text-gold" : "text-sage-muted")} />}
      <span className="flex-1 truncate">{label}</span>
      {active && <Check className="h-3.5 w-3.5 shrink-0 text-gold" />}
    </button>
  );
}
