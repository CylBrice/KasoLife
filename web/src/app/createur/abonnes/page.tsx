"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { formatFCFA, formatRelativeDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { useT } from "@/i18n/locale-context";
import type { Subscriber } from "@/types";

export default function CreatorSubscribersPage() {
  const t = useT();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/subscriptions/subscribers")
      .then(({ data }) => {
        setSubscribers(data.subscribers || []);
        setTotal(data.pagination?.total || 0);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-medium text-cream">Abonnés</h1>
        <p className="mt-1 text-sm text-sage">
          {total} abonné{total === 1 ? "" : "s"} actif{total === 1 ? "" : "s"}
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-sage-muted">Chargement...</p>
      ) : subscribers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-line px-6 py-16 text-center">
          <p className="font-display text-lg text-cream">{t("creatorDashboard.noSubscribers")}</p>
          <p className="mt-1 text-sm text-sage">Publiez du contenu régulièrement pour attirer des abonnés.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {subscribers.map((sub) => (
            <div key={sub.id} className="flex items-center gap-3 rounded-xl border border-ink-line bg-ink-surface p-3">
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-ink-raised">
                {sub.fan.avatar_url ? (
                  <Image src={sub.fan.avatar_url} alt="" fill className="object-cover" sizes="40px" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center font-display text-gold">
                    {sub.fan.pseudo?.[0]?.toUpperCase()}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-cream">@{sub.fan.pseudo}</p>
                <p className="text-xs text-sage-muted">
                  {t("creatorDashboard.subscribedSince")} {new Date(sub.started_at).toLocaleDateString()}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm tabular text-gold-bright">{formatFCFA(sub.price_xcon)}</p>
                {!sub.auto_renew && <Badge variant="default">{t("creatorDashboard.notRenewed")}</Badge>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
