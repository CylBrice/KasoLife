"use client";

// ============================================================
// KASOLIFE — Private Show client v1.0
// Session vidéo LiveKit 1-to-1 créateur ↔ fan.
// Gestion de la période de grâce (déco réseau créateur).
// Timer pausé pendant la grâce, reprise auto à la reconnexion.
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Video, VideoOff, Mic, MicOff, PhoneOff,
  Clock, AlertTriangle, Loader2, WifiOff, Crown, Eye, Users,
} from "lucide-react";
import {
  Room, RoomEvent, Track, LocalVideoTrack, LocalAudioTrack,
  createLocalTracks, type RemoteParticipant, type RemoteTrack,
} from "livekit-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { formatFCFA, cn } from "@/lib/utils";

type Status = "loading" | "connecting" | "spy_purchase" | "live" | "grace" | "ended" | "error";

export default function PrivateShowClient() {
  const params  = useParams();
  const router  = useRouter();
  const { user } = useAuth();
  const showId  = params?.id as string;

  const localVideoRef  = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const lastFrameRef   = useRef<HTMLCanvasElement>(null);
  const roomRef        = useRef<Room | null>(null);

  const [status, setStatus]           = useState<Status>("loading");
  const [error, setError]             = useState<string | null>(null);
  const [showInfo, setShowInfo]       = useState<any>(null);
  const [elapsed, setElapsed]         = useState(0);      // secondes depuis started_at
  const [pausedAt, setPausedAt]       = useState<number | null>(null); // ms epoch où la pause a commencé
  const [graceRemaining, setGraceRemaining] = useState(0);
  const [videoOn, setVideoOn]         = useState(true);
  const [audioOn, setAudioOn]         = useState(true);
  const [ending, setEnding]           = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [endResult, setEndResult]     = useState<any>(null);
  const [isSpy, setIsSpy]             = useState(false);
  const [spyInfo, setSpyInfo]         = useState<any>(null);    // prix spy + infos
  const [buyingSpy, setBuyingSpy]     = useState(false);
  const [spyError, setSpyError]       = useState<string | null>(null);

  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const graceRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  const isCreator = showInfo?.creator_id === user?.id;

  const formatTime = (s: number) => {
    const m   = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  // ── Capturer la dernière frame du flux distant ────────────
  const captureLastFrame = useCallback(() => {
    const video  = remoteVideoRef.current;
    const canvas = lastFrameRef.current;
    if (!video || !canvas || video.readyState < 2) return;
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 360;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  }, []);

  // ── Timer de session (s'arrête pendant la grâce) ─────────
  const startTimer = useCallback((startedAt: string) => {
    const base = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
    setElapsed(base);
    timerRef.current = setInterval(() => {
      setElapsed((e) => e + 1);
    }, 1000);
  }, []);

  const pauseTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setPausedAt(Date.now());
  }, []);

  const resumeTimer = useCallback(() => {
    setPausedAt(null);
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  }, []);

  // ── Connexion LiveKit (publisher OU subscriber-only spy) ─────
  const connectAsParticipant = useCallback(async (token: string, ws_url: string, show: any, asSpy = false) => {
    const room = new Room();
    roomRef.current = room;

    if (!asSpy) {
      // Publisher : créateur ou fan publient audio+vidéo
      const tracks = await createLocalTracks({ audio: true, video: true });
      for (const track of tracks) {
        await room.localParticipant.publishTrack(track);
        if (track.kind === Track.Kind.Video) {
          const el = localVideoRef.current;
          if (el) (track as LocalVideoTrack).attach(el);
        }
      }
    }

    room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _pub: any, _p: RemoteParticipant) => {
      if (track.kind === Track.Kind.Video) {
        const el = remoteVideoRef.current;
        if (el) track.attach(el);
      }
    });

    room.on(RoomEvent.ParticipantDisconnected, (_p: RemoteParticipant) => {});

    room.on(RoomEvent.Disconnected, () => {
      if (status !== "grace") setStatus("ended");
    });

    await room.connect(ws_url, token);
    setStatus("live");
    if (!asSpy) startTimer(show.started_at);
  }, [startTimer, status]);

  const connect = useCallback(async () => {
    if (!showId || !user) return;
    setStatus("connecting");
    try {
      const showRes = await api.get(`/private-shows/${showId}`);
      const show = showRes.data.show;
      setShowInfo(show);

      // Déterminer le rôle de l'utilisateur
      const userIsCreator = show.creator_id === user.id;
      const userIsFan     = show.fan_id === user.id;
      const userIsSpy     = !userIsCreator && !userIsFan;

      if (userIsSpy) {
        // Vérifier si le show est STANDARD (spy autorisé)
        if (show.show_type !== "STANDARD") {
          setError("Ce show Premium n'autorise pas les spectateurs Spy.");
          setStatus("error");
          return;
        }
        setIsSpy(true);
        // Récupérer le prix spy et afficher l'écran d'achat
        const pricesRes = await api.get(`/private-shows/prices/${show.creator_id}`);
        const priceRow = (pricesRes.data.prices || []).find(
          (p: any) => p.show_type === "STANDARD" && p.duration_min === show.package_minutes,
        );
        setSpyInfo({ price_per_min: priceRow?.spy_price_per_min_xcon || 0, show });
        setStatus("spy_purchase");
        return;
      }

      const tokenRes = await api.get(`/private-shows/${showId}/token`);
      const { token, ws_url } = tokenRes.data;
      await connectAsParticipant(token, ws_url, show, false);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "Erreur de connexion";
      setError(msg);
      setStatus("error");
    }
  }, [showId, user, connectAsParticipant]);

  // ── Achat accès Spy ───────────────────────────────────────
  const handleBuySpy = async () => {
    if (buyingSpy || !spyInfo) return;
    setBuyingSpy(true);
    setSpyError(null);
    try {
      const { data } = await api.post(`/private-shows/${showId}/spy`);
      const { token, ws_url } = data;
      setStatus("connecting");
      await connectAsParticipant(token, ws_url, spyInfo.show, true);
    } catch (err: any) {
      setSpyError(err?.response?.data?.error || "Erreur lors de l'achat");
    } finally {
      setBuyingSpy(false);
    }
  };

  // ── Poll statut (grâce reconnexion) ──────────────────────
  const startPoll = useCallback(() => {
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await api.get(`/private-shows/${showId}`);
        if (data.grace_expired || data.show?.status === "ENDED") {
          setStatus("ended");
          setEndResult(null);
          clearInterval(pollRef.current!);
          return;
        }
        if (data.grace_active) {
          setGraceRemaining(data.grace_remaining_seconds || 0);
        } else if (data.show?.status === "ACTIVE" && !data.show?.creator_disconnected_at) {
          // Créateur reconnecté
          setStatus("live");
          resumeTimer();
          clearInterval(graceRef.current!);
          clearInterval(pollRef.current!);
        }
      } catch {}
    }, 3000);
  }, [showId, resumeTimer]);

  useEffect(() => {
    connect();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (graceRef.current) clearInterval(graceRef.current);
      if (pollRef.current)  clearInterval(pollRef.current);
      roomRef.current?.disconnect();
    };
  }, [connect]);

  // ── Entrer en mode grâce (déco créateur détectée) ────────
  const enterGrace = useCallback((remainingSec: number) => {
    captureLastFrame();
    pauseTimer();
    setStatus("grace");
    setGraceRemaining(remainingSec);
    graceRef.current = setInterval(() => {
      setGraceRemaining((r) => {
        if (r <= 1) { clearInterval(graceRef.current!); return 0; }
        return r - 1;
      });
    }, 1000);
    startPoll();
  }, [captureLastFrame, pauseTimer, startPoll]);

  // Surveiller si la grâce est signalée dans les détails du show
  useEffect(() => {
    if (!showId) return;
    const id = setInterval(async () => {
      if (status !== "live") return;
      try {
        const { data } = await api.get(`/private-shows/${showId}`);
        if (data.grace_active && status === "live") {
          enterGrace(data.grace_remaining_seconds || 300);
        }
      } catch {}
    }, 5000);
    return () => clearInterval(id);
  }, [showId, status, enterGrace]);

  // ── Reconnexion créateur ──────────────────────────────────
  const handleReconnect = async () => {
    if (!isCreator || reconnecting) return;
    setReconnecting(true);
    try {
      const { data } = await api.post(`/private-shows/${showId}/reconnect`);
      const room = new Room();
      roomRef.current = room;
      room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
        if (track.kind === Track.Kind.Video && remoteVideoRef.current) {
          track.attach(remoteVideoRef.current);
        }
      });
      room.on(RoomEvent.Disconnected, () => setStatus("ended"));
      await room.connect(data.ws_url, data.token);
      resumeTimer();
      setStatus("live");
      clearInterval(graceRef.current!);
      clearInterval(pollRef.current!);
    } catch (err: any) {
      alert(err?.response?.data?.error || "Impossible de se reconnecter");
    } finally {
      setReconnecting(false);
    }
  };

  // ── Contrôles média ───────────────────────────────────────
  const toggleVideo = async () => {
    const room = roomRef.current;
    if (!room) return;
    const pub = room.localParticipant.getTrackPublications()
      .find((p) => p.track?.kind === Track.Kind.Video);
    if (!pub?.track) return;
    videoOn
      ? await (pub.track as LocalVideoTrack).mute()
      : await (pub.track as LocalVideoTrack).unmute();
    setVideoOn(!videoOn);
  };

  const toggleAudio = async () => {
    const room = roomRef.current;
    if (!room) return;
    const pub = room.localParticipant.getTrackPublications()
      .find((p) => p.track?.kind === Track.Kind.Audio);
    if (!pub?.track) return;
    audioOn
      ? await (pub.track as LocalAudioTrack).mute()
      : await (pub.track as LocalAudioTrack).unmute();
    setAudioOn(!audioOn);
  };

  const endSession = async () => {
    if (ending) return;
    setEnding(true);
    try {
      if (timerRef.current) clearInterval(timerRef.current);
      roomRef.current?.disconnect();
      const { data } = await api.post(`/private-shows/${showId}/end`);
      setEndResult(data);
      setStatus("ended");
    } catch (err: any) {
      setError(err?.response?.data?.error || "Erreur lors de la fin de session");
    } finally {
      setEnding(false);
    }
  };

  const packageSeconds = (showInfo?.package_minutes || 0) * 60;
  const remaining      = Math.max(0, packageSeconds - elapsed);

  // ── États intermédiaires ──────────────────────────────────
  if (status === "loading" || status === "connecting") {
    return (
      <div className="flex h-screen items-center justify-center bg-ink">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
          <p className="text-sm text-sage">Connexion au Private Show…</p>
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

  // ── ÉCRAN ACHAT SPY ──────────────────────────────────────
  if (status === "spy_purchase" && spyInfo) {
    return (
      <div className="flex h-screen items-center justify-center bg-ink px-4">
        <div className="max-w-sm w-full rounded-2xl border border-ink-line bg-ink-surface p-6 space-y-4">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-ink-raised">
              <Eye className="h-6 w-6 text-gold" />
            </div>
            <p className="font-display text-xl text-cream">Mode Spy</p>
            <p className="mt-1 text-sm text-sage-muted">
              Regardez ce show en cours sans participer — lecture seule.
            </p>
          </div>

          <div className="rounded-xl bg-ink-raised p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-sage">Tarif</span>
              <span className="text-cream font-mono">
                {spyInfo.price_per_min > 0 ? `${formatFCFA(spyInfo.price_per_min)}/min` : "Gratuit"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sage">Forfait restant</span>
              <span className="text-cream">{spyInfo.show.package_minutes} min max</span>
            </div>
            <p className="text-xs text-sage-muted pt-1 border-t border-ink-line">
              Facturé à la minute. Remboursement au prorata si le show se termine.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-ink-line bg-ink-raised px-3 py-2">
            <Users className="h-4 w-4 shrink-0 text-sage-muted" />
            <p className="text-xs text-sage-muted">Vous serez invisible — le créateur et le fan ne voient pas les spys.</p>
          </div>

          {spyError && (
            <div className="flex items-center gap-2 rounded-xl border border-brick/30 bg-brick/10 px-3 py-2 text-sm text-brick">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {spyError}
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => router.back()}>
              Annuler
            </Button>
            <Button className="flex-1" onClick={handleBuySpy} disabled={buyingSpy}>
              {buyingSpy
                ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Connexion…</>
                : <><Eye className="h-4 w-4 mr-2" />Regarder en Spy</>
              }
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (status === "ended") {
    return (
      <div className="flex h-screen items-center justify-center bg-ink px-4">
        <div className="max-w-sm rounded-2xl border border-ink-line bg-ink-surface p-6 text-center">
          <PhoneOff className="mx-auto mb-3 h-10 w-10 text-sage-muted" />
          <p className="font-display text-xl text-cream">Show terminé</p>
          {endResult && (
            <div className="mt-4 space-y-2 rounded-xl bg-ink-raised p-4 text-sm">
              <div className="flex justify-between text-sage">
                <span>Durée</span>
                <span className="text-cream">{formatTime(endResult.actual_duration_seconds || elapsed)}</span>
              </div>
              {(endResult.refund_xcon ?? 0) > 0 && (
                <div className="flex justify-between text-sage">
                  <span>Remboursement fan</span>
                  <span className="text-emerald">{formatFCFA(endResult.refund_xcon)}</span>
                </div>
              )}
              {isCreator && (endResult.creator_share_xcon ?? 0) > 0 && (
                <div className="flex justify-between text-sage">
                  <span>Vos gains</span>
                  <span className="text-gold font-semibold">{formatFCFA(endResult.creator_share_xcon)}</span>
                </div>
              )}
            </div>
          )}
          <Button
            className="mt-5 w-full"
            onClick={() => router.push(isCreator ? "/createur/private-shows" : "/")}
          >
            {isCreator ? "Retour aux shows" : "Retour à l'accueil"}
          </Button>
        </div>
      </div>
    );
  }

  // ── SHOW LIVE / GRACE ─────────────────────────────────────
  return (
    <div className="relative flex h-screen flex-col bg-black">
      {/* Badges */}
      {showInfo && (
        <div className="absolute left-4 top-4 z-30 flex gap-2">
          <Badge
            variant={showInfo.show_type === "PREMIUM" ? "gold" : "default"}
            className="flex items-center gap-1"
          >
            {showInfo.show_type === "PREMIUM"
              ? <><Crown className="h-2.5 w-2.5" />Premium</>
              : <><Eye className="h-2.5 w-2.5" />Standard</>
            }
          </Badge>
          {isSpy && (
            <Badge variant="default" className="flex items-center gap-1 bg-ink-raised">
              <Users className="h-2.5 w-2.5" />Spy
            </Badge>
          )}
        </div>
      )}

      {/* ── Vidéo distante ── */}
      <div className="relative flex-1 overflow-hidden bg-black">
        {/* Flux en direct */}
        <video
          ref={remoteVideoRef}
          autoPlay playsInline
          className={cn(
            "h-full w-full object-cover transition-all duration-300",
            status === "grace" && "hidden",
          )}
          onContextMenu={(e) => e.preventDefault()}
        />

        {/* Canvas dernière frame floutée (mode grâce) */}
        {status === "grace" && (
          <div className="relative h-full w-full">
            <canvas
              ref={lastFrameRef}
              className="h-full w-full object-cover"
              style={{ filter: "blur(12px)", transform: "scale(1.05)" }}
            />
            {/* Overlay grâce */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-ink/60 px-6 text-center">
              <WifiOff className="h-10 w-10 text-gold animate-pulse" />
              <div>
                <p className="font-display text-xl text-cream">Problème de connexion</p>
                <p className="mt-1 text-sm text-sage-muted">
                  Le créateur tente de se reconnecter…
                </p>
              </div>
              <div className="rounded-xl bg-ink-raised px-5 py-3">
                <p className="text-xs text-sage-muted">Timer pausé — reprise automatique</p>
                <p className="mt-1 font-mono text-2xl font-bold text-gold">
                  {formatTime(graceRemaining)}
                </p>
                <p className="text-xs text-sage-muted">restantes</p>
              </div>
              {isCreator && (
                <Button onClick={handleReconnect} disabled={reconnecting}>
                  {reconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Me reconnecter
                </Button>
              )}
            </div>
          </div>
        )}

        {/* PiP local — masqué pour le spy (pas de caméra locale) */}
        {status === "live" && !isSpy && (
          <div className="absolute bottom-24 right-4 h-28 w-20 overflow-hidden rounded-xl border-2 border-ink-line shadow-lg">
            <video
              ref={localVideoRef}
              autoPlay playsInline muted
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
        )}

        {/* Timer HUD */}
        <div className="absolute left-0 right-0 top-0 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/60 to-transparent">
          <div className="flex items-center gap-2">
            <div className={cn(
              "h-2 w-2 rounded-full",
              status === "live" ? "animate-pulse bg-brick" : "bg-gold animate-pulse",
            )} />
            <span className="text-xs font-medium text-white">
              {status === "live" ? "LIVE" : "PAUSE"}
            </span>
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
      </div>

      {/* ── Contrôles ── */}
      {status === "live" && (
        <div className="flex items-center justify-center gap-4 bg-black/90 px-4 py-4">
          {!isSpy && (
            <button
              onClick={toggleAudio}
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-full border transition-colors",
                audioOn
                  ? "border-white/20 bg-white/10 text-white hover:bg-white/20"
                  : "border-brick/40 bg-brick/20 text-brick",
              )}
            >
              {audioOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </button>
          )}

          <button
            onClick={isSpy ? () => router.back() : endSession}
            disabled={ending}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-brick text-white shadow-lg hover:bg-brick/90 active:scale-95 transition-transform disabled:opacity-60"
          >
            {ending ? <Loader2 className="h-5 w-5 animate-spin" /> : <PhoneOff className="h-5 w-5" />}
          </button>

          {!isSpy && (
            <button
              onClick={toggleVideo}
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-full border transition-colors",
                videoOn
                  ? "border-white/20 bg-white/10 text-white hover:bg-white/20"
                  : "border-brick/40 bg-brick/20 text-brick",
              )}
            >
              {videoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
