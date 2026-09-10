"use client";

// ============================================================
// KASOLIFE — ViewOnceMedia v1.0
// Affiche un média (image/vidéo) en mode vue unique, comme WhatsApp.
//
// Comportement :
//   - Destinataire, pas encore vu : bouton "Appuyer pour voir"
//     → appel mark-viewed → affiche pendant MAX_VIEW_DURATION secondes
//     → disparaît, état "Expiré"
//   - Destinataire, déjà vu (view_once_expired) : état "Lu" (cercle ouvert)
//   - Expéditeur : toujours état "Envoyé en vue unique"
//   - Right-click, drag et capture écran bloqués (best-effort)
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Clock } from "lucide-react";
import { api } from "@/lib/api";

// Durée maximale d'affichage en secondes avant que le media soit masqué
const MAX_VIEW_DURATION = 10;

type ViewState = "pending" | "viewing" | "expired" | "error";

interface Props {
  messageId: string;
  mediaUrl: string;
  mediaType?: "image" | "video";
  isSender: boolean;
  alreadyOpened: boolean;
}

export function ViewOnceMedia({
  messageId,
  mediaUrl,
  mediaType = "image",
  isSender,
  alreadyOpened,
}: Props) {
  const [viewState, setViewState] = useState<ViewState>(
    isSender ? "expired" : alreadyOpened ? "expired" : "pending"
  );
  const [secondsLeft, setSecondsLeft] = useState(MAX_VIEW_DURATION);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Nettoyer le timer à l'unmount
  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timerRef.current!);
          setViewState("expired");
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }, []);

  const handleOpen = useCallback(async () => {
    try {
      await api.post(`/messages/${messageId}/mark-viewed`);
    } catch {
      // Continuer même si l'appel échoue (best-effort)
    }

    // Charger l'image dans un canvas pour bloquer le clic droit
    if (mediaType === "image") {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width  = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext("2d")?.drawImage(img, 0, 0);
      };
      img.onerror = () => setViewState("error");
      img.src = mediaUrl;
    }

    setViewState("viewing");
    setSecondsLeft(MAX_VIEW_DURATION);
    startTimer();
  }, [messageId, mediaUrl, mediaType, startTimer]);

  // ── État : expéditeur ─────────────────────────────────────
  if (isSender) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-ink-raised px-3 py-2 text-xs text-sage-muted">
        <Eye className="h-4 w-4 shrink-0" />
        <span>Photo en vue unique</span>
      </div>
    );
  }

  // ── État : déjà vu / expiré ───────────────────────────────
  if (viewState === "expired") {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-ink-raised px-3 py-2 text-xs text-sage-muted">
        <EyeOff className="h-4 w-4 shrink-0" />
        <span>{alreadyOpened ? "Déjà vu" : "Expiré"}</span>
      </div>
    );
  }

  // ── État : erreur ─────────────────────────────────────────
  if (viewState === "error") {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-ink-raised px-3 py-2 text-xs text-brick">
        <EyeOff className="h-4 w-4 shrink-0" />
        <span>Média indisponible</span>
      </div>
    );
  }

  // ── État : en attente d'ouverture ─────────────────────────
  if (viewState === "pending") {
    return (
      <button
        onClick={handleOpen}
        className="flex items-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-3 py-2 text-sm text-gold-bright hover:bg-gold/20 transition-colors"
      >
        <Eye className="h-4 w-4 shrink-0" />
        <span>Appuyer pour voir</span>
      </button>
    );
  }

  // ── État : affichage en cours ─────────────────────────────
  return (
    <div className="relative">
      {/* Compteur */}
      <div className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-full bg-ink/70 px-2 py-0.5 text-xs text-cream backdrop-blur-sm">
        <Clock className="h-3 w-3" />
        {secondsLeft}s
      </div>

      {mediaType === "image" ? (
        <canvas
          ref={canvasRef}
          className="max-h-48 w-full rounded-lg object-cover"
          onContextMenu={(e) => e.preventDefault()}
          onDragStart={(e) => e.preventDefault()}
          style={{ userSelect: "none" }}
        />
      ) : (
        <video
          src={mediaUrl}
          autoPlay
          muted={false}
          controls={false}
          playsInline
          className="max-h-48 w-full rounded-lg object-cover"
          onContextMenu={(e) => e.preventDefault()}
          onEnded={() => setViewState("expired")}
        />
      )}
    </div>
  );
}
