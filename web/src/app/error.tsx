"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function GlobalErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ErrorBoundary]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ink px-6 text-center">
      <AlertTriangle className="h-10 w-10 text-coral" />
      <h1 className="font-display text-xl font-semibold text-cream">
        Une erreur est survenue
      </h1>
      <p className="max-w-sm text-sm text-sage">
        Quelque chose s'est mal passé de notre côté. Réessayez, et si le
        problème persiste, contactez le support.
      </p>
      <button
        onClick={reset}
        className="mt-2 rounded-full bg-gold px-6 py-2 text-sm font-semibold text-white transition hover:bg-gold-bright"
      >
        Réessayer
      </button>
    </div>
  );
}
