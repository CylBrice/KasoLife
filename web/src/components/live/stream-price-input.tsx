"use client";

import { useState, useRef, useEffect } from "react";
import { Minus, Plus, Info, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Composant de saisie du prix d'un direct.
 *
 * Règles métier :
 *  - 0       = gratuit (valeur par défaut)
 *  - 1–99    = invalide → popup d'erreur, bouton "Démarrer" bloqué
 *  - ≥ 100   = payant, valide (multiples de 100)
 *
 * Bouton + :  0 → 100 directement ; ≥100 → +100
 * Bouton − :  100 → 0 directement ; >100 → −100
 */

interface StreamPriceInputProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

function InfoPopup({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className={cn(
        "absolute bottom-full left-1/2 mb-2 w-64 -translate-x-1/2 z-50",
        "rounded-2xl border shadow-xl",
        "bg-white dark:bg-ink-surface",
        "border-gray-200 dark:border-ink-line",
        "p-4"
      )}
      role="tooltip"
    >
      {/* Flèche */}
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 h-3 w-3 rotate-45 border-b border-r bg-white dark:bg-ink-surface border-gray-200 dark:border-ink-line" />

      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <Info className="h-4 w-4 shrink-0 text-gold" />
          <span className="text-sm font-semibold text-gray-900 dark:text-cream">Prix du direct</span>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-0.5 text-gray-400 hover:text-gray-700 dark:text-sage-muted dark:hover:text-cream transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <ul className="space-y-1.5 text-xs text-gray-600 dark:text-sage">
        <li className="flex items-start gap-1.5">
          <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
          <span><strong className="text-gray-900 dark:text-cream">0 XCON</strong> — direct gratuit, accessible à tous</span>
        </li>
        <li className="flex items-start gap-1.5">
          <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
          <span>Minimum <strong className="text-gray-900 dark:text-cream">100 XCON</strong> pour un direct payant</span>
        </li>
        <li className="flex items-start gap-1.5">
          <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold/60" />
          <span>Vous pouvez saisir librement n'importe quel montant <strong className="text-gray-900 dark:text-cream">≥ 100 XCON</strong></span>
        </li>
      </ul>
    </div>
  );
}

function ErrorPopup({ onClose }: { onClose: () => void }) {
  return (
    <div
      className={cn(
        "absolute bottom-full left-1/2 mb-2 w-64 -translate-x-1/2 z-50",
        "rounded-2xl border shadow-xl",
        "bg-white dark:bg-ink-surface",
        "border-brick/40 dark:border-brick/40",
        "p-4"
      )}
      role="alert"
    >
      {/* Flèche */}
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 h-3 w-3 rotate-45 border-b border-r bg-white dark:bg-ink-surface border-brick/40" />

      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="h-4 w-4 shrink-0 text-brick" />
          <span className="text-sm font-semibold text-brick">Valeur invalide</span>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-0.5 text-gray-400 hover:text-brick dark:text-sage-muted dark:hover:text-brick transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="text-xs text-gray-600 dark:text-sage">
        Le coût d'un live payant est de <strong className="text-gray-900 dark:text-cream">100 XCON minimum</strong>.
        Corrigez ou remettez à <strong className="text-gray-900 dark:text-cream">0</strong> pour un direct gratuit.
      </p>
    </div>
  );
}

export function StreamPriceInput({ value, onChange, disabled = false }: StreamPriceInputProps) {
  const [rawInput, setRawInput] = useState<string>(String(value));
  const [showInfo, setShowInfo] = useState(false);
  const [showError, setShowError] = useState(false);

  // Sync rawInput quand value change de l'extérieur (ex: reset)
  useEffect(() => {
    setRawInput(String(value));
  }, [value]);

  const isInvalid = value > 0 && value < 100;

  const handleIncrement = () => {
    if (disabled) return;
    const next = value === 0 ? 100 : value + 100;
    onChange(next);
    setShowError(false);
  };

  const handleDecrement = () => {
    if (disabled) return;
    if (value <= 0) return;
    const next = value <= 100 ? 0 : value - 100;
    onChange(next);
    setShowError(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setRawInput(raw);
    if (raw === "" || raw === "0") {
      onChange(0);
      setShowError(false);
      return;
    }
    const num = parseInt(raw, 10);
    if (isNaN(num)) return;
    onChange(num);
    if (num > 0 && num < 100) setShowError(true);
    else setShowError(false);
  };

  const handleBlur = () => {
    // Normalise la valeur à la sortie
    if (rawInput === "" || isNaN(Number(rawInput))) {
      onChange(0);
      setRawInput("0");
      setShowError(false);
    }
  };

  const isFree = value === 0;

  return (
    <div className="flex flex-col gap-1 min-w-[180px]">
      <div className="flex items-center justify-center gap-1.5">
        <span className="text-sm font-medium text-cream">Prix direct</span>
        <div className="relative">
          <button
            type="button"
            onClick={() => { setShowInfo((v) => !v); setShowError(false); }}
            className="rounded-lg p-0.5 text-sage-muted hover:text-gold transition-colors"
            aria-label="Informations sur le prix"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
          {showInfo && <InfoPopup onClose={() => setShowInfo(false)} />}
        </div>
      </div>

      <div className="relative flex items-center justify-center gap-2">
        {/* Popup d'erreur au-dessus du bloc */}
        {showError && isInvalid && (
          <ErrorPopup onClose={() => setShowError(false)} />
        )}

        {/* Bouton − */}
        <button
          type="button"
          onClick={handleDecrement}
          disabled={disabled || value <= 0}
          className="rounded-xl border border-brick/40 bg-brick/10 p-2 hover:bg-brick/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          aria-label="Diminuer"
        >
          <Minus className="h-4 w-4 text-brick" />
        </button>

        {/* Input */}
        <div className="relative">
          <input
            type="number"
            value={rawInput}
            onChange={handleInputChange}
            onBlur={handleBlur}
            disabled={disabled}
            min={0}
            className={cn(
              "w-28 rounded-xl border px-3 py-2 text-center text-sm font-mono focus:outline-none",
              "bg-ink-surface text-cream placeholder:text-sage-muted",
              "focus:ring-2 transition-all",
              "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
              isInvalid
                ? "border-brick/70 focus:ring-brick/50 text-brick"
                : isFree
                  ? "border-emerald-500/40 focus:ring-emerald-500/30 text-emerald-400"
                  : "border-gold/40 focus:ring-gold/30 text-gold"
            )}
          />
        </div>

        {/* Bouton + */}
        <button
          type="button"
          onClick={handleIncrement}
          disabled={disabled}
          className="rounded-xl border border-brick/40 bg-brick/10 p-2 hover:bg-brick/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          aria-label="Augmenter"
        >
          <Plus className="h-4 w-4 text-brick" />
        </button>
      </div>

      {/* Indicateur d'état sous l'input */}
      <p className={cn(
        "text-xs text-center font-medium transition-colors",
        isInvalid ? "text-brick" : isFree ? "text-emerald-400/80" : "text-gold/80"
      )}>
        {isInvalid
          ? "Invalide — min. 100 XCON"
          : isFree
            ? "Gratuit"
            : `${value.toLocaleString("fr-FR")} XCON`}
      </p>
    </div>
  );
}

/** Retourne true si la valeur est invalide (bloque le démarrage) */
export function isStreamPriceInvalid(value: number): boolean {
  return value > 0 && value < 100;
}
