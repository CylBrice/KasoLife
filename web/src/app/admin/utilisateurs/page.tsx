"use client";

import { useEffect, useState, useCallback } from "react";
import { Search, Ban, RotateCcw, ShieldCheck, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SubTabs } from "@/components/admin/sub-tabs";
import { api } from "@/lib/api";
import type { AdminUser } from "@/types";

type Tab = "list" | "kyc" | "suspended";

const ROLE_VARIANT: Record<string, "gold" | "emerald" | "default"> = {
  SUPERADMIN: "gold", ADMIN: "gold", CREATOR: "emerald", USER: "default",
};
const KYC_VARIANT: Record<string, "gold" | "emerald" | "default" | "coral"> = {
  VERIFIED: "emerald", PENDING: "gold", FAILED: "coral", SUPPORT: "coral",
};

export default function AdminUtilisateursPage() {
  const [tab, setTab] = useState<Tab>("list");
  const [users, setUsers]     = useState<AdminUser[]>([]);
  const [kycUsers, setKyc]    = useState<any[]>([]);
  const [suspended, setSusp]  = useState<any[]>([]);
  const [search, setSearch]   = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const loadList = useCallback((q?: string) => {
    setLoading(true);
    api.get("/admin/users", { params: q ? { search: q, limit: 50 } : { limit: 50 } })
      .then(({ data }) => setUsers(data.users || data || []))
      .finally(() => setLoading(false));
  }, []);

  const loadKyc = useCallback(() => {
    setLoading(true);
    api.get("/admin/kyc/pending").then(({ data }) => setKyc(data || [])).finally(() => setLoading(false));
  }, []);

  const loadSuspended = useCallback(() => {
    setLoading(true);
    api.get("/admin/users/suspended").then(({ data }) => setSusp(data || [])).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (tab === "list")      loadList();
    if (tab === "kyc")       loadKyc();
    if (tab === "suspended") loadSuspended();
  }, [tab]);

  const handleSearch = () => loadList(search);

  const handleSuspend = async (id: string) => {
    const reason = prompt("Motif de suspension :");
    if (!reason) return;
    setError(null);
    try {
      await api.post(`/admin/users/${id}/suspend`, { reason });
      loadList(search);
    } catch (err: any) { setError(err?.response?.data?.error || "Erreur."); }
  };

  const handleReactivate = async (id: string) => {
    setError(null);
    try {
      await api.put(`/admin/users/${id}/reactivate`);
      if (tab === "suspended") loadSuspended(); else loadList(search);
    } catch (err: any) { setError(err?.response?.data?.error || "Erreur."); }
  };

  const handleKycValidate = async (userId: string) => {
    try { await api.post(`/admin/kyc/${userId}/validate`); loadKyc(); }
    catch (err: any) { setError(err?.response?.data?.error || "Erreur."); }
  };

  const handleKycReject = async (userId: string) => {
    const reason = prompt("Motif du rejet KYC :");
    if (!reason) return;
    try { await api.post(`/admin/kyc/${userId}/reject`, { reason }); loadKyc(); }
    catch (err: any) { setError(err?.response?.data?.error || "Erreur."); }
  };

  const TABS = [
    { key: "list",      label: "👥 Utilisateurs" },
    { key: "kyc",       label: "🪪 KYC en attente", badge: kycUsers.length },
    { key: "suspended", label: "🚫 Suspendus",       badge: suspended.length },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-medium text-cream">Utilisateurs</h1>
        <p className="mt-1 text-sm text-sage">Gestion des comptes utilisateurs.</p>
      </div>
      <SubTabs tabs={TABS} active={tab} onChange={(k) => setTab(k as Tab)} />

      {error && <p className="text-sm text-brick">{error}</p>}

      {/* ── Liste ── */}
      {tab === "list" && (
        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sage-muted" />
              <input
                className="h-10 w-full rounded-xl border border-ink-line bg-ink-raised pl-9 pr-3 text-sm text-cream placeholder:text-sage-muted focus:border-gold focus:outline-none"
                placeholder="Rechercher par pseudo, téléphone…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch}>Rechercher</Button>
          </div>
          {loading ? <p className="text-sm text-sage-muted">Chargement...</p> : (
            <div className="flex flex-col gap-2">
              {users.map((user) => (
                <Card key={user.id}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-cream">@{user.pseudo}</span>
                        <Badge variant={ROLE_VARIANT[user.role] || "default"}>{user.role}</Badge>
                        <Badge variant={KYC_VARIANT[user.kyc_status] || "default"}>{user.kyc_status}</Badge>
                        {!user.is_active && <Badge variant="coral">Suspendu</Badge>}
                      </div>
                      <p className="text-xs text-sage-muted">{user.country_iso} · {new Date(user.created_at).toLocaleDateString("fr-FR")}</p>
                    </div>
                    <div className="flex gap-2">
                      {user.is_active
                        ? <Button size="sm" variant="danger" onClick={() => handleSuspend(user.id)}><Ban className="h-3.5 w-3.5" /> Suspendre</Button>
                        : <Button size="sm" onClick={() => handleReactivate(user.id)}><RotateCcw className="h-3.5 w-3.5" /> Réactiver</Button>
                      }
                    </div>
                  </CardContent>
                </Card>
              ))}
              {users.length === 0 && !loading && <p className="text-sm text-sage-muted text-center py-8">Aucun résultat.</p>}
            </div>
          )}
        </div>
      )}

      {/* ── KYC en attente ── */}
      {tab === "kyc" && (
        <div className="flex flex-col gap-3">
          {loading ? <p className="text-sm text-sage-muted">Chargement...</p> :
           kycUsers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-ink-line px-6 py-16 text-center">
              <ShieldCheck className="mx-auto h-8 w-8 text-emerald" />
              <p className="mt-2 font-display text-lg text-cream">Aucune vérification en attente</p>
            </div>
          ) : kycUsers.map((u) => (
            <Card key={u.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium text-cream">@{u.pseudo} — {u.name}</p>
                  <p className="text-xs text-sage-muted">{u.country_iso} · {new Date(u.created_at).toLocaleDateString("fr-FR")}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleKycValidate(u.id)}>
                    <ShieldCheck className="h-3.5 w-3.5" /> Valider
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => handleKycReject(u.id)}>
                    <ShieldAlert className="h-3.5 w-3.5" /> Rejeter
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Suspendus ── */}
      {tab === "suspended" && (
        <div className="flex flex-col gap-3">
          {loading ? <p className="text-sm text-sage-muted">Chargement...</p> :
           suspended.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-ink-line px-6 py-16 text-center">
              <p className="font-display text-lg text-cream">Aucun compte suspendu</p>
            </div>
          ) : suspended.map((u) => (
            <Card key={u.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium text-cream">@{u.pseudo}</p>
                  {u.suspension_reason && <p className="mt-0.5 text-xs text-brick">Motif : {u.suspension_reason}</p>}
                  <p className="text-xs text-sage-muted">
                    Suspendu le {u.suspended_at ? new Date(u.suspended_at).toLocaleDateString("fr-FR") : "—"}
                  </p>
                </div>
                <Button size="sm" onClick={() => handleReactivate(u.id)}>
                  <RotateCcw className="h-3.5 w-3.5" /> Réactiver
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
