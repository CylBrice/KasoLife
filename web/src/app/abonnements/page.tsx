"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Footer } from "@/components/layout/footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatFCFA } from "@/lib/utils";
import { api } from "@/lib/api";
import { useT } from "@/i18n/locale-context";
import { useAuth } from "@/contexts/auth-context";
import type { Subscription } from "@/types";

const STATUS_VARIANTS: Record<string, "emerald" | "default" | "coral"> = {
  ACTIVE: "emerald", CANCELLED: "default", EXPIRED: "default", PAST_DUE: "coral",
};

export default function AbonnementsPage() {
  const t = useT();
  const { user, loading } = useAuth();
  const router = useRouter();
  const [subs, setSubs] = useState<Subscription[]>([]);

  useEffect(() => {
    if (!loading && !user) router.push("/connexion");
  }, [loading, user, router]);

  useEffect(() => {
    if (user) {
      api.get("/subscriptions/me").then(({ data }) => setSubs(data || [])).catch(() => {});
    }
  }, [user]);

  const handleCancel = async (id: string) => {
    try {
      await api.put(`/subscriptions/${id}/cancel`);
      setSubs((prev) => prev.map((s) => (s.id === id ? { ...s, auto_renew: false } : s)));
    } catch {}
  };

  const handleResume = async (id: string) => {
    try {
      await api.put(`/subscriptions/${id}/resume`);
      setSubs((prev) => prev.map((s) => (s.id === id ? { ...s, auto_renew: true } : s)));
    } catch {}
  };

  if (loading || !user) return null;

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-6 md:pb-12">
        <h1 className="font-display text-2xl font-medium text-cream">{t("subscriptions.title")}</h1>

        {subs.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-ink-line px-6 py-16 text-center">
            <p className="font-display text-lg text-cream">{t("subscriptions.none")}</p>
            <p className="mt-1 text-sm text-sage">Découvrez des créateurs et abonnez-vous pour soutenir leur travail.</p>
            <Link href="/" className="mt-4 inline-block">
              <Button>{t("subscriptions.discover")}</Button>
            </Link>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {subs.map((sub) => {
              const statusVariant = STATUS_VARIANTS[sub.status] || "default";
              const statusKey = `subscriptions.status.${sub.status}` as const;
              return (
                <div key={sub.id} className="flex items-center gap-3 rounded-xl border border-ink-line bg-ink-surface p-3">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-ink-raised">
                    {sub.creator?.avatar_url ? (
                      <Image src={sub.creator.avatar_url} alt="" fill className="object-cover" sizes="48px" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center font-display text-gold">
                        {sub.creator?.creator_profile?.display_name?.[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={`/createurs/${sub.creator?.pseudo}`} className="truncate font-medium text-cream hover:text-gold">
                      {sub.creator?.creator_profile?.display_name}
                    </Link>
                    <p className="text-xs text-sage-muted">
                      {formatFCFA(sub.price_xcon)}/30j · {t("subscriptions.renewsOn")}{" "}
                      {new Date(sub.current_period_end).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <Badge variant={statusVariant}>{t(`subscriptions.status.${sub.status}` as any) || sub.status}</Badge>
                  {sub.status === "ACTIVE" && (
                    sub.auto_renew ? (
                      <Button size="sm" variant="ghost" onClick={() => handleCancel(sub.id)}>
                        {t("subscriptions.cancelRenewal")}
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => handleResume(sub.id)}>
                        {t("subscriptions.reactivate")}
                      </Button>
                    )
                  )}
                </div>
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
