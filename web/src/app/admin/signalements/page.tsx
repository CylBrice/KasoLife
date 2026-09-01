"use client";

import { useEffect, useState } from "react";
import { Trash2, Flag, Ban, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SubTabs } from "@/components/admin/sub-tabs";
import { formatRelativeDate } from "@/lib/utils";
import { api } from "@/lib/api";
import type { ContentReport } from "@/types";

type Tab = "all" | "post" | "message" | "pending" | "resolved";

const TARGET_LABELS: Record<string, string> = {
  POST: "Publication", COMMENT: "Commentaire", MESSAGE: "Message", USER: "Utilisateur",
};
const SEVERITY_VARIANT: Record<string, any> = {
  CRITICAL: "coral", HIGH: "coral", MEDIUM: "gold", LOW: "default",
};

export default function AdminSignalementsPage() {
  const [tab, setTab] = useState<Tab>("pending");
  const [reports, setReports] = useState<ContentReport[]>([]);
  const [counts, setCounts] = useState({ pending: 0, resolved: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = (t: Tab = tab) => {
    setLoading(true);
    const status = (t === "pending" || t === "all" || t === "post" || t === "message") ? "PENDING" : "RESOLVED";
    const targetType = t === "post" ? "POST" : t === "message" ? "MESSAGE" : undefined;
    const params = new URLSearchParams({ status });
    if (targetType) params.set("target_type", targetType);
    api.get(`/admin/reports?${params}`)
      .then(({ data }) => setReports(data || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // Charger les compteurs
    Promise.all([
      api.get("/admin/reports?status=PENDING"),
      api.get("/admin/reports?status=RESOLVED"),
    ]).then(([p, r]) => setCounts({ pending: (p.data || []).length, resolved: (r.data || []).length })).catch(() => {});
    load();
  }, []);

  useEffect(() => { load(tab); }, [tab]); // eslint-disable-line

  const handleDismiss = async (id: string) => {
    try { await api.post(`/admin/reports/${id}/dismiss`); setReports((p) => p.filter((r) => r.id !== id)); }
    catch (err: any) { setError(err?.response?.data?.error || "Erreur."); }
  };

  const handleAction = async (id: string, actionType: "DELETE" | "FLAG", suspendAuthor: boolean) => {
    const reason = suspendAuthor ? prompt("Motif de suspension :") : undefined;
    if (suspendAuthor && !reason) return;
    try {
      await api.post(`/admin/reports/${id}/action`, { action_type: actionType, suspend_author: suspendAuthor, reason: reason || "Violation des règles communautaires" });
      setReports((p) => p.filter((r) => r.id !== id));
    } catch (err: any) { setError(err?.response?.data?.error || "Erreur."); }
  };

  const TABS = [
    { key: "pending",  label: "⏳ En attente",  badge: counts.pending },
    { key: "all",      label: "📋 Tous" },
    { key: "post",     label: "📸 Publications" },
    { key: "message",  label: "💬 Messages" },
    { key: "resolved", label: "✅ Traités", badge: counts.resolved },
  ];

  // Filtre côté client pour "all" (déjà PENDING)
  const visible = tab === "all" ? reports : tab === "post" ? reports.filter(r => r.target_type === "POST") : tab === "message" ? reports.filter(r => r.target_type === "MESSAGE") : reports;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-medium text-cream">Signalements</h1>
        <p className="mt-1 text-sm text-sage">Contenu signalé par les utilisateurs — triés par sévérité IA.</p>
      </div>
      <SubTabs tabs={TABS} active={tab} onChange={(k) => setTab(k as Tab)} />

      {error && <p className="text-sm text-brick">{error}</p>}

      {loading ? (
        <p className="text-sm text-sage-muted">Chargement...</p>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-line px-6 py-16 text-center">
          <Flag className="mx-auto h-8 w-8 text-sage-muted" />
          <p className="mt-2 font-display text-lg text-cream">Aucun signalement</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((report) => (
            <Card key={report.id}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center gap-2 justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="coral">{TARGET_LABELS[report.target_type] || report.target_type}</Badge>
                    {(report as any).ai_severity && (
                      <Badge variant={SEVERITY_VARIANT[(report as any).ai_severity] || "default"}>
                        IA: {(report as any).ai_severity}
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-sage-muted">{formatRelativeDate(report.created_at)}</span>
                </div>
                {(report as any).ai_summary && (
                  <p className="mt-2 rounded-lg bg-ink-raised px-3 py-2 text-xs text-sage italic">
                    🤖 {(report as any).ai_summary}
                  </p>
                )}
                <p className="mt-2 text-sm text-cream">{report.reason}</p>
                <p className="mt-1 text-xs text-sage-muted">Signalé par @{report.reporter?.pseudo}</p>

                {tab !== "resolved" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="ghost" onClick={() => handleDismiss(report.id)}>
                      <X className="h-4 w-4" /> Classer sans suite
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => handleAction(report.id, "FLAG", false)}>
                      <Flag className="h-4 w-4" /> Dépublier
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => handleAction(report.id, "DELETE", false)}>
                      <Trash2 className="h-4 w-4" /> Supprimer
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => handleAction(report.id, "DELETE", true)}>
                      <Ban className="h-4 w-4" /> Supprimer + suspendre
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
