"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { api } from "@/lib/api";
import { formatRelativeDate } from "@/lib/utils";

interface Message {
  id: string;
  sender_role: string;
  message: string;
  is_auto?: boolean;
  created_at: string | null;
  priority?: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  LOW:    "bg-ink-raised text-sage",
  MEDIUM: "bg-gold/10 text-gold-bright",
  HIGH:   "bg-coral/10 text-coral",
  URGENT: "bg-coral/20 text-coral font-bold",
};

const WELCOME: Message = {
  id: "__welcome__",
  sender_role: "ADMIN",
  is_auto: true,
  message: "Bonjour\u00a0! 👋 Bienvenue sur le support KasoLife.\n\nDécris ton problème et notre équipe te répondra rapidement. Pour les urgences (compte bloqué, fraude, paiement non reçu), un agent sera alerté immédiatement.",
  created_at: null,
};

export default function SupportPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [messages, setMessages]   = useState<Message[]>([]);
  const [text, setText]           = useState("");
  const [sending, setSending]     = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(true);
  const [error, setError]         = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/connexion");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    api.get("/support/my")
      .then(({ data }) => setMessages(data || []))
      .catch(() => {})
      .finally(() => setLoadingMsg(false));
  }, [user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true); setError("");
    try {
      await api.post("/support/message", { message: trimmed });
      setText("");
      const { data } = await api.get("/support/my");
      setMessages(data || []);
    } catch (e: any) {
      setError(e?.response?.data?.error || "Erreur lors de l'envoi.");
    } finally {
      setSending(false);
    }
  };

  if (loading || !user) return null;

  const allMessages: Message[] = messages.length === 0 ? [WELCOME] : messages;

  return (
    <>
      <Navbar />
      <main className="mx-auto flex max-w-2xl flex-col px-4 pb-32 pt-6 md:pb-16">
        <div className="mb-4">
          <h1 className="font-display text-2xl font-medium text-cream">Support</h1>
          <p className="mt-1 text-sm text-sage">Notre équipe répond 7j/7.</p>
        </div>

        {/* Messages */}
        <div className="flex flex-col gap-3 min-h-64">
          {loadingMsg ? (
            <p className="text-center text-sm text-sage-muted py-8">Chargement...</p>
          ) : (
            allMessages.map((msg) => {
              const isUser = msg.sender_role === "USER";
              return (
                <div key={msg.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    isUser
                      ? "bg-gold text-ink rounded-br-sm"
                      : msg.is_auto
                      ? "border border-ink-line/50 bg-ink-surface text-sage"
                      : "bg-ink-raised text-cream rounded-bl-sm"
                  }`}>
                    {msg.priority && msg.priority !== "LOW" && (
                      <span className={`mb-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${PRIORITY_COLORS[msg.priority]}`}>
                        {msg.priority}
                      </span>
                    )}
                    <p style={{ whiteSpace: "pre-wrap" }}>{msg.message}</p>
                    {msg.created_at && (
                      <p className={`mt-1.5 text-[10px] ${isUser ? "text-ink/60" : "text-sage-muted"}`}>
                        {formatRelativeDate(msg.created_at)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {error && <p className="mt-2 text-xs text-brick">{error}</p>}
      </main>

      {/* Zone de saisie fixe */}
      <div className="fixed inset-x-0 bottom-14 z-20 border-t border-ink-line/50 bg-ink/95 backdrop-blur-md px-4 py-3 md:bottom-0">
        <div className="mx-auto flex max-w-2xl gap-2">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
            placeholder="Décris ton problème…"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-ink-line bg-ink-raised px-4 py-2.5 text-sm text-cream placeholder:text-sage-muted focus:border-gold focus:outline-none"
            style={{ maxHeight: 96 }}
          />
          <Button onClick={handleSend} disabled={!text.trim() || sending} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <BottomNav />
      <Footer />
    </>
  );
}
