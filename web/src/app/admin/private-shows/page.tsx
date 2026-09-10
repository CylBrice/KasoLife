"use client";

// ============================================================
// KASOLIFE — Admin : Private Shows
// Onglets : Tarifs (floors platform_config) | Sessions | Stats
// ============================================================

import { useCallback, useEffect, useState } from "react";
import {
  MonitorPlay, Save, Check, Loader2, AlertTriangle,
  Crown, Eye, RefreshCw, PhoneOff, TrendingUp, Clock,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SubTabs } from "@/components/admin/sub-tabs";
import { api } from "@/lib/api";
import { formatFCFA, cn } from "@/lib/utils";

type Tab = "tarifs" | "sessions" | "stats";

const PACKAGES  = [15, 30, 45, 60] as const;
const SHOW_TYPES = ["STANDARD", "PREMIUM"] as const;

const CONFIG_KEYS = [
  "private_show_grace_period_seconds",
  "private_show_request_timeout_seconds",
  "private_show_spy_min_price_per_min_xcon",
  ...SHOW_TYPES.flatMap((t) => PACKAGES.map((m) => `private_show_floor_${t.toLowerCase()}_${m}min`)),
];

const TABS = [
  { key: "tarifs",   label: "Tarifs & Config" },
  { key: "sessions", label: "Sessions" },
  { key: "stats",    label: "Statistiques" },
];

// ── Helpers ──────────────────────────────────────────────────
const fmtDuration = (s: number) => {
  if (!s) return "—";
  const m = Math.floor(s / 60); const sec = s % 60;
  return `${m}m${sec > 0 ? ` ${sec}s` : ""}`;
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:    "border-emerald/40 text-emerald bg-emerald/10",
  ENDED:     "border-sage/40   text-sage   bg-sage/10",
  PENDING:   "border-gold/40   text-gold   bg-gold/10",
  CANCELLED: "border-brick/40  text-brick  bg-brick/10",
};

// ── Composant ligne config ────────────────────────────────────
function ConfigRow({ configKey, value, label, unit, onSave }: {
  configKey: string; value: string; label: string; unit?: string;
  onSave: (key: string, val: string) => Promise<void>;
}) {
  const [edit, setEdit]     = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const display = edit ?? value;
  const dirty   = edit !== undefined && edit !== value;

  const save = async () => {
    if (!dirty) return;
    setSaving(true);
    await onSave(configKey, edit!);
    setEdit(undefined); setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <p className="text-sm text-cream min-w-0 truncate">{label}</p>
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={display}
            onChange={(e) => setEdit(e.target.value)}
            className="w-24 rounded-xl border border-ink-line bg-ink px-2 py-1.5 text-center text-sm text-cream focus:outline-none focus:ring-1 focus:ring-gold/40"
          />
          {unit && <span className="text-xs text-sage-muted">{unit}</span>}
        </div>
        {dirty && (
          <Button size="sm" onClick={save} disabled={saving} className="h-7 px-2">
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          </Button>
        )}
        {saved && <Check className="h-4 w-4 text-emerald-bright" />}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// PAGE PRINCIPALE
// ════════════════════════════════════════════════════════════
export default function AdminPrivateShowsPage() {
  const [tab, setTab]           = useState<Tab>("tarifs");
  const [config, setConfig]     = useState<Record<string, string>>({});
  const [sessions, setSessions] = useState<any[]>([]);
  const [stats, setStats]       = useState<any>(null);
  const [loading, setLoading]   = useState(false);
  const [sessFilter, setSessFilter] = useState<string>("ALL");
  const [forcing, setForcing]   = useState<string | null>(null);

  // ── Charger platform_config ───────────────────────────────
  useEffect(() => {
    api.get("/admin/config").then(({ data }) => {
      const map: Record<string, string> = {};
      (data.config || []).forEach((c: any) => { map[c.key] = c.value; });
      setConfig(map);
    }).catch(() => {});
  }, []);

  // ── Charger sessions ──────────────────────────────────────
  const loadSessions = useCallback(() => {
    setLoading(true);
    const qs = sessFilter !== "ALL" ? `?status=${sessFilter}` : "";
    api.get(`/private-shows/admin/sessions${qs}`)
      .then(({ data }) => setSessions(data.sessions || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sessFilter]);

  // ── Charger stats ─────────────────────────────────────────
  const loadStats = useCallback(() => {
    api.get("/private-shows/admin/stats").then(({ data }) => setStats(data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (tab === "sessions") loadSessions();
    if (tab === "stats")    loadStats();
  }, [tab, loadSessions, loadStats]);

  // ── Sauvegarder une clé config ────────────────────────────
  const saveConfig = async (key: string, value: string) => {
    await api.put(`/admin/config/${key}`, { value });
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  // ── Forcer la fin d'un show ───────────────────────────────
  const forceEnd = async (showId: string) => {
    if (forcing) return;
    setForcing(showId);
    try {
      await api.post(`/private-shows/admin/${showId}/force-end`, { reason: "forced_by_admin" });
      setSessions((prev) => prev.map((s) => s.id === showId ? { ...s, status: "ENDED" } : s));
    } catch (err: any) {
      alert(err?.response?.data?.error || "Erreur");
    } finally {
      setForcing(null);
    }
  };

  // ════════════════════════════════════════════════════════════
  // ONGLET TARIFS
  // ════════════════════════════════════════════════════════════
  const renderTarifs = () => (
    <div className="space-y-5">
      {/* Paramètres généraux */}
      <Card>
        <CardContent className="p-4 divide-y divide-ink-line">
          <p className="pb-3 text-xs font-semibold uppercase tracking-widest text-sage">Paramètres généraux</p>
          <ConfigRow
            configKey="private_show_grace_period_seconds"
            value={config["private_show_grace_period_seconds"] || "300"}
            label="Durée de grâce (déconnexion créateur)"
            unit="sec"
            onSave={saveConfig}
          />
          <ConfigRow
            configKey="private_show_request_timeout_seconds"
            value={config["private_show_request_timeout_seconds"] || "600"}
            label="Timeout demande fan (pas de réponse créateur)"
            unit="sec"
            onSave={saveConfig}
          />
          <ConfigRow
            configKey="private_show_spy_min_price_per_min_xcon"
            value={config["private_show_spy_min_price_per_min_xcon"] || "200"}
            label="Prix minimum Spy"
            unit="XCon/min"
            onSave={saveConfig}
          />
        </CardContent>
      </Card>

      {/* Planchers par type */}
      {SHOW_TYPES.map((showType) => (
        <Card key={showType}>
          <CardContent className="p-4 divide-y divide-ink-line">
            <div className="flex items-center gap-2 pb-3">
              {showType === "PREMIUM"
                ? <Crown className="h-4 w-4 text-gold" />
                : <Eye className="h-4 w-4 text-sage" />
              }
              <p className="text-xs font-semibold uppercase tracking-widest text-sage">
                Planchers {showType === "PREMIUM" ? "Premium" : "Standard"}
              </p>
            </div>
            {PACKAGES.map((min) => {
              const key = `private_show_floor_${showType.toLowerCase()}_${min}min`;
              return (
                <ConfigRow
                  key={key}
                  configKey={key}
                  value={config[key] || "0"}
                  label={`Forfait ${min} min`}
                  unit="XCon"
                  onSave={saveConfig}
                />
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );

  // ════════════════════════════════════════════════════════════
  // ONGLET SESSIONS
  // ════════════════════════════════════════════════════════════
  const renderSessions = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {["ALL","ACTIVE","ENDED","PENDING","CANCELLED"].map((f) => (
          <button
            key={f}
            onClick={() => setSessFilter(f)}
            className={cn(
              "rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors",
              sessFilter === f
                ? "border-gold/60 bg-gold/10 text-gold"
                : "border-ink-line text-sage-muted hover:border-gold/30",
            )}
          >
            {f === "ALL" ? "Toutes" : f}
          </button>
        ))}
        <button onClick={loadSessions} className="ml-auto text-sage-muted hover:text-cream transition-colors">
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gold" />
        </div>
      )}

      {!loading && sessions.length === 0 && (
        <div className="rounded-2xl border border-dashed border-ink-line py-12 text-center">
          <MonitorPlay className="mx-auto mb-3 h-8 w-8 text-sage-muted" />
          <p className="text-sage-muted text-sm">Aucune session trouvée</p>
        </div>
      )}

      <div className="space-y-2">
        {sessions.map((s) => (
          <Card key={s.id}>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  {/* Participants */}
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-cream truncate">
                      {s.creator?.pseudo || "?"}
                    </span>
                    <span className="text-sage-muted">→</span>
                    <span className="text-cream truncate">{s.fan?.pseudo || "?"}</span>
                  </div>

                  {/* Badges type + statut */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                      STATUS_COLORS[s.status] || "border-ink-line text-sage",
                    )}>
                      {s.status}
                    </span>
                    <Badge variant={s.show_type === "PREMIUM" ? "gold" : "default"} className="flex items-center gap-1">
                      {s.show_type === "PREMIUM"
                        ? <><Crown className="h-2.5 w-2.5" />Premium</>
                        : <><Eye className="h-2.5 w-2.5" />Standard</>
                      }
                    </Badge>
                    <span className="text-[10px] text-sage-muted flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />{s.package_minutes} min
                    </span>
                  </div>

                  {/* Montants */}
                  <div className="flex flex-wrap gap-3 text-xs text-sage-muted">
                    <span>Payé : <span className="text-cream">{formatFCFA(s.price_xcon || 0)}</span></span>
                    {(s.refund_xcon ?? 0) > 0 && (
                      <span>Remb. : <span className="text-emerald">{formatFCFA(s.refund_xcon)}</span></span>
                    )}
                    {(s.commission_xcon ?? 0) > 0 && (
                      <span>Commission : <span className="text-gold">{formatFCFA(s.commission_xcon)}</span></span>
                    )}
                    {s.actual_duration_seconds > 0 && (
                      <span>Durée : {fmtDuration(s.actual_duration_seconds)}</span>
                    )}
                  </div>

                  <p className="text-[10px] text-sage-muted font-mono">
                    {new Date(s.created_at).toLocaleString("fr-FR")}
                    {s.reconnect_count > 0 && ` · ${s.reconnect_count} reconnexion(s)`}
                    {!s.ended_voluntarily && s.status === "ENDED" && " · fin non volontaire"}
                  </p>
                </div>

                {/* Action admin */}
                {s.status === "ACTIVE" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-brick/40 text-brick hover:bg-brick/10 shrink-0"
                    onClick={() => forceEnd(s.id)}
                    disabled={forcing === s.id}
                  >
                    {forcing === s.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <PhoneOff className="h-3.5 w-3.5" />
                    }
                    Forcer fin
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════
  // ONGLET STATS
  // ════════════════════════════════════════════════════════════
  const renderStats = () => (
    <div className="space-y-4">
      {!stats ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gold" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card>
              <CardContent className="p-5 text-center">
                <MonitorPlay className="mx-auto mb-2 h-6 w-6 text-emerald" />
                <p className="font-display text-3xl font-bold text-cream">{stats.active_count}</p>
                <p className="mt-1 text-xs text-sage-muted">Shows actifs en ce moment</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 text-center">
                <Clock className="mx-auto mb-2 h-6 w-6 text-sage" />
                <p className="font-display text-3xl font-bold text-cream">{stats.ended_count}</p>
                <p className="mt-1 text-xs text-sage-muted">Sessions terminées</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 text-center">
                <TrendingUp className="mx-auto mb-2 h-6 w-6 text-gold" />
                <p className="font-display text-2xl font-bold text-gold">
                  {formatFCFA(stats.total_revenue || 0)}
                </p>
                <p className="mt-1 text-xs text-sage-muted">Revenus plateforme totaux</p>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-center mt-2">
            <button
              onClick={loadStats}
              className="flex items-center gap-1.5 text-xs text-sage-muted hover:text-cream transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Actualiser
            </button>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
      <div className="flex items-center gap-3">
        <MonitorPlay className="h-6 w-6 text-gold" />
        <h1 className="font-display text-2xl font-medium text-cream">Private Shows</h1>
      </div>

      <SubTabs
        tabs={TABS}
        activeKey={tab}
        onSelect={(k) => setTab(k as Tab)}
      />

      {tab === "tarifs"   && renderTarifs()}
      {tab === "sessions" && renderSessions()}
      {tab === "stats"    && renderStats()}
    </div>
  );
}
