"use client";

import { useEffect, useState } from "react";
import { Users, UserCog, FileText, Heart, TrendingUp, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SubTabs } from "@/components/admin/sub-tabs";
import { fmtNum, formatFCFA } from "@/lib/utils";
import { api } from "@/lib/api";
import type { AdminStats } from "@/types";

type Tab = "overview" | "stats";

const REVENUE_LABELS: Record<string, string> = {
  COMMISSION_ABONNEMENT: "Abonnements",
  COMMISSION_TIP: "Pourboires",
  COMMISSION_PPV: "Contenu PPV",
  COMMISSION_RETRAIT: "Retraits",
};

export default function AdminDashboardPage() {
  const [tab, setTab]     = useState<Tab>("overview");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [revenue, setRevenue] = useState<any>(null);

  useEffect(() => {
    api.get("/admin/stats").then(({ data }) => setStats(data)).catch(() => {});
    api.get("/admin/revenue?period=month").then(({ data }) => setRevenue(data)).catch(() => {});
  }, []);

  const TABS = [
    { key: "overview",  label: "Vue d'ensemble" },
    { key: "stats",     label: "Statistiques" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-medium text-cream">Tableau de bord</h1>
        <p className="mt-1 text-sm text-sage">Vue d&apos;ensemble de la plateforme.</p>
      </div>

      <SubTabs tabs={TABS} active={tab} onChange={(k) => setTab(k as Tab)} />

      {/* ── Vue d'ensemble ── */}
      {tab === "overview" && (
        <div className="flex flex-col gap-4">
          {!stats ? (
            <p className="text-sm text-sage-muted">Chargement...</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
                <StatCard index={0} icon={Users}      label="Utilisateurs"        value={fmtNum(stats.total_users)} />
                <StatCard index={1} icon={UserCog}    label="Créateurs"           value={fmtNum(stats.total_creators)} />
                <StatCard index={2} icon={FileText}   label="Publications"        value={fmtNum(stats.total_posts)} />
                <StatCard index={3} icon={Heart}      label="Abonnements actifs"  value={fmtNum(stats.active_subscriptions)} />
                <StatCard index={4} icon={Wallet}     label="Soldes utilisateurs" value={formatFCFA(stats.total_user_balances_xcon)} accent="emerald" />
                <StatCard index={5} icon={TrendingUp} label="Revenus cumulés"     value={formatFCFA(stats.total_revenue_xcon)} accent="gold" />
              </div>

              <Card>
                <CardContent className="p-5">
                  <p className="text-sm text-sage">Solde en attente créateurs</p>
                  <p className="mt-1 font-mono text-2xl tabular text-cream">
                    {formatFCFA(stats.total_pending_creator_earnings_xcon)}
                  </p>
                </CardContent>
              </Card>

              {revenue && (
                <Card>
                  <CardContent className="p-5">
                    <p className="text-sm text-sage">Revenus plateforme — 30 derniers jours</p>
                    <p className="mt-1 font-mono text-2xl tabular text-gold-bright">{formatFCFA(revenue.total_xcon)}</p>
                    <div className="mt-3 flex flex-col gap-1.5">
                      {Object.entries(revenue.breakdown as Record<string, number>).map(([source, amount]) => (
                        <div key={source} className="flex items-center justify-between text-sm">
                          <span className="text-sage">{REVENUE_LABELS[source] || source}</span>
                          <span className="font-mono tabular text-cream">{formatFCFA(amount)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Statistiques ── */}
      {tab === "stats" && (
        <div className="flex flex-col gap-4">
          {!stats ? (
            <p className="text-sm text-sage-muted">Chargement...</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <StatCard icon={Users}    label="Total utilisateurs"  value={fmtNum(stats.total_users)} />
                <StatCard icon={UserCog}  label="Créateurs actifs"    value={fmtNum(stats.total_creators)} />
                <StatCard icon={Heart}    label="Abonnements actifs"  value={fmtNum(stats.active_subscriptions)} />
                <StatCard icon={FileText} label="Total publications"  value={fmtNum(stats.total_posts)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Card>
                  <CardContent className="p-5">
                    <p className="text-xs text-sage-muted uppercase tracking-wider">Soldes utilisateurs</p>
                    <p className="mt-2 font-mono text-xl tabular text-cream">{formatFCFA(stats.total_user_balances_xcon)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-5">
                    <p className="text-xs text-sage-muted uppercase tracking-wider">Revenus totaux (cumul)</p>
                    <p className="mt-2 font-mono text-xl tabular text-gold-bright">{formatFCFA(stats.total_revenue_xcon)}</p>
                  </CardContent>
                </Card>
              </div>
              {revenue && (
                <Card>
                  <CardContent className="p-5">
                    <p className="mb-3 text-sm font-medium text-cream">Répartition des revenus (30j)</p>
                    <div className="flex flex-col gap-2">
                      {Object.entries(revenue.breakdown as Record<string, number>).map(([source, amount]) => {
                        const pct = revenue.total_xcon > 0 ? Math.round((amount / revenue.total_xcon) * 100) : 0;
                        return (
                          <div key={source}>
                            <div className="mb-1 flex items-center justify-between text-sm">
                              <span className="text-sage">{REVENUE_LABELS[source] || source}</span>
                              <span className="text-cream">{formatFCFA(amount)} <span className="text-xs text-sage-muted">{pct}%</span></span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-ink-line">
                              <div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      )}

    </div>
  );
}

const BORDER_COLORS = [
  "border-l-blue-400", "border-l-purple-400", "border-l-pink-400",
  "border-l-emerald-400", "border-l-amber-400", "border-l-teal-400",
];

function StatCard({
  icon: Icon, label, value, accent, index = 0,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent?: "gold" | "emerald";
  index?: number;
}) {
  const color = accent === "gold"
    ? "text-gold-bright"
    : accent === "emerald"
    ? "text-emerald-bright"
    : "text-cream";
  return (
    <Card className={`border-l-4 ${BORDER_COLORS[index % BORDER_COLORS.length]}`}>
      <CardContent className="p-4">
        <Icon className="h-4 w-4 text-sage-muted" />
        <p className={`mt-2 font-mono text-lg tabular ${color}`}>{value}</p>
        <p className="text-xs text-sage-muted">{label}</p>
      </CardContent>
    </Card>
  );
}
