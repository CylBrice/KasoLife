"use client";

import { useState, useCallback, useEffect } from "react";
import { Video, VideoOff, Mic, MicOff, AlertTriangle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Contrôles caméra + micro indépendants.
 *
 * Logique de permission :
 *  - "idle"       → jamais demandé
 *  - "requesting" → getUserMedia en cours
 *  - "granted"    → permission accordée, flux actif
 *  - "prompt"     → refusé UNE fois mais navigateur peut re-demander → on relance getUserMedia
 *  - "denied"     → bloqué définitivement dans les réglages navigateur → guide affiché
 *
 * Réutilisable côté créateur ET côté fan (face-à-face).
 */

type InternalPermState = "idle" | "requesting" | "granted" | "prompt" | "denied";

export interface MediaControlsProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  onStreamChange?: (stream: MediaStream | null) => void;
}

/** Interroge l'API Permissions du navigateur pour connaître l'état réel */
async function queryBrowserPerm(name: PermissionName): Promise<PermissionState> {
  try {
    const status = await navigator.permissions.query({ name });
    return status.state;
  } catch {
    return "prompt"; // navigateur ne supporte pas l'API → on tente quand même
  }
}

export function MediaControls({ videoRef, onStreamChange }: MediaControlsProps) {
  const [camOn, setCamOn]   = useState(false);
  const [micOn, setMicOn]   = useState(false);
  const [camPerm, setCamPerm] = useState<InternalPermState>("idle");
  const [micPerm, setMicPerm] = useState<InternalPermState>("idle");
  const [camStream, setCamStream] = useState<MediaStream | null>(null);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);

  // Écoute les changements de permission en temps réel (ex: user débloque dans les réglages)
  useEffect(() => {
    let camStatus: PermissionStatus | null = null;
    let micStatus: PermissionStatus | null = null;

    const watchCam = async () => {
      try {
        camStatus = await navigator.permissions.query({ name: "camera" as PermissionName });
        const sync = () => {
          if (camStatus!.state === "granted" && !camOn) setCamPerm("granted");
          if (camStatus!.state === "denied")            setCamPerm("denied");
          if (camStatus!.state === "prompt" && camPerm === "denied") setCamPerm("prompt");
        };
        camStatus.addEventListener("change", sync);
      } catch {}
    };

    const watchMic = async () => {
      try {
        micStatus = await navigator.permissions.query({ name: "microphone" as PermissionName });
        const sync = () => {
          if (micStatus!.state === "granted" && !micOn) setMicPerm("granted");
          if (micStatus!.state === "denied")            setMicPerm("denied");
          if (micStatus!.state === "prompt" && micPerm === "denied") setMicPerm("prompt");
        };
        micStatus.addEventListener("change", sync);
      } catch {}
    };

    watchCam();
    watchMic();

    return () => {
      try { camStatus?.removeEventListener("change", () => {}); } catch {}
      try { micStatus?.removeEventListener("change", () => {}); } catch {}
    };
  }, [camOn, micOn, camPerm, micPerm]);

  // ── Caméra ─────────────────────────────────────────────────────────────────

  const toggleCamera = useCallback(async () => {
    // Couper si déjà actif
    if (camOn) {
      camStream?.getVideoTracks().forEach((t) => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
      setCamStream(null);
      setCamOn(false);
      onStreamChange?.(micStream);
      return;
    }

    // Vérifier l'état réel côté navigateur avant de demander
    const browserState = await queryBrowserPerm("camera" as PermissionName);

    if (browserState === "denied") {
      // Bloqué définitivement — impossible de re-demander programmatiquement
      setCamPerm("denied");
      return;
    }

    // "prompt" ou "granted" → on tente getUserMedia (affiche la popup si "prompt")
    setCamPerm("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        if (micStream) micStream.getAudioTracks().forEach((t) => stream.addTrack(t));
        videoRef.current.srcObject = stream;
      }
      setCamStream(stream);
      setCamOn(true);
      setCamPerm("granted");
      onStreamChange?.(stream);
    } catch (err: any) {
      // NotAllowedError = refus utilisateur dans la popup → peut re-demander
      // SecurityError ou autre = bloqué système
      const isHardDenied = err?.name === "SecurityError" || browserState === "denied";
      setCamPerm(isHardDenied ? "denied" : "prompt");
      setCamOn(false);
    }
  }, [camOn, camStream, micStream, videoRef, onStreamChange]);

  // ── Micro ───────────────────────────────────────────────────────────────────

  const toggleMic = useCallback(async () => {
    if (micOn) {
      micStream?.getAudioTracks().forEach((t) => t.stop());
      if (videoRef.current?.srcObject) {
        const current = videoRef.current.srcObject as MediaStream;
        current.getAudioTracks().forEach((t) => { t.stop(); current.removeTrack(t); });
      }
      setMicStream(null);
      setMicOn(false);
      return;
    }

    const browserState = await queryBrowserPerm("microphone" as PermissionName);

    if (browserState === "denied") {
      setMicPerm("denied");
      return;
    }

    setMicPerm("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (videoRef.current?.srcObject) {
        const current = videoRef.current.srcObject as MediaStream;
        stream.getAudioTracks().forEach((t) => current.addTrack(t));
      }
      setMicStream(stream);
      setMicOn(true);
      setMicPerm("granted");
    } catch (err: any) {
      const isHardDenied = err?.name === "SecurityError" || browserState === "denied";
      setMicPerm(isHardDenied ? "denied" : "prompt");
      setMicOn(false);
    }
  }, [micOn, micStream, videoRef]);

  // ── Rendu ───────────────────────────────────────────────────────────────────

  const camBlocked = camPerm === "denied";
  const micBlocked = micPerm === "denied";

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {/* Bouton caméra */}
        <button
          type="button"
          onClick={toggleCamera}
          title={
            camBlocked
              ? "Caméra bloquée — autorisez-la dans les réglages de votre navigateur"
              : camPerm === "prompt"
                ? "Permission refusée — cliquez pour redemander"
                : camOn ? "Couper la caméra" : "Activer la caméra"
          }
          className={cn(
            camBlocked
              ? buttonVariants({ variant: "danger", size: "md" })
              : buttonVariants({ variant: "primary", size: "md" })
          )}
          aria-label={camOn ? "Couper la caméra" : "Activer la caméra"}
          aria-pressed={camOn}
        >
          {camOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
        </button>

        {/* Bouton micro */}
        <button
          type="button"
          onClick={toggleMic}
          title={
            micBlocked
              ? "Micro bloqué — autorisez-le dans les réglages de votre navigateur"
              : micPerm === "prompt"
                ? "Permission refusée — cliquez pour redemander"
                : micOn ? "Couper le micro" : "Activer le micro"
          }
          className={cn(
            micBlocked
              ? buttonVariants({ variant: "danger", size: "md" })
              : buttonVariants({ variant: "primary", size: "md" })
          )}
          aria-label={micOn ? "Couper le micro" : "Activer le micro"}
          aria-pressed={micOn}
        >
          {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
        </button>
      </div>

      {/* Guide affiché uniquement si bloqué définitivement dans les réglages */}
      {(camBlocked || micBlocked) && (
        <p className="flex items-center gap-1 text-[11px] text-brick leading-tight max-w-[260px]">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          {camBlocked && micBlocked
            ? "Caméra et micro bloqués"
            : camBlocked ? "Caméra bloquée" : "Micro bloqué"
          }
          {" "}— autorisez-les dans les réglages de votre navigateur (icône 🔒 dans la barre d'adresse).
        </p>
      )}
    </div>
  );
}
