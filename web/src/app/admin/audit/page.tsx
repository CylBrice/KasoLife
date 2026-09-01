"use client";

import { useEffect, useState, useCallback } from "react";
import { ClipboardList, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SubTabs } from "@/components/admin/sub-tabs";
import { api } from "@/lib/api";

type Tab = "all" | "by-admin" | "by-type";

interface AuditAction {
  id: string; admin_id: string; action: string; target_type: string|null;
  reason: string|null; metadata: Record<string,any>|null; created_at: string;
  admin: { pseudo: string; role: string }|null;
}

const ACTION_VARIANT: Record<string, any> = {
  SET_AI_CONFIG: "gold", UPDATE_CONFIG: "gold", CHANGE_ROLE: "gold",
  APPROVE_APPLICATION: "emerald", APPROVE_PAYOUT: "emerald", REACTIVATE_ADMIN: "emerald",
  SUSPEND_USER: "coral", REJECT_APPLICATION: "coral", SUSPEND_ADMIN: "coral", REJECT_PAYOUT: "coral",
};

const TABS = [
  { key: "all",      label: "📋 Toutes les actions" },
  { key: "by-admin", label: "👮 Par admin" },
  { key: "by-type",  label: "🏷️ Par type" },
];

export default function AuditPage() {
  const [tab, setTab]           = useState<Tab>("all");
  const [data, setData]         = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [page, setPage]         = useState(1);
  const [filterAdmin, setFilterAdmin] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [admins, setAdmins]     = useState<any[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "50" });
    if (filterAdmin)  params.set("admin_id", filterAdmin);
    if (filterAction) params.set("action", filterAction);
    api.get(`/admin/audit?${params}`)
      .then(({ data: d }) => setData(d))
      .finally(() => setLoading(false));
  }, [page, filterAdmin, filterAction]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [tab, filterAdmin, filterAction]);
  useEffect(() => { api.get("/admin/admins").then(({ data: d }) => setAdmins(d || [])).catch(() => {}); }, []);

  const totalPages = data?.pages ?? 1;
  const actions: AuditAction[] = data?.actions || [];

  // Regroupement par admin (onglet by-admin)
  const byAdmin: Record<string, AuditAction[]> = {};
  actions.forEach(a => {
    const key = a.admin?.pseudo || a.admin_id;
    if (!byAdmin[key]) byAdmin[key] = [];
    byAdmin[key].push(a);
  });

  // Regroupement par type (onglet by-type)
  const byType: Record<string, AuditAction[]> = {};
  actions.forEach(a => {
    if (!byType[a.action]) byType[a.action] = [];
    byType[a.action].push(a);
  });

  const ActionRow = ({ action }: { action: AuditAction }) => (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-start gap-3 min-w-0">
            <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gold" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={ACTION_VARIANT[action.action] || "default"}>{action.action}</Badge>
                {action.target_type && <span className="text-xs text-sage-muted">→ {action.target_type}</span>}
              </div>
              <p className="mt-1 text-sm font-medium text-cream">@{action.admin?.pseudo ?? "?"} <span className="text-xs text-sage-muted">({action.admin?.role})</span></p>
              {action.reason && <p className="mt-0.5 text-xs text-sage">Motif : {action.reason}</p>}
              {action.metadata && Object.keys(action.metadata).length > 0 && (
                <p className="mt-0.5 truncate text-xs text-sage-muted font-mono">
                  {Object.entries(action.metadata).slice(0,3).map(([k,v]) => `${k}: ${v}`).join(" · ")}
                </p>
              )}
            </div>
          </div>
          <time className="shrink-0 text-xs text-sage-muted">
            {new Date(action.created_at).toLocaleString("fr-FR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"})}
          </time>
        </div>
      </CardContent>
    </Card>
  );

  const Pagination = () => totalPages <= 1 ? null : (
    <div className="flex items-center justify-between">
      <p className="text-sm text-sage-muted">Page {page} / {totalPages} · {data?.total || 0} entrées</p>
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={() => setPage(p => Math.max(1,p-1))} disabled={page<=1}><ChevronLeft className="h-4 w-4" /></Button>
        <Button size="sm" variant="ghost" onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page>=totalPages}><ChevronRight className="h-4 w-4" /></Button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-medium text-cream">Journal d&apos;audit</h1>
        <p className="mt-1 text-sm text-sage">Toutes les actions des administrateurs.</p>
      </div>
      <SubTabs tabs={TABS} active={tab} onChange={(k) => setTab(k as Tab)} />

      {/* ── Filtres contextuels ── */}
      {tab === "by-admin" && (
        <select value={filterAdmin} onChange={(e) => setFilterAdmin(e.target.value)}
          className="h-9 rounded-xl border border-ink-line bg-ink-raised px-3 text-sm text-cream focus:border-gold focus:outline-none">
          <option value="">Tous les admins</option>
          {admins.map(a => <option key={a.id} value={a.id}>@{a.pseudo} ({a.role})</option>)}
        </select>
      )}
      {tab === "by-type" && (
        <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)}
          className="h-9 rounded-xl border border-ink-line bg-ink-raised px-3 text-sm text-cream focus:border-gold focus:outline-none">
          <option value="">Tous les types</option>
          {(data?.available_filters?.actions || []).map((a: string) => <option key={a} value={a}>{a}</option>)}
        </select>
      )}

      {loading ? <p className="text-sm text-sage-muted">Chargement...</p> :
       actions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-line px-6 py-16 text-center">
          <ClipboardList className="mx-auto h-8 w-8 text-sage-muted" />
          <p className="mt-2 font-display text-lg text-cream">Aucune entrée</p>
        </div>
      ) : (
        <>
          {/* ── Toutes ── */}
          {tab === "all" && <div className="flex flex-col gap-2">{actions.map(a => <ActionRow key={a.id} action={a} />)}</div>}

          {/* ── Par admin ── */}
          {tab === "by-admin" && (
            filterAdmin
              ? <div className="flex flex-col gap-2">{actions.map(a => <ActionRow key={a.id} action={a} />)}</div>
              : <div className="flex flex-col gap-4">
                  {Object.entries(byAdmin).map(([pseudo, acts]) => (
                    <div key={pseudo}>
                      <h3 className="mb-2 text-sm font-medium text-cream">@{pseudo} <span className="text-sage-muted">({acts.length})</span></h3>
                      <div className="flex flex-col gap-2">{acts.slice(0,5).map(a => <ActionRow key={a.id} action={a} />)}</div>
                    </div>
                  ))}
                </div>
          )}

          {/* ── Par type ── */}
          {tab === "by-type" && (
            filterAction
              ? <div className="flex flex-col gap-2">{actions.map(a => <ActionRow key={a.id} action={a} />)}</div>
              : <div className="flex flex-col gap-4">
                  {Object.entries(byType).sort(([,a],[,b]) => b.length-a.length).map(([type, acts]) => (
                    <div key={type}>
                      <div className="mb-2 flex items-center gap-2">
                        <Badge variant={ACTION_VARIANT[type] || "default"}>{type}</Badge>
                        <span className="text-xs text-sage-muted">{acts.length} fois</span>
                      </div>
                      <div className="flex flex-col gap-2">{acts.slice(0,3).map(a => <ActionRow key={a.id} action={a} />)}</div>
                    </div>
                  ))}
                </div>
          )}

          <Pagination />
        </>
      )}
    </div>
  );
}
