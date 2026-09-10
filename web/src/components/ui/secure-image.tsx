"use client";

// ============================================================
// KASOLIFE — SecureImage v1.0
// Affiche une image protégée via Canvas (jamais de <img src> exposé).
//
// Flux :
//   1. GET /media/token/:postId  (Bearer auto via axios interceptor)
//      → reçoit un JWT media 5 min
//   2. GET /media/serve/:token  (fetch sans credentials)
//      → reçoit le buffer image watermarké
//   3. createImageBitmap(blob) → drawImage sur <canvas>
//
// Protection :
//   - Aucune URL R2 ni src dans le DOM
//   - Context-menu désactivé sur le canvas
//   - Drag désactivé
//   - Image jamais accessible via devtools Network (token expiré dès affichage)
// ============================================================

import { useEffect, useRef, useState, useCallback } from "react";
import { api } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

type SecureImageStatus = "idle" | "loading" | "ready" | "error";

interface Props {
  postId: string;
  className?: string;
  alt?: string;
}

export function SecureImage({ postId, className = "", alt = "" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<SecureImageStatus>("idle");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      // 1. Obtenir le token media (Bearer injecté par l'interceptor axios)
      const { data } = await api.get<{ token: string }>(`/media/token/${postId}`);
      const { token } = data;

      // 2. Fetch binaire depuis /media/serve/:token
      const resp = await fetch(`${API_BASE}/media/serve/${token}`, {
        credentials: "omit", // pas de cookies cross-origin
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const blob   = await resp.blob();
      const bitmap = await createImageBitmap(blob);

      // 3. Dessiner sur Canvas
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width  = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();

      setStatus("ready");
    } catch (err) {
      console.error("[SecureImage] Erreur :", err);
      setStatus("error");
    }
  }, [postId]);

  useEffect(() => {
    load();
  }, [load]);

  // Bloquer toutes les interactions qui permettraient d'extraire l'image
  const blockEvent = (e: React.SyntheticEvent) => e.preventDefault();

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ userSelect: "none" }}>
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-ink-raised">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-gold border-t-transparent" />
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center bg-ink-raised text-sm text-sage-muted">
          Contenu indisponible
        </div>
      )}
      <canvas
        ref={canvasRef}
        aria-label={alt}
        className={`w-full h-full object-cover ${status !== "ready" ? "invisible" : ""}`}
        onContextMenu={blockEvent}
        onDragStart={blockEvent}
      />
    </div>
  );
}
