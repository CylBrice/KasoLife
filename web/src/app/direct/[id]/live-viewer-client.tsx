"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Radio, Users, Send, AlertCircle, Gift, Heart, Star, Gem, Crown } from "lucide-react";
import { Room, RoomEvent, Track, type RemoteTrack } from "livekit-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api, getApiToken } from "@/lib/api";
import { useDynamicSegment } from "@/lib/use-dynamic-segment";

type Status = "loading" | "live" | "ended" | "error";

interface ChatEntry {
  id: string;
  pseudo: string;
  text?: string;
  amount_xcon?: number;
  kind: "chat" | "gift";
}

const GIFT_TIERS = [
  { amount: 100, label: "Cœur", icon: Heart },
  { amount: 500, label: "Étoile", icon: Star },
  { amount: 2000, label: "Gemme", icon: Gem },
  { amount: 10000, label: "Couronne", icon: Crown },
];

export default function LiveViewerClient() {
  const streamId = useDynamicSegment(1);
  const videoRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const roomRef = useRef<Room | null>(null);

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [giftError, setGiftError] = useState<string | null>(null);

  const connectSocket = useCallback((id: string) => {
    const wsBase = (process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3003").replace(/\/$/, "");
    const ws = new WebSocket(`${wsBase}/live/ws?streamId=${id}&token=${getApiToken() || ""}`);
    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === "VIEWER_COUNT") setViewerCount(msg.count);
        if (msg.type === "CHAT_MESSAGE")
          setMessages((m) => [...m, { id: crypto.randomUUID(), pseudo: msg.pseudo, text: msg.text, kind: "chat" }]);
        if (msg.type === "GIFT_RECEIVED")
          setMessages((m) => [...m, { id: crypto.randomUUID(), pseudo: msg.pseudo, amount_xcon: msg.amount_xcon, kind: "gift" }]);
        if (msg.type === "GIFT_ERROR") setGiftError(msg.error);
        if (msg.type === "STREAM_ENDED") setStatus("ended");
      } catch {}
    };
    wsRef.current = ws;
  }, []);

  useEffect(() => {
    if (!streamId) return;
    let cancelled = false;

    (async () => {
      try {
        const { data } = await api.get(`/live/${streamId}/token`);
        if (cancelled) return;

        const room = new Room();
        roomRef.current = room;
        room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
          if (track.kind === Track.Kind.Video && videoRef.current) {
            track.attach(videoRef.current);
          } else if (track.kind === Track.Kind.Audio) {
            track.attach();
          }
        });
        await room.connect(data.wsUrl, data.token);

        connectSocket(streamId);
        setStatus("live");
      } catch (err: any) {
        if (err?.response?.status === 410) setStatus("ended");
        else { setError("Impossible de rejoindre ce direct"); setStatus("error"); }
      }
    })();

    return () => {
      cancelled = true;
      roomRef.current?.disconnect();
      wsRef.current?.close();
    };
  }, [streamId, connectSocket]);

  const sendChat = () => {
    const text = chatInput.trim();
    if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "CHAT_MESSAGE", text }));
    setChatInput("");
  };

  const sendGift = (amount: number) => {
    setGiftError(null);
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "SEND_GIFT", amount_xcon: amount }));
  };

  if (status === "loading") {
    return <p className="p-8 text-center text-sm text-sage">Connexion au direct…</p>;
  }

  if (status === "ended") {
    return (
      <div className="flex flex-col items-center gap-3 p-12 text-center">
        <Radio className="h-8 w-8 text-sage-muted" />
        <p className="font-display text-lg text-cream">Ce direct est terminé</p>
        <p className="text-sm text-sage">Le créateur n&apos;est plus en direct pour le moment.</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <p className="mx-auto mt-8 flex max-w-md items-center gap-2 rounded-xl border border-brick/30 bg-brick/10 px-3 py-2 text-sm text-brick">
        <AlertCircle className="h-4 w-4 shrink-0" /> {error}
      </p>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4">
      <div className="flex items-center gap-2 rounded-xl border border-brick/40 bg-brick/10 px-3 py-1.5 text-sm text-brick w-fit">
        <span className="h-2 w-2 animate-pulse rounded-full bg-brick" /> EN DIRECT
        <span className="flex items-center gap-1 text-cream"><Users className="h-3.5 w-3.5" /> {viewerCount}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="overflow-hidden rounded-2xl border border-ink-line bg-ink-raised">
          <video ref={videoRef} autoPlay playsInline className="aspect-video w-full bg-black object-cover" />
        </div>

        <Card className="flex flex-col">
          <CardContent className="flex flex-1 flex-col gap-3 p-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-sage-muted">Envoyer un cadeau</p>
              <div className="grid grid-cols-4 gap-1.5">
                {GIFT_TIERS.map(({ amount, label, icon: Icon }) => (
                  <button
                    key={amount}
                    onClick={() => sendGift(amount)}
                    title={`${label} — ${amount} XCON`}
                    className="flex flex-col items-center gap-1 rounded-xl border border-gold/30 bg-gold/10 px-1 py-2 text-gold-bright hover:bg-gold/20 transition-colors"
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-[10px]">{amount}</span>
                  </button>
                ))}
              </div>
              {giftError && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-brick"><AlertCircle className="h-3 w-3" /> {giftError}</p>
              )}
            </div>

            <p className="text-xs font-semibold uppercase tracking-widest text-sage-muted">Chat</p>
            <div className="flex-1 space-y-1.5 overflow-y-auto text-sm" style={{ maxHeight: 260 }}>
              {messages.length === 0 && <p className="text-sage-muted">Soyez le premier à écrire.</p>}
              {messages.map((m) => (
                <p key={m.id} className={m.kind === "gift" ? "text-gold-bright" : "text-cream"}>
                  {m.kind === "gift" ? (
                    <span className="inline-flex items-center gap-1"><Gift className="h-3.5 w-3.5" /> {m.pseudo} a envoyé {m.amount_xcon} XCON</span>
                  ) : (
                    <><span className="font-semibold">{m.pseudo}</span> — {m.text}</>
                  )}
                </p>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendChat()}
                placeholder="Votre message…"
                className="flex-1 rounded-xl border border-ink-line bg-ink-surface px-3 py-2 text-sm text-cream placeholder:text-sage-muted focus:outline-none"
              />
              <Button size="icon" onClick={sendChat}><Send className="h-4 w-4" /></Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
