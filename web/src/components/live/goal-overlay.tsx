"use client";

import { useState, useEffect } from "react";
import { Award, ChevronDown } from "lucide-react";

interface GoalOverlayProps {
  title: string;
  current: number;
  target: number;
  lastTipper?: { username: string; amount: number };
  topTipper?: { username: string; amount: number };
  isCompleted?: boolean;
  role: "creator" | "fan";
}

export function GoalOverlay({
  title,
  current,
  target,
  lastTipper,
  topTipper,
  isCompleted = false,
  role,
}: GoalOverlayProps) {
  const percentage = Math.floor((current / target) * 100);
  const [showCelebration, setShowCelebration] = useState(isCompleted);

  useEffect(() => {
    if (isCompleted && !showCelebration) {
      setShowCelebration(true);
      const timer = setTimeout(() => setShowCelebration(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [isCompleted, showCelebration]);

  return (
    <div className="fixed inset-x-0 top-0 z-20 pointer-events-none">
      {/* Goal bar */}
      <div className="mx-auto max-w-2xl pt-4 px-4 pointer-events-auto">
        <div className="rounded-xl bg-black/80 backdrop-blur-sm border border-gold/30 p-4 space-y-3">
          {/* Title */}
          <p className="text-sm font-medium text-cream truncate">{title}</p>

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="relative h-8 bg-ink-surface rounded-lg overflow-hidden border border-gold/20">
              <div
                className={`absolute inset-y-0 left-0 transition-all duration-500 ${
                  isCompleted
                    ? "bg-gradient-to-r from-emerald-500 to-emerald-600"
                    : "bg-gradient-to-r from-gold to-gold-bright"
                }`}
                style={{ width: `${Math.min(percentage, 100)}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold text-black drop-shadow-lg">
                  {percentage}%
                </span>
              </div>
            </div>
            <p className="text-xs text-sage-muted">
              {current.toLocaleString()} / {target.toLocaleString()} XAF
            </p>
          </div>

          {/* Completion animation */}
          {showCelebration && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/50 animate-pulse">
              <Award className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-medium text-emerald-400">Objectif atteint ! 🎉</span>
            </div>
          )}

          {/* Tippers (creator view) */}
          {role === "creator" && (lastTipper || topTipper) && (
            <div className="text-xs text-sage-muted space-y-1 border-t border-gold/20 pt-2">
              {lastTipper && (
                <p>
                  <span className="text-cream">Dernier:</span> {lastTipper.username} (
                  {lastTipper.amount.toLocaleString()} XAF)
                </p>
              )}
              {topTipper && (
                <p>
                  <span className="text-cream">Top:</span> {topTipper.username} (
                  {topTipper.amount.toLocaleString()} XAF)
                </p>
              )}
            </div>
          )}

          {/* Tippers (fan view) */}
          {role === "fan" && (lastTipper || topTipper) && (
            <div className="text-xs text-sage-muted space-y-1 border-t border-gold/20 pt-2 flex items-center gap-1">
              <ChevronDown className="h-3 w-3" />
              {lastTipper && <span>{lastTipper.username} a tippé {lastTipper.amount} XAF</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
