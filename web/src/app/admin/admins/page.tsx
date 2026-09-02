"use client";

import { useEffect, useState, useCallback } from "react";
import { Shield, ShieldAlert, ShieldOff, ChevronDown, Activity } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PillToggle } from "@/components/ui/pill-toggle";
import { SubTabs } from "@/components/admin/sub-tabs";
import { formatRelativeDate } from "@/lib/utils";
import { api } from "@/lib/api";

type Tab = "list" | "activity" | "promote";

interface AdminUser {
  id: string; pseudo: string; name: string; role: "admin"|"super_admin";
  is_active: boolean; kyc_status: string; created_at: string;
  last_active: string|null; actions_30d: number;
}

const TABS = [
  { key: "list",     label: "👮 Liste des admins" },
  { key: "activity", label: "📈 Activité" },
  { key: "promote",  label: "⬆️ Promouvoir" },
];

export default function AdminsPage() {
  const [tab, setTab]       = useState<Tab>("list");
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingOn, setActingOn] = useState<string|null>(null);
  const [error, setError]   = useState<string|null>(null);
  const [expandedId, setExpandedId] = useState<string|null>(null);

  const load = useCallback(() => {
    api.get("/admin/admins").then(({ data }) => setAdmins(data || [])).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (id: string, action: "promote"|"demote"|"suspend"|"reactivate") => {
    setError(null); setActingOn(id);
    try {
      if (action === "promote")    await api.put(`/admin/users/${id}/role`, { role: "admin" });
      else if (action === "demote") await api.put(`/admin/admins/${id}/role`, { role: "USER" });
      else if (action === "suspend") {
        const r = prompt("Motif de suspension :"); if (!r) return;
        await api.post(`/admin/admins/${id}/suspend`, { reason: r });
      } else if (action === "reactivate") await api.post(`/admin/admins/${id}/reactivate`);
      load();
    } catch (err: any) { setError(err?.response?.data?.error || "Erreur."); }
    finally { setActingOn(null); }
  };

  const superAdmins    = admins.filter(a => a.["super_admin","root_admin"].includes(role));
  const regularAdmins  = admins.filter(a => a.role === "ADMIN");
  const totalActions   = admins.reduce((s, a) => s + a.actions_30d, 0);

  const AdminCard = ({ admin }: { admin: AdminUser }) => {
    const ex = expandedId === admin.id;
    const isSA = admin.["super_admin","root_admin"].includes(role);
    return (
      <Card className={!admin.is_active ? "opacity-60" : ""}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${isSA ? "bg-gold/20" : "bg-emerald/20"}`}>
                {isSA ? <Shield className="h-4 w-4 text-gold" /> : <ShieldAlert className="h-4 w-4 text-emerald" />}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-cream">@{admin.pseudo}</p>
                  <Badge variant={isSA ? "gold" : "emerald"}>{admin.role}</Badge>
                  {!admin.is_active && <Badge variant="coral">Suspendu</Badge>}
                </div>
                <p className="text-xs text-sage">
                  {admin.actions_30d} action{admin.actions_30d !== 1 ? "s" : ""} / 30j
                  {admin.last_active && ` · actif ${formatRelativeDate(admin.last_active)}`}
                </p>
              </div>
            </div>
            {!isSA && (
              <button onClick={() => setExpandedId(ex ? null : admin.id)} className="text-sage-muted hover:text-cream">
                <ChevronDown className={`h-4 w-4 transition-transform ${ex ? "rotate-180" : ""}`} />
              </button>
            )}
          </div>
          {ex && !isSA && (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-ink-line pt-4">
              <Button size="sm" variant="ghost" onClick={() => handleAction(admin.id, "demote")} disabled={actingOn !== null}>
                <ShieldOff className="h-3.5 w-3.5" />Rétrograder → USER
              </Button>
              {admin.is_active
                ? <Button size="sm" variant="danger" onClick={() => handleAction(admin.id, "suspend")} disabled={actingOn !== null}>Suspendre</Button>
                : <Button size="sm" onClick={() => handleAction(admin.id, "reactivate")} disabled={actingOn !== null}>Réactiver</Button>
              }
              <p className="w-full text-xs text-sage-muted">Créé le {new Date(admin.created_at).toLocaleDateString("fr-FR")}</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-medium text-cream">Gestion des admins</h1>
        <p className="mt-1 text-sm text-sage">Supervision et gestion des comptes administrateurs.</p>
      </div>
      <SubTabs tabs={TABS} active={tab} onChange={(k) => setTab(k as Tab)} />
      {error && <p className="text-sm text-brick">{error}</p>}

      {/* ── Liste ── */}
      {tab === "list" && (
        loading ? <p className="text-sm text-sage-muted">Chargement...</p> : (
          <div className="flex flex-col gap-4">
            {superAdmins.length > 0 && (
              <section>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-gold">
                  <Shield className="h-3.5 w-3.5" />Super Admins ({superAdmins.length})
                </h2>
                <div className="flex flex-col gap-2">{superAdmins.map(a => <AdminCard key={a.id} admin={a} />)}</div>
              </section>
            )}
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-sage-muted">
                <ShieldAlert className="h-3.5 w-3.5" />Admins ({regularAdmins.length})
              </h2>
              {regularAdmins.length === 0
                ? <div className="rounded-2xl border border-dashed border-ink-line px-6 py-12 text-center"><p className="text-sm text-sage">Aucun administrateur.</p></div>
                : <div className="flex flex-col gap-2">{regularAdmins.map(a => <AdminCard key={a.id} admin={a} />)}</div>
              }
            </section>
          </div>
        )
      )}

      {/* ── Activité ── */}
      {tab === "activity" && (
        loading ? <p className="text-sm text-sage-muted">Chargement...</p> : (
          <div className="flex flex-col gap-4">
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-sage">Total actions admin (30 derniers jours)</p>
                <p className="mt-1 font-display text-3xl font-medium text-cream">{totalActions}</p>
              </CardContent>
            </Card>
            <div className="flex flex-col gap-2">
              {[...admins].sort((a, b) => b.actions_30d - a.actions_30d).map(admin => (
                <Card key={admin.id}>
                  <CardContent className="flex items-center justify-between gap-3 p-4">
                    <div className="flex items-center gap-3">
                      <Activity className="h-4 w-4 text-sage-muted" />
                      <div>
                        <p className="font-medium text-cream">@{admin.pseudo}</p>
                        <p className="text-xs text-sage">{admin.role}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-lg font-medium text-cream">{admin.actions_30d}</p>
                      <p className="text-xs text-sage-muted">actions / 30j</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )
      )}

      {/* ── Promouvoir ── */}
      {tab === "promote" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-sage">Entrez l&apos;UUID d&apos;un utilisateur pour le promouvoir au rôle Admin ou le rétrograder.</p>
          <PromoteForm onDone={load} />
        </div>
      )}
    </div>
  );
}

function PromoteForm({ onDone }: { onDone: () => void }) {
  const [userId, setUserId] = useState("");
  const [role, setRole]     = useState<"ADMIN"|"USER">("ADMIN");
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string|null>(null);
  const [success, setSuccess] = useState<string|null>(null);

  const handle = async () => {
    if (!userId.trim()) return;
    setError(null); setSuccess(null); setLoading(true);
    try {
      const { data } = await api.put(`/admin/admins/${userId.trim()}/role`, { role });
      setSuccess(data.message); setUserId(""); onDone();
    } catch (err: any) { setError(err?.response?.data?.error || "Erreur."); }
    finally { setLoading(false); }
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <input type="text" placeholder="UUID de l&apos;utilisateur" value={userId} onChange={(e) => setUserId(e.target.value)}
          className="rounded-xl border border-ink-line bg-ink-raised px-3 py-2 text-sm text-cream placeholder:text-sage-muted focus:border-gold focus:outline-none" />
        <div className="flex gap-2">
          {(["ADMIN","USER"] as const).map(r => (
            <PillToggle key={r} active={role === r} onClick={() => setRole(r)}
              className="px-4 py-2 text-sm" inactiveClassName="bg-ink-raised">
              {r === "ADMIN" ? "→ Promouvoir Admin" : "→ Rétrograder USER"}
            </PillToggle>
          ))}
        </div>
        <Button onClick={handle} disabled={loading || !userId.trim()}>
          {loading ? "..." : "Appliquer"}
        </Button>
        {error && <p className="text-sm text-brick">{error}</p>}
        {success && <p className="text-sm text-emerald-bright">{success}</p>}
      </CardContent>
    </Card>
  );
}
