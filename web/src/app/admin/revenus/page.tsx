"use client";

import { useEffect, useState } from "react";
import { TrendingUp, ArrowUpRight, BarChart3, Vault, Radio, RefreshCw, Plus, Minus } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubTabs } from "@/components/admin/sub-tabs";
import { Button } from "@/components/ui/button";
import { fmtNum, formatFCFA } from "@/lib/utils";
import { api } from "@/lib/api";

type Tab = "overview" | "detail" | "period" | "coffre" | "canaux";
type Period = "day" | "week" | "month" | "year";

const PERIOD_LABELS: Record<Period, string> = {
  day: "Aujourd'hui", week: "7 jours", month: "30 jours", year: "12 mois",
};
const SOURCE_LABELS: Record<string, string> = {
  COMMISSION_ABONNEMENT: "Abonnements", COMMISSION_TIP: "Pourboires",
  COMMISSION_PPV: "Contenu PPV", COMMISSION_RETRAIT: "Retraits",
};
const SOURCE_COLORS: Record<string, string> = {
  COMMISSION_ABONNEMENT: "#E8A33D", COMMISSION_TIP: "#1E7A5F",
  COMMISSION_PPV: "#F0664C", COMMISSION_RETRAIT: "#6366F1",
};
const GATEWAY_NAMES = ["cinetpay", "campay", "fapshi"];

export default function FinancesPage() {
  const [tab, setTab]       = useState<Tab>("overview");
  const [period, setPeriod] = useState<Period>("month");
  const [data, setData]     = useState<any>(null);
  const [loading, setLoading] = useState(true);

  /* Coffre */
  const [vaultBalance,  setVaultBalance]  = useState<any>(null);
  const [vaultAccounts, setVaultAccounts] = useState<any[]>([]);
  const [vaultHistory,  setVaultHistory]  = useState<any[]>([]);
  const [vaultLoading,  setVaultLoading]  = useState(false);
  const [vaultModal,    setVaultModal]    = useState<"deposit" | "withdraw" | null>(null);
  const [vaultAmt,      setVaultAmt]      = useState("");
  const [vaultAccId,    setVaultAccId]    = useState("");

  /* Canaux */
  const [canauxData,    setCanauxData]    = useState<any>(null);
  const [canauxPeriod,  setCanauxPeriod]  = useState<Period>("day");
  const [canauxLoading, setCanauxLoading] = useState(false);

  /* Revenue */
  useEffect(() => {
    setLoading(true);
    api.get(`/admin/revenue?period=${period}`)
      .then(({ data: d }) => setData(d))
      .finally(() => setLoading(false));
  }, [period]);

  const loadVault = async () => {
    setVaultLoading(true);
    try {
      const [bal, acc, hist] = await Promise.all([
        api.get("/admin/vault/balance"),
        api.get("/admin/vault/accounts"),
        api.get("/admin/vault/history?limit=20"),
      ]);
      setVaultBalance(bal.data);
      setVaultAccounts(acc.data || []);
      setVaultHistory(hist.data || []);
    } catch { }
    finally { setVaultLoading(false); }
  };

  const loadCanaux = async () => {
    setCanauxLoading(true);
    try {
      const { data: d } = await api.get(`/admin/canaux?period=${canauxPeriod}`);
      setCanauxData(d);
    } catch { }
    finally { setCanauxLoading(false); }
  };

  useEffect(() => {
    if (tab === "coffre" && !vaultBalance) loadVault();
    if (tab === "canaux" && !canauxData)   loadCanaux();
  }, [tab]);

  const handleVaultOp = async (type: "deposit" | "withdraw") => {
    if (!vaultAmt || !vaultAccId) return;
    try {
      await api.post(`/admin/vault/${type}`, { amount_xcon: Number(vaultAmt), account_id: vaultAccId });
      setVaultModal(null); setVaultAmt(""); setVaultAccId("");
      loadVault();
    } catch (err: any) { alert(err?.response?.data?.error || "Erreur."); }
  };

  const TABS = [
    { key: "overview", label: "📊 Vue d'ensemble" },
    { key: "detail",   label: "📋 Détail sources" },
    { key: "period",   label: "📅 Par période" },
    { key: "coffre",   label: "🏦 Coffre" },
    { key: "canaux",   label: "📡 Canaux" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium text-cream">Finances</h1>
          <p className="mt-1 text-sm text-sage">Revenus, trésorerie et canaux de paiement.</p>
        </div>
        {["overview", "detail", "period"].includes(tab) && (
          <div className="flex rounded-xl border border-ink-line/50 bg-ink-raised p-1 gap-1">
            {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${period === p ? "bg-gold text-ink" : "text-sage hover:text-cream"}`}>
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
        )}
      </div>

      <SubTabs tabs={TABS} active={tab} onChange={(k) => setTab(k as Tab)} />

      {loading && ["overview", "detail", "period"].includes(tab) && (
        <p className="text-sm text-sage-muted">Chargement...</p>
      )}

      {/* ── Vue d'ensemble ── */}
      {tab === "overview" && !loading && data && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold/20">
                <TrendingUp className="h-6 w-6 text-gold" />
              </div>
              <div>
                <p className="text-sm text-sage">Total — {PERIOD_LABELS[period]}</p>
                <p className="font-display text-3xl font-medium text-cream">{formatFCFA(data.total_xcon)}</p>
              </div>
            </CardContent>
          </Card>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(data.breakdown as Record<string, number>).map(([source, amount]) => (
              <Card key={source}>
                <CardContent className="p-4">
                  <div className="mb-2 h-1 w-8 rounded-full" style={{ backgroundColor: SOURCE_COLORS[source] || "#E8A33D" }} />
                  <p className="text-lg font-medium text-cream">{formatFCFA(amount)}</p>
                  <p className="text-xs text-sage">{SOURCE_LABELS[source] || source}</p>
                  {data.total_xcon > 0 && (
                    <p className="mt-1 text-xs text-sage-muted">{Math.round((amount / data.total_xcon) * 100)}%</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── Détail sources ── */}
      {tab === "detail" && !loading && data && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ArrowUpRight className="h-4 w-4 text-gold" />Répartition par source</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-4">
              {(data.topSources || Object.entries(data.breakdown).map(([s, a]: any) => ({
                source: s, amount_xcon: a,
                pct: data.total_xcon > 0 ? Math.round(a / data.total_xcon * 100) : 0,
              }))).map((s: any) => (
                <div key={s.source}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm text-cream">{SOURCE_LABELS[s.source] || s.source}</span>
                    <span className="text-sm font-medium text-cream">
                      {formatFCFA(s.amount_xcon)} <span className="text-xs text-sage">{s.pct}%</span>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-ink-line">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${s.pct}%`, backgroundColor: SOURCE_COLORS[s.source] || "#E8A33D" }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Par période ── */}
      {tab === "period" && !loading && data && (
        <div className="flex flex-col gap-4">
          {data.dailyCurve?.length > 1 ? (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-gold" />Revenus par jour</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.dailyCurve} margin={{ left: 0, right: 0 }}>
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={(d) => d.slice(5)} />
                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={(v) => `${fmtNum(v / 1000)}k`} width={40} />
                    <Tooltip
                      formatter={(value: any) => [formatFCFA(Number(value)), "Revenus"]}
                      labelStyle={{ color: "#E8D5B7" }}
                      contentStyle={{ backgroundColor: "#0E1F1B", border: "1px solid #1E3830" }}
                    />
                    <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                      {data.dailyCurve.map((_: any, i: number) => <Cell key={i} fill="#E8A33D" fillOpacity={0.8} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ) : (
            <p className="py-12 text-center text-sm text-sage-muted">Pas assez de données pour afficher la courbe.</p>
          )}
        </div>
      )}

      {/* ── Coffre ── */}
      {tab === "coffre" && (
        <div className="flex flex-col gap-4">
          {vaultLoading ? <p className="text-sm text-sage-muted">Chargement...</p> : (
            <>
              {/* Solde */}
              <Card className="border-gold/30">
                <CardContent className="flex items-center justify-between gap-4 p-6 flex-wrap">
                  <div>
                    <p className="text-xs text-sage-muted uppercase tracking-wider mb-1">Solde Coffre</p>
                    <p className="font-display text-4xl font-medium text-gold-bright">
                      {formatFCFA(vaultBalance?.balance_xcon ?? 0)}
                    </p>
                    <p className={`mt-2 text-xs font-medium ${(vaultBalance?.balance_xcon ?? 0) >= 150000 ? "text-emerald-bright" : "text-brick"}`}>
                      {(vaultBalance?.balance_xcon ?? 0) >= 150000
                        ? "✅ Réserve minimum OK (150 000 FCFA)"
                        : "⚠️ Réserve minimum insuffisante !"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => setVaultModal("deposit")} variant="success">
                      <Plus className="h-4 w-4" /> Recharger
                    </Button>
                    <Button onClick={() => setVaultModal("withdraw")} variant="danger">
                      <Minus className="h-4 w-4" /> Retirer
                    </Button>
                    <Button variant="secondary" onClick={loadVault}>
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Comptes Mobile Money */}
              <Card>
                <CardContent className="p-5">
                  <p className="mb-3 text-sm font-medium text-cream">Comptes Mobile Money</p>
                  {vaultAccounts.length === 0 ? (
                    <p className="text-sm text-sage-muted text-center py-6">Aucun compte enregistré.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {vaultAccounts.map((acc: any) => (
                        <div key={acc.id} className="flex items-center justify-between rounded-lg border border-ink-line/50 bg-ink-raised px-4 py-2.5">
                          <div>
                            <p className="text-sm font-medium text-cream">{acc.name}</p>
                            <p className="text-xs text-sage-muted">{acc.phone} · {acc.operator}</p>
                          </div>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${acc.operator === "MTN" ? "bg-gold/15 text-gold-bright" : "bg-coral/15 text-coral"}`}>
                            {acc.operator}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Historique */}
              <Card>
                <CardContent className="p-5">
                  <p className="mb-3 text-sm font-medium text-cream">Historique des opérations</p>
                  {vaultHistory.length === 0 ? (
                    <p className="text-sm text-sage-muted text-center py-6">Aucune opération enregistrée.</p>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {vaultHistory.map((op: any, i: number) => (
                        <div key={i} className="flex items-center justify-between py-2 border-b border-ink-line/30 text-sm last:border-0">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${op.type === "INJECTION" ? "bg-emerald/20 text-emerald-bright" : "bg-coral/20 text-coral"}`}>
                              {op.type === "INJECTION" ? "+" : "-"}
                            </span>
                            <span className="text-sage-muted">{op.account_name || "—"}</span>
                          </div>
                          <span className={`font-mono font-medium ${op.type === "INJECTION" ? "text-emerald-bright" : "text-coral"}`}>
                            {op.type === "INJECTION" ? "+" : "-"}{formatFCFA(op.amount_xcon)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {/* Modal dépôt/retrait simplifié */}
          {vaultModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setVaultModal(null)}>
              <div className="w-full max-w-sm rounded-2xl border border-ink-line bg-ink-surface p-6" onClick={(e) => e.stopPropagation()}>
                <h3 className="mb-4 font-display text-lg font-medium text-cream">
                  {vaultModal === "deposit" ? "➕ Recharger le Coffre" : "➖ Retirer du Coffre"}
                </h3>
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-sage">Montant (FCFA)</label>
                    <input type="number" min="1" value={vaultAmt} onChange={(e) => setVaultAmt(e.target.value)}
                      className="h-11 w-full rounded-xl border border-ink-line bg-ink-raised px-4 text-sm text-cream focus:border-gold focus:outline-none"
                      placeholder="Ex : 50 000" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-sage">Compte Mobile Money</label>
                    <select value={vaultAccId} onChange={(e) => setVaultAccId(e.target.value)}
                      className="h-11 w-full rounded-xl border border-ink-line bg-ink-raised px-4 text-sm text-cream focus:border-gold focus:outline-none">
                      <option value="">Sélectionner un compte...</option>
                      {vaultAccounts.map((acc: any) => (
                        <option key={acc.id} value={acc.id}>{acc.name} · {acc.phone} ({acc.operator})</option>
                      ))}
                    </select>
                  </div>
                  <div className="mt-2 flex gap-3">
                    <Button variant="secondary" className="flex-1" onClick={() => setVaultModal(null)}>Annuler</Button>
                    <Button
                      className="flex-1"
                      variant={vaultModal === "deposit" ? "success" : "danger"}
                      disabled={!vaultAmt || !vaultAccId}
                      onClick={() => handleVaultOp(vaultModal)}
                    >
                      Confirmer
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Canaux ── */}
      {tab === "canaux" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex rounded-xl border border-ink-line/50 bg-ink-raised p-1 gap-1">
              {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
                <button key={p} onClick={() => { setCanauxPeriod(p); setTimeout(loadCanaux, 50); }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${canauxPeriod === p ? "bg-gold text-ink" : "text-sage hover:text-cream"}`}>
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
            <Button size="sm" variant="secondary" onClick={loadCanaux} disabled={canauxLoading}>
              <RefreshCw className={`h-3.5 w-3.5 ${canauxLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {canauxLoading ? <p className="text-sm text-sage-muted">Chargement...</p> : (
            <>
              {/* Podium */}
              <div className="grid grid-cols-3 gap-3">
                {(canauxData?.podium || GATEWAY_NAMES.map((n) => ({ name: n, taux: 0 }))).map((p: any, i: number) => (
                  <Card key={i} className={i === 0 ? "border-gold/40" : ""}>
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl">{["🥇", "🥈", "🥉"][i]}</p>
                      <p className="mt-1 text-sm font-medium text-cream capitalize">{p.name}</p>
                      <p className="mt-1 font-mono text-xl text-emerald-bright">{p.taux}%</p>
                      <p className="text-[10px] text-sage-muted">Taux réussite</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Statuts détaillés */}
              {GATEWAY_NAMES.map((name) => {
                const s = canauxData?.statuts?.[name] || { disponible: true, charge: 0, latency: 0 };
                const stats = canauxData?.stats?.[name] || {};
                return (
                  <Card key={name}>
                    <CardContent className="p-5">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="font-medium text-cream capitalize">{name}</p>
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${s.disponible ? "bg-emerald/15 text-emerald-bright" : "bg-coral/15 text-coral"}`}>
                          {s.disponible ? "🟢 Actif" : "🔴 Indisponible"}
                        </span>
                      </div>
                      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-ink-line">
                        <div className="h-full rounded-full bg-gold" style={{ width: `${s.charge || 0}%` }} />
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        {[
                          ["Taux réussite", `${stats.taux_reussite || 0}%`],
                          ["Transactions",  fmtNum(stats.total || 0)],
                          ["Volume",        formatFCFA(stats.volume || 0)],
                          ["Charge",        `${s.charge || 0}%`],
                          ["Latence",       `${s.latency || 0} ms`],
                          ["Commissions",   formatFCFA(stats.commission || 0)],
                        ].map(([label, value]) => (
                          <div key={label} className="rounded-lg bg-ink-raised p-2">
                            <p className="text-sage-muted">{label}</p>
                            <p className="mt-0.5 font-mono font-medium text-cream">{value}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
