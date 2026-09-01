"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { getCategoryIcon } from "@/lib/categories";
import { useT } from "@/i18n/locale-context";
import type { Category } from "@/types";

export function CategoryNav({ categories }: { categories: Category[] }) {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = searchParams.get("category");

  const setCategory = (slug?: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (slug) params.set("category", slug);
    else params.delete("category");
    router.push(`/?${params.toString()}`);
  };

  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none">
      <CategoryTile
        label={t("nav.all")}
        active={!active}
        onClick={() => setCategory(undefined)}
      />
      {categories.map((cat) => {
        const Icon = getCategoryIcon(cat.slug);
        return (
          <CategoryTile
            key={cat.id}
            label={cat.name}
            icon={Icon}
            active={active === cat.slug}
            onClick={() => setCategory(cat.slug)}
          />
        );
      })}
    </div>
  );
}

function CategoryTile({
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
        "flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors",
        active
          ? "border-gold bg-gold/10 text-gold-bright"
          : "border-ink-line bg-ink-surface text-sage hover:text-cream"
      )}
    >
      {Icon && <Icon className="h-4 w-4" />}
      {label}
    </button>
  );
}
