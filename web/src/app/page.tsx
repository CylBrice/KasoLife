"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { BottomNav } from "@/components/layout/bottom-nav";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { CategoryNav } from "@/components/creators/category-nav";
import { DiscoverFeed } from "@/components/posts/discover-feed";
import { useT } from "@/i18n/locale-context";
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
  const searchParams = useSearchParams();
  const category = searchParams.get("category") || undefined;
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Charge les catégories à la demande (premier clic sur le filtre)
  const ensureCategories = async () => {
    if (categories) return;
    try {
      const res = await fetch(`${API_URL}/creators/categories`, { cache: "no-store" });
      setCategories(res.ok ? await res.json() : []);
    } catch {
      setCategories([]);
    }
  };

  return (
    <div className="relative">
      {/* Overlay supérieur — logo + langue + filtre catégories */}
      <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-4 py-3">
        <Logo />
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <button
            onClick={() => { setShowFilters((v) => !v); ensureCategories(); }}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-ink/60 text-cream backdrop-blur-sm"
            aria-label={t("nav.filterByCategory")}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Panneau de filtres par catégorie */}
      {showFilters && (
        <div className="absolute inset-x-0 top-14 z-30 border-b border-ink-line bg-ink/95 px-4 py-3 backdrop-blur-md">
          {categories === null ? (
            <p className="text-sm text-sage-muted">{t("common.loading")}</p>
          ) : (
            <Suspense>
              <CategoryNav categories={categories} />
            </Suspense>
          )}
        </div>
      )}

      {/* Feed plein écran */}
      <main className="pt-16">
        <DiscoverFeed category={category} />
      </main>

      <BottomNav />
    </div>
  );
}
