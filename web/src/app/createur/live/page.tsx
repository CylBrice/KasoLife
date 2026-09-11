"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Radio, Users, Send, Square, AlertCircle, Gift } from "lucide-react";
import { Room, RoomEvent, createLocalTracks, type LocalTrack } from "livekit-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AmountInput } from "@/components/ui/amount-input";
import { ToyOverlay } from "@/components/live/toy-overlay";
import { GoalOverlay } from "@/components/live/goal-overlay";
import { LiveChatTabs } from "@/components/live/chat-tabs";
import { CreatorInfoTabs } from "@/components/live/creator-info-tabs";
import { api, getApiToken } from "@/lib/api";

type Status = "idle" | "starting" | "live" | "ending" | "ended" | "error";

interface ChatEntry {
  id: string;
  pseudo: string;
  text?: string;
  amount_xcon?: number;
  kind: "chat" | "gift";
}

export default function CreatorLivePage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const roomRef = useRef<Room | null>(null);
  const tracksRef = useRef<LocalTrack[]>([]);

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [streamId, setStreamId] = useState<string | null>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [viewers, setViewers] = useState<Array<{ id: string; pseudo: string; gender?: string }>>([]);
  const [loadingViewers, setLoadingViewers] = useState(false);
  const [creatorData, setCreatorData] = useState<any>(null);
  const [albums, setAlbums] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [priceXcon, setPriceXcon] = useState("");
  const [showToyOverlay, setShowToyOverlay] = useState(true);
  const [toyTips, setToyTips] = useState<Array<{ id: string; username: string; amount: number; palier: number; duration_s: number; timestamp: number }>>([]);
  const [activeGoal, setActiveGoal] = useState<any>(null);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalAmount, setGoalAmount] = useState(5000);
  const [loadingGoal, setLoadingGoal] = useState(false);

  // Aperçu caméra/micro avant de démarrer le direct
  useEffect(() => {
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia({ audio: true, video: true })
      .then((s) => {
        stream = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch(() => setError("Accès à la caméra/micro refusé — autorisez-les pour démarrer un direct."));
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);

  const loadViewers = useCallback(() => {
    if (!roomRef.current) return;
    setLoadingViewers(true);
    try {
      const participants = Array.from(roomRef.current.remoteParticipants.values()).map((p) => ({
        id: p.identity,
        pseudo: p.name || p.identity,
        gender: undefined,
      }));
      setViewers(participants);
    } catch (err) {
      console.error("Erreur loadViewers:", err);
    } finally {
      setLoadingViewers(false);
    }
  }, []);

  const loadCreatorData = useCallback(async (id: string) => {
    try {
      const { data } = await api.get(`/creators/me`);
      setCreatorData(data);
    } catch (err) {
      console.error("Erreur loadCreatorData:", err);
    }
  }, []);

  const loadAlbums = useCallback(async () => {
    try {
      const { data } = await api.get(`/albums/creator/me`);
      setAlbums(data || []);
    } catch (err) {
      console.error("Erreur loadAlbums:", err);
    }
  }, []);

  const connectSocket = useCallback((id: string) => {
    const wsBase = (process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3003").replace(/\/$/, "");
    const ws = new WebSocket(`${wsBase}/live/ws?streamId=${id}&token=${getApiToken() || ""}`);
    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === "VIEWER_COUNT") setViewerCount(msg.count);
        if (msg.type === "CHAT_MESSAGE")
          setMessages((m) => [...m, { id: crypto.randomUUID(), pseudo: msg.pseudo, text: msg.text, kind: "chat" }]);
        if (msg.type === "GIFT_RECEIVED") {
          setMessages((m) => [...m, { id: crypto.randomUUID(), pseudo: msg.pseudo, amount_xcon: msg.amount_xcon, kind: "gift" }]);
          setToyTips((t) => [
            { id: crypto.randomUUID(), username: msg.pseudo, amount: msg.amount_xcon, palier: msg.palier || 0, duration_s: msg.duration_seconds || 0, timestamp: Date.now() },
            ...t.slice(0, 9),
          ]);
        }
      } catch {}
    };
    wsRef.current = ws;
  }, []);

  const startLive = async () => {
    setStatus("starting");
    setError(null);
    try {
      const pricePayload = priceXcon.trim() ? { price_xcon: parseInt(priceXcon, 10) } : {};
      const { data } = await api.post("/live/start", { title: title || undefined, ...pricePayload });
      setStreamId(data.streamId);

      const room = new Room();
      roomRef.current = room;
      await room.connect(data.wsUrl, data.publishToken);

      const tracks = await createLocalTracks({ audio: true, video: true });
      tracksRef.current = tracks;
      for (const track of tracks) await room.localParticipant.publishTrack(track);

      connectSocket(data.streamId);
      setStatus("live");
    } catch (err: any) {
      setError(err?.response?.data?.error || "Impossible de démarrer le direct");
      setStatus("error");
    }
  };

  const endLive = async () => {
    if (!streamId) return;
    setStatus("ending");
    try {
      await api.post(`/live/${streamId}/end`);
    } catch {}
    tracksRef.current.forEach((t) => t.stop());
    roomRef.current?.disconnect();
    wsRef.current?.close();
    setStatus("ended");
  };

  const [chatInput, setChatInput] = useState("");
  const sendChat = () => {
    const text = chatInput.trim();
    if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "CHAT_MESSAGE", text }));
    setChatInput("");
  };

  // Cleanup quand le live se termine
  useEffect(() => {
    if (status === "ended") {
      setViewers([]);
      setMessages([]);
      setToyTips([]);
    }
  }, [status]);

  // Persistance préférence overlay
  useEffect(() => {
    const saved = localStorage.getItem("kasolife_toy_overlay_hidden");
    if (saved === "true") setShowToyOverlay(false);
  }, []);

  const toggleOverlay = () => {
    setShowToyOverlay((prev) => {
      localStorage.setItem("kasolife_toy_overlay_hidden", String(!prev));
      return !prev;
    });
  };

  const loadGoal = async () => {
    if (!streamId) return;
    try {
      const { data } = await api.get(`/stream-goals/stream/${streamId}`);
      setActiveGoal(data.goal);
    } catch {}
  };

  const createGoal = async () => {
    if (!streamId || !goalTitle.trim()) return;
    setLoadingGoal(true);
    try {
      const { data } = await api.post("/stream-goals", {
        stream_id: streamId,
        title: goalTitle,
        target_amount_xcon: parseInt(goalAmount, 10),
      });
      setActiveGoal(data.goal);
      setShowGoalModal(false);
      setGoalTitle("");
      setGoalAmount("5000");
    } catch (err: any) {
      setError(err?.response?.data?.error || "Erreur création goal");
    } finally {
      setLoadingGoal(false);
    }
  };

  const deleteGoal = async () => {
    if (!activeGoal) return;
    setLoadingGoal(true);
    try {
      await api.delete(`/stream-goals/${activeGoal.id}`);
      setActiveGoal(null);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Erreur suppression goal");
    } finally {
      setLoadingGoal(false);
    }
  };

  useEffect(() => {
    if (status === "live" && streamId) {
      loadGoal();
      loadCreatorData(streamId);
      loadAlbums();
      const interval = setInterval(() => loadGoal(), 2000);
      return () => clearInterval(interval);
    }
  }, [status, streamId, loadCreatorData, loadAlbums]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-medium text-cream">
            <Radio className="h-6 w-6 text-brick" /> Direct
          </h1>
          <p className="mt-1 text-sm text-sage">Diffusez en direct et recevez chat et cadeaux de vos abonnés en temps réel.</p>
        </div>
        {status === "live" && (
          <div className="flex items-center gap-2 rounded-xl border border-brick/40 bg-brick/10 px-3 py-1.5 text-sm text-brick">
            <span className="h-2 w-2 animate-pulse rounded-full bg-brick" /> EN DIRECT
            <span className="flex items-center gap-1 text-cream"><Users className="h-3.5 w-3.5" /> {viewerCount}</span>
          </div>
        )}
      </div>

      {error && (
        <p className="flex items-center gap-2 rounded-xl border border-brick/30 bg-brick/10 px-3 py-2 text-sm text-brick">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="overflow-hidden rounded-2xl border border-ink-line bg-ink-raised relative">
          <video ref={videoRef} autoPlay muted playsInline className="aspect-video w-full bg-black object-cover" />
        </div>

        <LiveChatTabs
          messages={messages}
          viewers={viewers}
          onSendChat={sendChat}
          isSendingChat={false}
          onRefreshUsers={loadViewers}
          isLoadingUsers={loadingViewers}
        />
      </div>

      {/* Bottom Section - Toy Queue + Creator Info */}
      {status === "live" && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Toy Queue - Left */}
          <div className="bg-ink-raised rounded-2xl border border-ink-line p-4">
            <ToyOverlay
              visible={showToyOverlay}
              onToggle={toggleOverlay}
              tips={toyTips}
              role="creator"
            />
          </div>

          {/* Creator Info Tabs - Right */}
          {creatorData && (
            <div className="aspect-video rounded-2xl border border-ink-line overflow-hidden">
              <CreatorInfoTabs creator={creatorData} albums={albums} />
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
        {status === "idle" || status === "error" ? (
          <>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titre du direct (optionnel)"
              className="flex-1 rounded-xl border border-ink-line bg-ink-surface px-3 py-2 text-sm text-cream placeholder:text-sage-muted focus:outline-none"
            />
            <AmountInput
              value={priceXcon ? Number(priceXcon) : 0}
              onChange={(v) => setPriceXcon(v > 0 ? String(v) : "")}
              min={100}
              max={200000}
              step={100}
              label="Prix direct"
            />
            <Button onClick={startLive}><Radio className="h-4 w-4" /> Démarrer le direct</Button>
          </>
        ) : status === "starting" ? (
          <Button disabled>Connexion en cours…</Button>
        ) : status === "live" ? (
          <Button variant="danger" onClick={endLive}><Square className="h-4 w-4" /> Terminer le direct</Button>
        ) : status === "ending" ? (
          <Button variant="danger" disabled>Fermeture…</Button>
        ) : (
          <p className="text-sm text-sage">Direct terminé.</p>
        )}
      </div>

      {/* Goal Overlay */}
      {activeGoal && status === "live" && (
        <GoalOverlay
          title={activeGoal.title}
          current={activeGoal.current_amount_xcon}
          target={activeGoal.target_amount_xcon}
          isCompleted={activeGoal.status === "COMPLETED"}
          role="creator"
        />
      )}

      {/* Goal Modal */}
      {showGoalModal && status === "live" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md">
            <CardContent className="pt-6 space-y-4">
              <h3 className="font-display text-lg text-cream">Créer un objectif</h3>
              <input
                type="text"
                value={goalTitle}
                onChange={(e) => setGoalTitle(e.target.value)}
                placeholder="Ex: Take off my panties and..."
                maxLength={300}
                className="w-full rounded-xl border border-ink-line bg-ink-surface px-3 py-2 text-sm text-cream placeholder:text-sage-muted focus:outline-none"
              />
              <AmountInput
                label="Montant (min 1000 XAF)"
                value={goalAmount}
                onChange={setGoalAmount}
                min={1000}
                step={100}
              />
              <div className="flex gap-2">
                <Button
                  onClick={createGoal}
                  disabled={loadingGoal || !goalTitle.trim()}
                  className="flex-1"
                >
                  Créer
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowGoalModal(false)}
                  disabled={loadingGoal}
                  className="flex-1"
                >
                  Annuler
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Create Goal Button */}
      {status === "live" && !activeGoal && (
        <div className="flex gap-2 justify-center">
          <Button onClick={() => setShowGoalModal(true)} variant="outline">
            + Créer un objectif
          </Button>
        </div>
      )}

      {/* Delete Goal Button */}
      {activeGoal && status === "live" && activeGoal.can_delete && (
        <div className="flex gap-2 justify-center">
          <Button
            onClick={deleteGoal}
            disabled={loadingGoal}
            variant="outline"
            className="border-brick/40 text-brick"
          >
            Supprimer l'objectif
          </Button>
        </div>
      )}
    </div>
  );
}
