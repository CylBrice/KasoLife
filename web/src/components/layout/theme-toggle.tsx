"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Passer en mode clair" : "Passer en mode sombre"}
      className={`flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur-sm transition-colors ${
        theme === "dark"
          ? "border-brick/40 bg-brick/15 text-brick hover:bg-brick/25"
          : "border-emerald/40 bg-emerald/15 text-emerald hover:bg-emerald/25"
      } ${className ?? ""}`}
    >
      {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}
