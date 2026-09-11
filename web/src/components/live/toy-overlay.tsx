"use client";

import { X, Zap } from "lucide-react";
import { useEffect, useState } from "react";

interface TipEntry {
  id: string;
  username: string;
  amount: number;
  palier: number;
  duration_s: number;
  timestamp: number;
}

interface ToyOverlayProps {
  visible: boolean;
  onToggle: () => void;
  tips: TipEntry[];
  role: "creator" | "fan"; // creator pour queue, fan pour paliers
  paliers?: Array<{
    palier: number;
    min: number;
    max: number;
    duration_s: number;
  }>;
  onTipClick?: (amount: number) => void;
  isLoading?: boolean;
}

export function ToyOverlay({
  visible,
  onToggle,
  tips,
  role,
  paliers = [],
  onTipClick,
  isLoading = false,
}: ToyOverlayProps) {
  const [showHint, setShowHint] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowHint(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) {
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-4 right-4 z-40 rounded-xl bg-gold/20 border border-gold/40 p-2 text-gold hover:bg-gold/30 transition-colors"
        title="Afficher l'overlay jouet interactif"
      >
        <Zap className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 pointer-events-none z-30">
      {/* Overlay semi-transparent (créateur) — position gauche */}
      {role === "creator" && (
        <div className="absolute left-4 top-4 pointer-events-auto w-72 max-h-96 rounded-xl bg-black/80 backdrop-blur-sm border border-gold/30 p-4 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-gold" />
              <p className="text-sm font-medium text-gold">Queue jouet</p>
            </div>
            <button
              onClick={onToggle}
              className="text-sage hover:text-cream transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Tips queue */}
          <div className="flex-1 overflow-y-auto space-y-2 text-xs mb-3 min-h-[150px]">
            {tips.length === 0 ? (
              <p className="text-sage-muted text-center py-4">En attente de tips…</p>
            ) : (
              tips.slice(0, 10).map((tip) => (
                <div
                  key={tip.id}
                  className="rounded-lg bg-ink-surface/50 border border-gold/20 px-3 py-2 animate-in fade-in slide-in-from-right"
                >
                  <p className="text-cream font-medium">{tip.username}</p>
                  <p className="text-gold text-xs">
                    {tip.amount} XAF → {tip.duration_s}s (Palier {tip.palier})
                  </p>
                </div>
              ))
            )}
          </div>

          {/* Stats */}
          <div className="text-xs text-sage-muted border-t border-gold/20 pt-2">
            Queue: {tips.length} tips
          </div>
        </div>
      )}

      {/* Overlay semi-transparent (fan) — position bas-droit */}
      {role === "fan" && (
        <div className="absolute bottom-4 right-4 pointer-events-auto w-80 rounded-xl bg-black/80 backdrop-blur-sm border border-gold/30 p-4 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-gold" />
              <p className="text-sm font-medium text-gold">Paliers de tips</p>
            </div>
            <button
              onClick={onToggle}
              className="text-sage hover:text-cream transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Hint */}
          {showHint && (
            <p className="text-xs text-sage-muted mb-3 italic">
              Cliquez sur un palier pour envoyer un tip et déclencher une vibration
            </p>
          )}

          {/* Paliers grid */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            {paliers.map((p) => (
              <button
                key={p.palier}
                onClick={() => onTipClick?.(p.min)}
                disabled={isLoading}
                className="group rounded-lg bg-gradient-to-b from-gold/10 to-gold/5 border border-gold/40 p-3 text-center hover:from-gold/20 hover:to-gold/15 hover:border-gold/60 transition-all disabled:opacity-50"
              >
                <p className="text-xs font-medium text-gold group-hover:text-gold-bright">
                  {p.min}-{p.max} XAF
                </p>
                <p className="text-xs text-sage-muted group-hover:text-sage">
                  {p.duration_s}s
                </p>
              </button>
            ))}
          </div>

          {/* Last tipper */}
          {tips.length > 0 && (
            <div className="text-xs text-sage-muted border-t border-gold/20 pt-2">
              <p>Dernier: {tips[0].username} ({tips[0].amount} XAF)</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
