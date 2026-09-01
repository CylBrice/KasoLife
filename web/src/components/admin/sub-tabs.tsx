"use client";

import { cn } from "@/lib/utils";

export interface SubTab {
  key: string;
  label: string;
  badge?: number;
}

export function SubTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: SubTab[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-ink-line">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={cn(
            "relative shrink-0 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
            active === tab.key
              ? "bg-gold/10 text-gold-bright"
              : "text-sage hover:bg-ink-raised hover:text-cream"
          )}
        >
          {tab.label}
          {tab.badge !== undefined && tab.badge > 0 && (
            <span className="ml-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-coral px-1 text-[10px] font-bold text-cream">
              {tab.badge > 99 ? "99+" : tab.badge}
            </span>
          )}
          {active === tab.key && (
            <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-gold" />
          )}
        </button>
      ))}
    </div>
  );
}
