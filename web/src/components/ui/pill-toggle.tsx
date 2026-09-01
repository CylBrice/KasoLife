"use client";

import { cn } from "@/lib/utils";

/**
 * Source unique pour le style "pilule active/inactive" (onglets, filtres,
 * sélecteurs) utilisé dans toute l'app — Connexion/Inscription, sélecteur de
 * langue, filtres admin. Changer la couleur ici la change partout : plus
 * besoin de reprendre bg-gold/text-white dans chaque fichier séparément.
 */
export function PillToggle({
  active,
  onClick,
  children,
  className,
  inactiveClassName,
  type = "button",
}: {
  active: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  /** Styles additionnels appliqués uniquement à l'état inactif (ex: fond différent) */
  inactiveClassName?: string;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-lg font-medium transition-colors",
        active
          ? "bg-gold text-white dark:text-[#0B2545]"
          : cn("text-sage hover:text-cream", inactiveClassName),
        className
      )}
    >
      {children}
    </button>
  );
}
