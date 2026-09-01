"use client";

import { useEffect, useState } from "react";
import { Users, FileText, Wallet as WalletIcon, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatFCFA } from "@/lib/utils";
import { api } from "@/lib/api";
import { useT } from "@/i18n/locale-context";
import type { CreatorStats } from "@/types";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

export default function CreatorDashboardPage() {
  const t = useT();
  const [stats, setStats] = useState<CreatorStats | null>(null);

  useEffect(() => {
    api.get("/creators/me/stats").then(({ data }) => setStats(data)).catch(() => {});
  }, []);

  if (!stats) return <p className="text-sm text-sage-muted">Chargement...</p>;

  const revenueData = [
    { label: "Abonnements", value: stats.revenue_30d.subscriptions },
    { label: "Pourboires", value: stats.revenue_30d.tips },
    { label: "Contenu PPV", value: stats.revenue_30d.ppv },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-medium text-cream">Tableau de bord</h1>
        <p className="mt-1 text-sm text-sage">Vue d&apos;ensemble de votre activité créateur.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={Users} label={t("creatorDashboard.subscribersStat")} value={stats.profile.subscribers_count.toString()} />
        <StatCard icon={FileText} label={t("creatorDashboard.publicationsStat")} value={stats.profile.posts_count.toString()} />
        <StatCard
          icon={WalletIcon}
          label={t("creatorDashboard.pendingBalance")}
          value={formatFCFA(stats.wallet.pending_balance_xcon)}
          accent="emerald"
        />
        <StatCard
          icon={TrendingUp}
          label={t("creatorDashboard.revenue30d")}
          value={formatFCFA(stats.revenue_30d.total)}
          accent="gold"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Revenus des 30 derniers jours</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A4A41" vertical={false} />
                <XAxis dataKey="label" stroke="#9CB5AC" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#9CB5AC" fontSize={12} tickLine={false} axisLine={false}
                  tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip
                  contentStyle={{ background: "#16302A", border: "1px solid #2A4A41", borderRadius: 8 }}
                  labelStyle={{ color: "#F4F1EA" }}
                  formatter={(value) => [formatFCFA(Number(value)), "Revenus"]}
                />
                <Bar dataKey="value" fill="#E8A33D" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <p className="text-sm text-sage">Prix d&apos;abonnement actuel</p>
            <p className="font-mono text-xl tabular text-cream">
              {formatFCFA(stats.profile.subscription_price_xcon)}/30j
            </p>
          </div>
          <div>
            <p className="text-sm text-sage">Solde disponible</p>
            <p className="font-mono text-xl tabular text-gold-bright">
              {formatFCFA(stats.wallet.balance_xcon)}
            </p>
          </div>
          <div>
            <p className="text-sm text-sage">Total des revenus</p>
            <p className="font-mono text-xl tabular text-cream">
              {formatFCFA(stats.wallet.total_earned)}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon, label, value, accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent?: "gold" | "emerald";
}) {
  const color = accent === "gold" ? "text-gold-bright" : accent === "emerald" ? "text-emerald-bright" : "text-cream";
  return (
    <Card>
      <CardContent className="p-4">
        <Icon className="h-4 w-4 text-sage-muted" />
        <p className={`mt-2 font-mono text-lg tabular ${color}`}>{value}</p>
        <p className="text-xs text-sage-muted">{label}</p>
      </CardContent>
    </Card>
  );
}
