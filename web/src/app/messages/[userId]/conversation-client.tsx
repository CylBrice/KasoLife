"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/locale-context";
import { useDynamicSegment } from "@/lib/use-dynamic-segment";
import Image from "next/image";
import { Send, Lock, Gift, ArrowLeft } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { formatFCFA, formatRelativeDate, cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import type { Message } from "@/types";

export default function ConversationClient() {
  const t = useT();
  const routeUserId = useDynamicSegment(1); // /messages/[userId]
  const { user, loading, refresh } = useAuth();
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [otherUser, setOtherUser] = useState<{ pseudo: string; avatar_url?: string; role: string } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState("");
  const [ppvPrice, setPpvPrice] = useState("");
  const [showTip, setShowTip] = useState(false);
  const [tipAmount, setTipAmount] = useState("500");
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (routeUserId) setUserId(routeUserId);
  }, [routeUserId]);

  useEffect(() => {
    if (!loading && !user) router.push("/connexion");
  }, [loading, user, router]);

  const loadMessages = () => {
    if (!userId) return;
    api.get(`/messages/${userId}`).then(({ data }) => setMessages(data || []));
  };

  useEffect(() => {
    if (user && userId) {
      loadMessages();
      // Récupère le pseudo via les conversations (léger) — sinon fallback générique
      api.get("/messages/conversations").then(({ data }) => {
        const conv = (data || []).find((c: any) => c.user.id === userId);
        if (conv) setOtherUser(conv.user);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, userId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const isCreator = user?.role === "CREATOR" || user?.role === "ADMIN" || user?.role === "SUPERADMIN";

  const handleSend = async () => {
    if (!content.trim() || !userId) return;
    setError(null);
    try {
      const price = isCreator && ppvPrice ? Number(ppvPrice) : 0;
      await api.post(`/messages/${userId}`, { content: content.trim(), price_xcon: price || undefined });
      setContent("");
      setPpvPrice("");
      loadMessages();
    } catch (err: any) {
      setError(err?.response?.data?.error || t("messages.sendError"));
    }
  };

  const handleUnlock = async (messageId: string) => {
    setError(null);
    try {
      await api.post(`/messages/${messageId}/unlock`);
      loadMessages();
      refresh();
    } catch (err: any) {
      setError(err?.response?.data?.error || t("messages.unlockError"));
    }
  };

  const handleTip = async () => {
    if (!userId) return;
    setError(null);
    try {
      await api.post(`/messages/${userId}/tip`, { amount_xcon: Number(tipAmount) });
      setShowTip(false);
      refresh();
      loadMessages();
    } catch (err: any) {
      setError(err?.response?.data?.error || t("messages.tipError"));
    }
  };

  if (loading || !user || !userId) return null;

  return (
    <>
      <Navbar />
      <main className="mx-auto flex h-[calc(100vh-4rem)] max-w-2xl flex-col px-4">
        {/* En-tête conversation */}
        <div className="flex items-center gap-3 border-b border-ink-line py-3">
          <button onClick={() => router.push("/messages")} className="text-sage hover:text-cream">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="relative h-9 w-9 overflow-hidden rounded-full bg-ink-raised">
            {otherUser?.avatar_url ? (
              <Image src={otherUser.avatar_url} alt="" fill className="object-cover" sizes="36px" />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-display text-gold">
                {otherUser?.pseudo?.[0]?.toUpperCase() || "?"}
              </div>
            )}
          </div>
          <p className="font-medium text-cream">@{otherUser?.pseudo || "..."}</p>
          {otherUser?.role === "CREATOR" && (
            <button onClick={() => setShowTip(true)} className="ml-auto flex items-center gap-1.5 rounded-xl border border-gold/30 bg-gold/10 px-3 py-1.5 text-sm text-gold-bright hover:bg-gold/20">
              <Gift className="h-4 w-4" /> Pourboire
            </button>
          )}
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto py-4">
          <div className="flex flex-col gap-2">
            {messages.map((msg) => {
              const mine = msg.sender_id === user.id;
              return (
                <div key={msg.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm",
                    mine ? "bg-gold text-ink" : "bg-ink-surface text-cream border border-ink-line"
                  )}>
                    {msg.locked ? (
                      <div className="flex flex-col items-center gap-2 py-2 text-center">
                        <Lock className="h-5 w-5 text-gold" />
                        <p>Message exclusif — {formatFCFA(msg.price_xcon)}</p>
                        <Button size="sm" onClick={() => handleUnlock(msg.id)}>Débloquer</Button>
                      </div>
                    ) : (
                      <>
                        {msg.content && <p>{msg.content}</p>}
                        {msg.media_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={msg.media_url} alt="" className="mt-1 max-h-48 rounded-lg" />
                        )}
                      </>
                    )}
                    <p className={cn("mt-1 text-[10px]", mine ? "text-ink/60" : "text-sage-muted")}>
                      {formatRelativeDate(msg.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {error && <p className="pb-2 text-sm text-brick">{error}</p>}

        {/* Saisie */}
        <div className="border-t border-ink-line py-3">
          {isCreator && (
            <input
              type="number"
              placeholder="Prix message exclusif (FCFA, optionnel)"
              className="mb-2 h-9 w-full rounded-xl border border-ink-line bg-ink-surface px-3 text-sm text-cream placeholder:text-sage-muted focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
              value={ppvPrice}
              onChange={(e) => setPpvPrice(e.target.value)}
            />
          )}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder={t("messages.typeMessage")}
              className="h-11 flex-1 rounded-xl border border-ink-line bg-ink-surface px-3.5 text-sm text-cream placeholder:text-sage-muted focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
            />
            <Button size="icon" onClick={handleSend}><Send className="h-4 w-4" /></Button>
          </div>
        </div>
      </main>

      {/* Modal pourboire */}
      {showTip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-ink-line bg-ink-surface p-5">
            <h3 className="font-display text-lg text-cream">Envoyer un pourboire</h3>
            <input
              type="number"
              min={100}
              max={500000}
              className="mt-3 h-11 w-full rounded-xl border border-ink-line bg-ink-raised px-3.5 text-sm text-cream focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
              value={tipAmount}
              onChange={(e) => setTipAmount(e.target.value)}
            />
            <div className="mt-4 flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setShowTip(false)}>Annuler</Button>
              <Button className="flex-1" onClick={handleTip}>Envoyer {formatFCFA(Number(tipAmount) || 0)}</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
