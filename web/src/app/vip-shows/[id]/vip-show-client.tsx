"use client";

// ============================================================
// KASOLIFE — VIP Show viewer v1.0
// Fans rejoignent un show privé. Grace period : accès gratuit.
// Après grace : paiement requis pour les nouveaux arrivants.
// Fans arrivés pendant la grace → accès complet gratuit.
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Users, Clock, Crown, Loader2, AlertTriangle, Lock, LogOut,
} from "lucide-react";
import { Room, RoomEvent, Track, type RemoteTrack } from "livekit-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { formatFCFA } from "@/lib/utils";

type Status = "loading" | "paywall" | "joining" | "live" | "ended" | "error";

export default function VipShowClient() {
  const params  = useParams();
  const router  = useRouter();
  const { user } = useAuth();
  const showId  = params?.id as string;

  const videoRef = useRef<HTMLVideoElement>(null);
  const roomRef  = useRef<Room | null>(null);

  const [status, setStatus]     = useState<Status>("loading");
  const [show, setShow]         = useState<any>(null);
  const [error, setError]       = useState<string | null>(null);
  const [joining, setJoining]   = useState(false);
  const [graceLeft, setGraceLeft] = useState<number | null>(null);

  // ── Charger les infos du show ─────────────────────────────
  useEffect(() => {
    if (!showId) return;
    api.get(`/vip-shows/${showId}`).then(({ data }) => {
      setShow(data);
      if (data.status !== "LIVE") { setStatus("ended"); return; }

      const graceActive = data.grace_ends_at && new Date() < new Date(data.grace_ends_at);
      if (!graceActive && data.price_xcon > 0) {
        setStatus("paywall");
      } else {
        setStatus("joining");
      }

      // Compte à rebours grace
      if (data.grace_ends_at) {
        const interval = setInterval(() => {
          const left = Math.max(0, Math.floor((new Date(data.grace_ends_at).getTime() - Date.now()) / 1000));
          setGraceLeft(left);
          if (left === 0) clearInterval(interval);
        }, 1000);
        return () => clearInterval(interval);
      }
    }).catch(() => { setError("Show introuvable ou terminé"); setStatus("error"); });
  }, [showId]);

  // ── Rejoindre le show ─────────────────────────────────────
  const joinShow = useCallback(async () => {
    if (!showId || !user) return;
    setJoining(true);
    setError(null);
    try {
      const { data } = await api.post(`/vip-shows/${showId}/join`);
      const { token, ws_url, room_name } = data;

      const room = new Room();
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
        if (track.kind === Track.Kind.Video) {
          const el = videoRef.current;
          if (el) track.attach(el);
        }
      });
      room.on(RoomEvent.Disconnected, () => setStatus("ended"));

      await room.connect(ws_url, token);
      setStatus("live");
    } catch (err: any) {
      setError(err?.response?.data?.error || "Impossible de rejoindre le show");
      setStatus("paywall");
    } finally {
      setJoining(false);
    }
  }, [showId, user]);

  // ── Auto-join si pas de paywall ───────────────────────────
  useEffect(() => {
    if (status === "joining") joinShow();
  }, [status, joinShow]);

  const leaveShow = async () => {
    roomRef.current?.disconnect();
    await api.post(`/vip-shows/${showId}/leave`).catch(() => {});
    router.back();
  };

  // ── Nettoyage ─────────────────────────────────────────────
  useEffect(() => {
    return () => {
      roomRef.current?.disconnect();
      api.post(`/vip-shows/${showId}/leave`).catch(() => {});
    };
  }, [showId]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    return `${m}:${(s % 60).toString().padStart(2, "0")}`;
  };

  // ── États de chargement / erreur ──────────────────────────
  if (status === "loading" || status === "joining") {
    return (
      <div className="flex h-screen items-center justify-center bg-ink">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
          <p className="text-sm text-sage">Connexion au VIP Show…</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex h-screen items-center justify-center bg-ink px-4">
        <div className="max-w-sm text-center">
          <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-brick" />
          <p className="font-display text-lg text-cream">Erreur</p>
          <p className="mt-1 text-sm text-sage-muted">{error}</p>
          <Button className="mt-4" onClick={() => router.back()}>Retour</Button>
        </div>
      </div>
    );
  }

  if (status === "ended") {
    return (
      <div className="flex h-screen items-center justify-center bg-ink px-4">
        <div className="max-w-sm text-center">
          <Crown className="mx-auto mb-3 h-10 w-10 text-sage-muted" />
          <p className="font-display text-xl text-cream">VIP Show terminé</p>
          <Button className="mt-5 w-full" onClick={() => router.push("/")}>Retour à l&apos;accueil</Button>
        </div>
      </div>
    );
  }

  if (status === "paywall") {
    return (
      <div className="flex h-screen items-center justify-center bg-ink px-4">
        <div className="max-w-sm rounded-2xl border border-ink-line bg-ink-surface p-6">
          <Crown className="mx-auto mb-3 h-10 w-10 text-gold" />
          <p className="font-display text-center text-xl text-cream mb-1">{show?.title}</p>
          <p className="text-center text-sm text-sage-muted mb-4">
            {show?.creator?.display_name || show?.creator?.pseudo}
          </p>

          <div className="flex items-center justify-center gap-3 mb-4">
            <Users className="h-4 w-4 text-sage-muted" />
            <span className="text-sm text-sage">{show?.current_fans || 0} fans connectés</span>
          </div>

          <div className="rounded-xl border border-gold/20 bg-gold/5 p-4 text-center mb-5">
            <Lock className="mx-auto mb-1 h-4 w-4 text-gold" />
            <p className="text-sm text-sage">Accès au show</p>
            <p className="font-mono text-2xl font-bold text-gold mt-1">{formatFCFA(show?.price_xcon)}</p>
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-brick/30 bg-brick/10 px-3 py-2 text-xs text-brick">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}

          <Button className="w-full" onClick={joinShow} disabled={joining}>
            {joining ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Crown className="h-4 w-4 mr-2" />}
            Rejoindre le VIP Show
          </Button>
          <Button variant="ghost" className="w-full mt-2 text-sage-muted" onClick={() => router.back()}>
            Annuler
          </Button>
        </div>
      </div>
    );
  }

  // ── Live ──────────────────────────────────────────────────
  return (
    <div className="relative flex h-screen flex-col bg-black">
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="h-full w-full object-cover"
          onContextMenu={(e) => e.preventDefault()}
        />

        {/* Header */}
        <div className="absolute left-0 right-0 top-0 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/70 to-transparent">
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-gold" />
            <span className="text-sm font-medium text-white truncate max-w-xs">{show?.title}</span>
          </div>
          <div className="flex items-center gap-3">
            {graceLeft !== null && graceLeft > 0 && (
              <div className="flex items-center gap-1 rounded-full bg-emerald/20 border border-emerald/40 px-2 py-0.5">
                <Clock className="h-3 w-3 text-emerald" />
                <span className="text-xs text-emerald">Gratuit {formatTime(graceLeft)}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 rounded-full bg-black/50 px-2 py-0.5">
              <Users className="h-3.5 w-3.5 text-white/70" />
              <span className="text-xs text-white">{show?.current_fans || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bouton quitter */}
      <div className="flex items-center justify-center bg-black/90 py-4">
        <button
          onClick={leaveShow}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-brick text-white hover:bg-brick/90"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
