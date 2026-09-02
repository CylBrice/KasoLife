"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Navbar } from "@/components/layout/navbar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Footer } from "@/components/layout/footer";
import { Badge } from "@/components/ui/badge";
import { formatRelativeDate, cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { useT } from "@/i18n/locale-context";
import type { Conversation } from "@/types";

export default function MessagesPage() {
  const t = useT();
  const { user, loading } = useAuth();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push("/connexion");
  }, [loading, user, router]);

  useEffect(() => {
    if (user) {
      api.get("/messages/conversations")
        .then(({ data }) => setConversations(data || []))
        .finally(() => setLoadingConvs(false));
    }
  }, [user]);

  if (loading || !user) return null;

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-6 md:pb-12">
        <h1 className="font-display text-2xl font-medium text-cream">{t("messages.title")}</h1>

        {loadingConvs ? (
          <p className="mt-4 text-sm text-sage-muted">Chargement...</p>
        ) : conversations.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-ink-line px-6 py-16 text-center">
            <p className="font-display text-lg text-cream">{t("messages.none")}</p>
            <p className="mt-1 text-sm text-sage">
              Vos échanges avec les créateurs et vos abonnés apparaîtront ici.
            </p>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-1">
            {conversations.map(({ user: other, last_message }) => {
              const isMine = last_message.sender_id === user.id;
              const locked = !isMine && last_message.price_xcon > 0 && !last_message.is_paid;
              return (
                <Link
                  key={other.id}
                  href={`/messages/${other.id}`}
                  className="flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-ink-surface"
                >
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-ink-raised">
                    {other.avatar_url ? (
                      <Image src={other.avatar_url} alt="" fill className="object-cover" sizes="48px" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center font-display text-gold">
                        {other.pseudo?.[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-cream">@{other.pseudo}</p>
                    <p className={cn("truncate text-sm", locked ? "text-gold-bright" : "text-sage")}>
                      {locked
                        ? "🔒 Message exclusif"
                        : isMine
                          ? `Vous : ${last_message.content || (last_message.media_url ? t("messages.media") : "")}`
                          : (last_message.content || (last_message.media_url ? t("messages.media") : ""))}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-sage-muted">
                    {formatRelativeDate(last_message.created_at)}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </main>
      <BottomNav />
      <Footer />
    </>
  );
}
