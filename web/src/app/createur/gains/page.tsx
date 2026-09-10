"use client";

// Dashboard gains créateur (4.3)
// Graphique temporel + breakdown par source + brut/commission/net
import { useEffect, useState, useCallback } from "react";
import { TrendingUp, Loader2 } from "lucide-react";
import { formatFCFA } from "@/lib/utils";
import { api } from "@/lib/api";

type Period = "week" | "month" | "year" | "all";

interface Earnings {
  period: string;
  gross: {
    total: number; ppv: number; albums: number; private_chat: number;
    vip_shows: number; snapshots: number; subscriptions: number;
    custom_requests: number; tips: number;
  };
  commission: number;
  net: number;
  series: { period: string; total: number }[];
}

const SOURCES = [
  { key: "subscriptions",   label: "Abonnements" },
  { key: "ppv",             label: "Posts PPV" },
  { key: "albums",          label: "Albums" },
  { key: "private_chat",    label: "Private Chat" },
  { key: "vip_shows",       label: "VIP Shows" },
  { key: "snapshots",       label: "Snapshots" },
  { key: "custom_requests", label: "Custom requests" },
  { key: "tips",            label: "Tips / cadeaux" },
];

const PERIODS: { key: Period; label: string }[] = [
  { key: "week",  label: "7 jours" },
  { key: "month", label: "30 jours" },
  { key: "year",  label: "1 an" },
  { key: "all",   label: "Tout" },
];

export default function CreateurGainsPage() {
  const [period, setPeriod] = useState<Period>("month");
  const [data, setData]     = useState<Earnings | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await api.get(`/creators/me/earnings?period=${period}`);
      setData(res);
    } catch { } finally { setLoading(false); }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const maxSeries = data ? Math.max(...data.series.map(s => s.total), 1) : 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-medium text-cream flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-gold" />
            Tableau de bord des gains
          </h2>
          <p className="text-sm text-sage-muted mt-0.5">Vos revenus par source, bruts et nets de commission</p>
        </div>
        <div className="flex gap-1 rounded-xl border border-ink-line bg-ink-raised p-1">
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`rounded-xl px-3 py-1 text-xs font-medium transition-colors ${
                period === p.key ? "bg-ink-surface text-cream shadow" : "text-sage-muted hover:text-sage"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gold" /></div>
      ) : !data ? null : (
        <>
          {/* Métriques clés */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Brut", value: data.gross.total, color: "text-cream" },
              { label: "Commission plateforme", value: data.commission, color: "text-brick" },
              { label: "Net encaissé", value: data.net, color: "text-gold" },
            ].map(m => (
              <div key={m.label} className="rounded-xl border border-ink-line bg-ink-surface p-4 text-center">
                <p className="text-xs text-sage-muted mb-1">{m.label}</p>
                <p className={`font-mono text-lg font-bold ${m.color}`}>{formatFCFA(m.value)}</p>
              </div>
            ))}
          </div>

          {/* Graphique en barres */}
          {data.series.length > 0 && (
            <div className="rounded-xl border border-ink-line bg-ink-surface p-5">
              <p className="text-sm font-medium text-cream mb-4">Évolution des revenus</p>
              <div className="flex items-end gap-1 h-32">
                {data.series.map((s, i) => {
                  const pct = maxSeries > 0 ? Math.floor((s.total / maxSeries) * 100) : 0;
                  return (
                    <div key={i} className="group relative flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full rounded-t bg-gold/70 hover:bg-gold transition-colors cursor-default"
                        style={{ height: `${Math.max(pct, 2)}%` }}
                      />
                      {/* Tooltip */}
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block whitespace-nowrap rounded bg-ink-raised border border-ink-line px-2 py-0.5 text-xs text-cream z-10">
                        {formatFCFA(s.total)}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-2 text-xs text-sage-muted">
                <span>{data.series[0]?.period}</span>
                <span>{data.series[data.series.length - 1]?.period}</span>
              </div>
            </div>
          )}

          {/* Breakdown par source */}
          <div className="rounded-xl border border-ink-line bg-ink-surface p-5">
            <p className="text-sm font-medium text-cream mb-4">Détail par source</p>
            <div className="space-y-3">
              {SOURCES.map(src => {
                const amount = data.gross[src.key as keyof typeof data.gross] as number;
                const pct = data.gross.total > 0 ? Math.floor((amount / data.gross.total) * 100) : 0;
                if (amount === 0) return null;
                return (
                  <div key={src.key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-sage">{src.label}</span>
                      <span className="font-mono text-xs text-cream">{formatFCFA(amount)}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-ink-raised overflow-hidden">
                      <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              {data.gross.total === 0 && (
                <p className="text-center text-sm text-sage-muted py-4">Aucun revenu sur cette période</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
