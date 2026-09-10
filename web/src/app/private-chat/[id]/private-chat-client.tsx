"use client";

// ============================================================
// KASOLIFE — Private Chat client v1.0
// Room LiveKit 1-to-1 : créateur + fan publient et souscrivent.
// Cam2Cam : fan signale sa webcam via /fan-cam-ready.
// Fin de session : calcul prorata + remboursement auto.
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Video, VideoOff, Mic, MicOff, PhoneOff,
  Camera, Clock, AlertTriangle, Loader2,
} from "lucide-react";
import {
  Room, RoomEvent, Track, LocalVideoTrack, LocalAudioTrack,
  createLocalTracks, type RemoteParticipant, type RemoteTrack,
} from "livekit-client";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { formatFCFA } from "@/lib/utils";

type Status = "loading" | "connecting" | "live" | "ended" | "error";

export default function PrivateChatClient() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const chatId = params?.id as string;

  const localVideoRef  = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const roomRef        = useRef<Room | null>(null);

  const [status, setStatus]       = useState<Status>("loading");
  const [error, setError]         = useState<string | null>(null);
  const [chatInfo, setChatInfo]   = useState<any>(null);
  const [elapsed, setElapsed]     = useState(0);
  const [videoOn, setVideoOn]     = useState(true);
  const [audioOn, setAudioOn]     = useState(true);
  const [camReady, setCamReady]   = useState(false);
  const [ending, setEnding]       = useState(false);
  const [endResult, setEndResult] = useState<any>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Démarrer le chrono ───────────────────────────────────
  const startTimer = () => {
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  // ── Connexion LiveKit ─────────────────────────────────────
  const connect = useCallback(async () => {
    if (!chatId || !user) return;
    setStatus("connecting");
    try {
      const { data } = await api.get(`/private-chat/${chatId}/token`);
      const { token, ws_url, cam2cam_required } = data;

      const room = new Room();
      roomRef.current = room;

      // Piste locale (audio + vidéo)
      const tracks = await createLocalTracks({ audio: true, video: true });
      for (const track of tracks) {
        await room.localParticipant.publishTrack(track);
        if (track.kind === Track.Kind.Video) {
          const el = localVideoRef.current;
          if (el) (track as LocalVideoTrack).attach(el);
        }
      }

      // Piste distante
      room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _pub: any, participant: RemoteParticipant) => {
        if (track.kind === Track.Kind.Video) {
          const el = remoteVideoRef.current;
          if (el) track.attach(el);
        }
      });

      room.on(RoomEvent.Disconnected, () => setStatus("ended"));

      await room.connect(ws_url, token);
      setStatus("live");
      startTimer();

      // Signaler que la webcam du fan est prête (cam2cam)
      if (cam2cam_required) {
        await api.post(`/private-chat/${chatId}/fan-cam-ready`).catch(() => {});
        setCamReady(true);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "Erreur de connexion");
      setStatus("error");
    }
  }, [chatId, user]);

  // ── Charger les infos de la session ──────────────────────
  useEffect(() => {
    if (!chatId) return;
    api.get(`/private-chat/history?page=1&limit=50`).then(({ data }) => {
      const found = data.sessions?.find((s: any) => s.id === chatId);
      if (found) setChatInfo(found);
    }).catch(() => {});
    connect();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      roomRef.current?.disconnect();
    };
  }, [chatId, connect]);

  // ── Contrôles ─────────────────────────────────────────────
  const toggleVideo = async () => {
    const room = roomRef.current;
    if (!room) return;
    const pub = room.localParticipant.getTrackPublications()
      .find((p) => p.track?.kind === Track.Kind.Video);
    if (!pub?.track) return;
    if (videoOn) {
      await (pub.track as LocalVideoTrack).mute();
    } else {
      await (pub.track as LocalVideoTrack).unmute();
    }
    setVideoOn(!videoOn);
  };

  const toggleAudio = async () => {
    const room = roomRef.current;
    if (!room) return;
    const pub = room.localParticipant.getTrackPublications()
      .find((p) => p.track?.kind === Track.Kind.Audio);
    if (!pub?.track) return;
    if (audioOn) {
      await (pub.track as LocalAudioTrack).mute();
    } else {
      await (pub.track as LocalAudioTrack).unmute();
    }
    setAudioOn(!audioOn);
  };

  const endSession = async () => {
    if (ending) return;
    setEnding(true);
    try {
      if (timerRef.current) clearInterval(timerRef.current);
      roomRef.current?.disconnect();
      const { data } = await api.post(`/private-chat/${chatId}/end`);
      setEndResult(data);
      setStatus("ended");
    } catch (err: any) {
      setError(err?.response?.data?.error || "Erreur lors de la fin de session");
    } finally {
      setEnding(false);
    }
  };

  // ── Package restant ───────────────────────────────────────
  const packageSeconds = (chatInfo?.package_minutes || 0) * 60;
  const remaining      = Math.max(0, packageSeconds - elapsed);

  // ── Rendu ─────────────────────────────────────────────────
  if (status === "loading" || status === "connecting") {
    return (
      <div className="flex h-screen items-center justify-center bg-ink">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
          <p className="text-sm text-sage">Connexion au Private Chat…</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex h-screen items-center justify-center bg-ink px-4">
        <div className="max-w-sm text-center">
          <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-brick" />
          <p className="font-display text-lg text-cream">Erreur de connexion</p>
          <p className="mt-1 text-sm text-sage-muted">{error}</p>
          <Button className="mt-4" onClick={() => router.back()}>Retour</Button>
        </div>
      </div>
    );
  }

  if (status === "ended") {
    return (
      <div className="flex h-screen items-center justify-center bg-ink px-4">
        <div className="max-w-sm rounded-2xl border border-ink-line bg-ink-surface p-6 text-center">
          <PhoneOff className="mx-auto mb-3 h-10 w-10 text-sage-muted" />
          <p className="font-display text-xl text-cream">Session terminée</p>
          {endResult && (
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between text-sage">
                <span>Durée</span>
                <span className="text-cream">{formatTime(endResult.actual_duration_seconds || elapsed)}</span>
              </div>
              {endResult.refund_xcon > 0 && (
                <div className="flex justify-between text-sage">
                  <span>Remboursement</span>
                  <span className="text-emerald">{formatFCFA(endResult.refund_xcon)}</span>
                </div>
              )}
            </div>
          )}
          <Button className="mt-5 w-full" onClick={() => router.push("/messages")}>
            Retour aux messages
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen flex-col bg-black">
      {/* ── Vidéo distante (grande) ─── */}
      <div className="relative flex-1 overflow-hidden bg-black">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="h-full w-full object-cover"
          onContextMenu={(e) => e.preventDefault()}
        />

        {/* Vidéo locale (PiP) */}
        <div className="absolute bottom-24 right-4 h-28 w-20 overflow-hidden rounded-xl border-2 border-ink-line shadow-lg">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover"
            style={{ transform: "scaleX(-1)" }}
            onContextMenu={(e) => e.preventDefault()}
          />
          {!videoOn && (
            <div className="absolute inset-0 flex items-center justify-center bg-ink">
              <VideoOff className="h-5 w-5 text-sage-muted" />
            </div>
          )}
        </div>

        {/* Timer + infos */}
        <div className="absolute left-0 right-0 top-0 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/60 to-transparent">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 animate-pulse rounded-full bg-brick" />
            <span className="text-xs font-medium text-white">LIVE</span>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-black/50 px-3 py-1">
            <Clock className="h-3.5 w-3.5 text-gold" />
            <span className="font-mono text-sm text-white">{formatTime(elapsed)}</span>
            {packageSeconds > 0 && (
              <span className="text-xs text-sage-muted">/ {formatTime(packageSeconds)}</span>
            )}
          </div>
          {remaining > 0 && remaining <= 60 && (
            <div className="rounded-full bg-brick/80 px-3 py-1 text-xs font-medium text-white">
              {remaining}s restantes
            </div>
          )}
        </div>

        {/* Avertissement Cam2Cam */}
        {chatInfo?.cam2cam_required && !camReady && (
          <div className="absolute inset-x-4 top-16 rounded-xl border border-gold/40 bg-gold/10 p-3 text-center">
            <Camera className="mx-auto mb-1 h-4 w-4 text-gold" />
            <p className="text-xs text-gold">Activez votre caméra pour continuer (Cam2Cam requis)</p>
          </div>
        )}
      </div>

      {/* ── Contrôles ─── */}
      <div className="flex items-center justify-center gap-4 bg-black/90 px-4 py-4">
        <button
          onClick={toggleAudio}
          className={`flex h-12 w-12 items-center justify-center rounded-full border transition-colors ${
            audioOn ? "border-white/20 bg-white/10 text-white hover:bg-white/20" : "border-brick/40 bg-brick/20 text-brick"
          }`}
        >
          {audioOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </button>

        <button
          onClick={endSession}
          disabled={ending}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-brick text-white shadow-lg hover:bg-brick/90 active:scale-95 transition-transform"
        >
          {ending ? <Loader2 className="h-5 w-5 animate-spin" /> : <PhoneOff className="h-5 w-5" />}
        </button>

        <button
          onClick={toggleVideo}
          className={`flex h-12 w-12 items-center justify-center rounded-full border transition-colors ${
            videoOn ? "border-white/20 bg-white/10 text-white hover:bg-white/20" : "border-brick/40 bg-brick/20 text-brick"
          }`}
        >
          {videoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}
