"use client";

import { WifiOff, RefreshCw } from "lucide-react";

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-ink px-6 text-center">
      <WifiOff className="h-16 w-16 text-gold/50" />
      <div>
        <h1 className="font-display text-2xl font-medium text-cream">
          Vous êtes hors ligne
        </h1>
        <p className="mt-2 text-sm text-sage-muted">
          Vérifiez votre connexion internet puis réessayez.
        </p>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="flex items-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-5 py-2.5 text-sm font-medium text-gold transition-colors hover:bg-gold/20"
      >
        <RefreshCw className="h-4 w-4" />
        Réessayer
      </button>
    </main>
  );
}
