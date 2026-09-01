import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formate un nombre avec séparateur de milliers espace insécable.
 * Ex : 1000000 → "1 000 000"
 */
export function fmtNum(amount: number | null | undefined): string {
  if (amount == null || isNaN(Number(amount))) return "0";
  return new Intl.NumberFormat("fr-FR", {
    useGrouping: true,
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

/**
 * Formate un montant en FCFA avec séparateurs de milliers (espace insécable).
 * Ex : 1500000 → "1 500 000 FCFA"
 */
export function formatFCFA(amount: number | null | undefined): string {
  return fmtNum(amount) + "\u00a0FCFA";
}

/**
 * Formate un taux décimal en pourcentage lisible.
 * Ex : 0.03 → "3 %"
 */
export function fmtRate(rate: number): string {
  return fmtNum(rate * 100) + "\u00a0%";
}

/** Formate une date relative simple en français */
export function formatRelativeDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);

  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  if (diffH < 24) return `il y a ${diffH}\u00a0h`;
  if (diffD < 7) return `il y a ${diffD}\u00a0j`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
