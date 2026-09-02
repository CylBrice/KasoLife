"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Ban, RotateCcw, Shield, ShieldOff, Wallet,
  FileText, Heart, User, AlertTriangle,
} from "lucide-react";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SubTabs } from "@/components/admin/sub-tabs";
import { fmtNum, formatFCFA, formatRelativeDate } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { api } from "@/lib/api";

type Tab = "profile" | "wallet" | "transactions";

const ROLE_COLORS: Record<string, string> = {
  root_admin:  "bg-red-500/15 text-red-400 border border-red-500/30",
  super_admin: "bg-gold/15 text-gold-bright border border-gold/30",
  admin:       "bg-amber-500/15 text-amber-400 border border-amber-500/30",
  influencer:  "bg-emerald/15 text-emerald-bright border border-emerald/30",
  user:        "bg-ink-raised text-sage border border-ink-line",
};

const KYC_VARIANT: Record<string, "emerald" | "gold" | "coral" | "default"> = {
  VERIFIED: "emerald", PENDING: "gold", FAILED: "coral", SUPPORT: "coral",
};

const TX_COLORS: Record<string, string> = {
  DEPOT:              "text-emerald-bright",
  RETRAIT:            "text-coral",
  ABONNEMENT:         "text-blue-400",
  COMMISSION:         "text-gold-bright",
  TIP:                "text-pink-400",
  PPV:                "text-purple-400",
  BONUS_PARRAINAGE:   "text-teal-400",
  REMBOURSEMENT:      "text-amber-400",
};

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const { user: me } = useAuth();
  const isSuperAdmin = ["super_admin", "root_admin"].includes(me?.role ?? "");

  const [tab, setTab]           = useState<Tab>("profile");
  const [user, setUser]         = useState<any>(null);
  const [wallet, setWallet]     = useState<any>(null);
  const [transactions, setTxs]  = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [acting, setActing]     = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, w] = await Promise.all([
        api.get(`/admin/users/${id}`),
        api.get(`/admin/users/${id}/wallet`).catch(() => ({ data: null })),
      ]);
      setUser(u.data);
      setWallet(w.data);
    } catch { setError("Utilisateur introuvable."); }
    finally { setLoading(false); }
  }, [id]);

  const loadTxs = useCallback(async () => {
    try {
      const { data } = await api.get(`/admin/users/${id}/transactions?limit=50`);
      setTxs(data || []);
    } catch { setTxs([]); }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (tab === "transactions") loadTxs(); }, [tab, loadTxs]);

  const handleSuspend = async () => {
    const reason = prompt("Motif de suspension :");
    if (!reason) return;
    setError(null); setActing(true);
    try { await api.post(`/admin/users/${id}/suspend`, { reason }); load(); }
    catch (err: any) { setError(err?.response?.data?.error || "Erreur."); }
    finally { setActing(false); }
  };

  const handleReactivate = async () => {
    setError(null); setActing(true);
    try { await api.put(`/admin/users/${id}/reactivate`); load(); }
    catch (err: any) { setError(err?.response?.data?.error || "Erreur."); }
    finally { setActing(false); }
  };

  const handleRoleChange = async (newRole: string) => {
    if (!confirm(`Changer le rôle vers "${newRole}" ?`)) return;
    setError(null); setActing(true);
    try { await api.put(`/admin/users/${id}/role`, { role: newRole }); load(); }
    catch (err: any) { setError(err?.response?.data?.error || "Erreur."); }
    finally { setActing(false); }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-sage hover:text-cream transition-colors">
          <ArrowLeft className="h-4 w-4" /> Retour
        </button>
        <div className="flex flex-col gap-3">
          {[1,2,3].map(i => <div key={i} className="h-24 animate-pulse rounded-2xl bg-ink-raised" />)}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col gap-6">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-sage hover:text-cream">
          <ArrowLeft className="h-4 w-4" /> Retour
        </button>
        <div className="rounded-2xl border border-dashed border-ink-line px-6 py-16 text-center">
          <p className="text-brick">{error || "Utilisateur introuvable."}</p>
        </div>
      </div>
    );
  }

  const AVAILABLE_ROLES = ["user", "influencer", ...(isSuperAdmin ? ["admin", "super_admin"] : [])];

  return (
    <div className="flex flex-col gap-6">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="rounded-lg p-2 text-sage hover:bg-ink-raised hover:text-cream transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex flex-1 items-center gap-3">
          <UserAvatar src={user.avatar_url} pseudo={user.pseudo} name={user.name} size="lg" />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display text-xl font-medium text-cream">@{user.pseudo}</h1>
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${ROLE_COLORS[user.role] || ROLE_COLORS.user}`}>
                {user.role}
              </span>
              <Badge variant={KYC_VARIANT[user.kyc_status] || "default"}>{user.kyc_status}</Badge>
              {!user.is_active && <Badge variant="coral">Suspendu</Badge>}
            </div>
            <p className="text-sm text-sage">{user.name} · {user.country_iso} · Inscrit {formatRelativeDate(user.created_at)}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-brick/30 bg-brick/10 px-4 py-3 text-sm text-brick">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {/* Actions rapides */}
      <div className="flex flex-wrap gap-2">
        {user.is_active
          ? <Button size="sm" variant="danger" onClick={handleSuspend} disabled={acting}>
              <Ban className="h-3.5 w-3.5" /> Suspendre
            </Button>
          : <Button size="sm" onClick={handleReactivate} disabled={acting}>
              <RotateCcw className="h-3.5 w-3.5" /> Réactiver
            </Button>
        }
        {AVAILABLE_ROLES.filter(r => r !== user.role).map(r => (
          <Button key={r} size="sm" variant="secondary" onClick={() => handleRoleChange(r)} disabled={acting}>
            <Shield className="h-3.5 w-3.5" /> → {r}
          </Button>
        ))}
      </div>

      <SubTabs tabs={[
        { key: "profile",      label: "👤 Profil" },
        { key: "wallet",       label: "💰 Portefeuille" },
        { key: "transactions", label: "📋 Transactions" },
      ]} active={tab} onChange={(k) => setTab(k as Tab)} />

      {/* ── Profil ── */}
      {tab === "profile" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><User className="h-4 w-4 text-sage-muted" />Informations</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              {[
                ["UUID",        user.id],
                ["Nom",         user.name || "—"],
                ["Pseudo",      "@" + user.pseudo],
                ["Téléphone",   user.phone || "—"],
                ["Email",       user.email || "—"],
                ["Pays",        user.country_iso],
                ["Langue",      user.language],
                ["Naissance",   user.birth_date ? new Date(user.birth_date).toLocaleDateString("fr-FR") : "—"],
                ["Inscrit",     new Date(user.created_at).toLocaleString("fr-FR")],
                ["2FA",         user.twofa_enabled ? "✅ Activé" : "❌ Désactivé"],
                ["Email conf.", user.email_confirmed ? "✅ Oui" : "❌ Non"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-2 border-b border-ink-line/30 py-1.5 last:border-0">
                  <span className="shrink-0 text-sage-muted">{label}</span>
                  <span className="break-all text-right font-mono text-xs text-cream">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4">
            {user.creator_profile && (
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Heart className="h-4 w-4 text-sage-muted" />Profil créateur</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ["Nom affiché",   user.creator_profile.display_name],
                    ["Abonnés",       fmtNum(user.creator_profile.subscribers_count || 0)],
                    ["Publications",  fmtNum(user.creator_profile.posts_count || 0)],
                    ["Prix abo.",     formatFCFA(user.creator_profile.subscription_price_xcon || 0)],
                    ["Badge vérifié", user.creator_profile.is_verified_badge ? "✅" : "—"],
                    ["Catégorie",     user.creator_profile.category?.name || "—"],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg bg-ink-raised p-3">
                      <p className="text-[10px] text-sage-muted uppercase tracking-wider">{label}</p>
                      <p className="mt-1 font-medium text-cream">{value}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-4 w-4 text-sage-muted" />Activité</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ["Tentatives KYC", fmtNum(user.kyc_attempts || 0)],
                  ["Statut KYC",     user.kyc_status],
                  ["Rôle",          user.role],
                  ["Statut",        user.is_active ? "Actif" : "Suspendu"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-ink-raised p-3">
                    <p className="text-[10px] text-sage-muted uppercase tracking-wider">{label}</p>
                    <p className="mt-1 font-medium text-cream">{value}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── Portefeuille ── */}
      {tab === "wallet" && (
        <div className="flex flex-col gap-4">
          {!wallet ? (
            <div className="rounded-2xl border border-dashed border-ink-line px-6 py-12 text-center">
              <Wallet className="mx-auto h-8 w-8 text-sage-muted" />
              <p className="mt-2 text-sm text-sage-muted">Aucun wallet trouvé.</p>
            </div>
          ) : (
            <>
              <Card className="border-l-4 border-l-emerald-400">
                <CardContent className="p-6">
                  <p className="text-xs text-sage-muted uppercase tracking-wider">Solde disponible</p>
                  <p className="mt-1 font-display text-3xl font-medium text-emerald-bright">
                    {formatFCFA(wallet.balance_xcon || 0)}
                  </p>
                  {wallet.pending_balance_xcon > 0 && (
                    <p className="mt-1 text-sm text-sage">
                      + {formatFCFA(wallet.pending_balance_xcon)} en attente
                    </p>
                  )}
                </CardContent>
              </Card>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {[
                  ["Total déposé",   wallet.total_deposited,  "border-l-blue-400"],
                  ["Total retiré",   wallet.total_withdrawn,  "border-l-coral"],
                  ["Total gagné",    wallet.total_earned,     "border-l-gold"],
                ].map(([label, value, border]) => (
                  <Card key={label as string} className={`border-l-4 ${border}`}>
                    <CardContent className="p-4">
                      <p className="text-xs text-sage-muted">{label}</p>
                      <p className="mt-1 font-mono text-lg font-medium text-cream">{formatFCFA(value as number || 0)}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Transactions ── */}
      {tab === "transactions" && (
        <div className="flex flex-col gap-2">
          {transactions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-ink-line px-6 py-12 text-center">
              <p className="text-sm text-sage-muted">Aucune transaction.</p>
            </div>
          ) : transactions.map((tx: any) => (
            <Card key={tx.id}>
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${TX_COLORS[tx.type] || "text-cream"}`}>{tx.type}</span>
                  </div>
                  {tx.description && <p className="mt-0.5 truncate text-xs text-sage">{tx.description}</p>}
                  <p className="text-xs text-sage-muted">{formatRelativeDate(tx.created_at)}</p>
                </div>
                <div className="text-right">
                  <p className={`font-mono font-medium ${(tx.amount_xcon || 0) >= 0 ? "text-emerald-bright" : "text-coral"}`}>
                    {(tx.amount_xcon || 0) >= 0 ? "+" : ""}{formatFCFA(tx.amount_xcon || 0)}
                  </p>
                  <p className="text-xs text-sage-muted">→ {formatFCFA(tx.balance_after || 0)}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
