"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Modal unifié KasoLife — à utiliser pour TOUTE action modale, validation, confirmation,
 * formulaire ou popup informatif. Ne pas créer de modal custom en dehors de ce composant.
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export type ModalSize = "sm" | "md" | "lg" | "xl";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  size?: ModalSize;
  children: React.ReactNode;
  /** Empêche la fermeture en cliquant sur l'overlay ou en appuyant sur Échap */
  persistent?: boolean;
  className?: string;
}

const sizeClasses: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
};

export function Modal({
  open,
  onClose,
  title,
  description,
  size = "md",
  children,
  persistent = false,
  className,
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !persistent) onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, persistent, onClose]);

  // Bloquer le scroll du body
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (!persistent && e.target === overlayRef.current) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Panneau */}
      <div
        className={cn(
          "relative w-full rounded-2xl border shadow-2xl",
          "bg-white dark:bg-ink-surface",
          "border-gray-200 dark:border-ink-line",
          sizeClasses[size],
          className
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
      >
        {/* Header */}
        {(title || !persistent) && (
          <div className="flex items-start justify-between border-b border-gray-100 dark:border-ink-line px-6 py-4">
            {title && (
              <div>
                <h2 id="modal-title" className="font-display text-lg font-semibold text-gray-900 dark:text-cream">
                  {title}
                </h2>
                {description && (
                  <p className="mt-0.5 text-sm text-gray-500 dark:text-sage">{description}</p>
                )}
              </div>
            )}
            {!persistent && (
              <button
                onClick={onClose}
                className="ml-auto rounded-xl p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:text-sage-muted dark:hover:bg-ink-raised dark:hover:text-cream transition-colors"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {/* Contenu */}
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ── Sous-composants utiles ─────────────────────────────────────────────────────

export function ModalActions({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-ink-line mt-4", className)}>
      {children}
    </div>
  );
}
