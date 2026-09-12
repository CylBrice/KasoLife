"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import {
  Gift, Save, Check, AlertTriangle, ChevronRight,
  ToggleLeft, ToggleRight, RefreshCw, BadgeCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AmountInput } from "@/components/ui/amount-input";
import { formatFCFA, formatRelativeDate } from "@/lib/utils";
import { api } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────
interface BonusConfig {
  bonus_welcome_enabled:          boolean;
  bonus_welcome_threshold_1_xcon: number;
  bonus_welcome_amount_1_xcon:    number;
  bonus_welcome_threshold_2_xcon: number;
  bonus_welcome_amount_2_xcon:    number;
  bonus_welcome_period_2_days:    number;
  commission_welcome_rate:        number;
  commission_welcome_days:        number;
}

interface EligibleCreator {
  id:                   string;
  pseudo:               string;
  display_name?:        string;
  avatar_url?:          string;
  first_published_at:   string;
  gross_earnings_xcon:  number;
  pending_balance_xcon: number;
  balance_xcon:         number;
  bonus_already_paid_count: number;
  bonus_1_eligible:     boolean;
  bonus_2_eligible:     boolean;
  threshold1_reached:   boolean;
  threshold2_reached:   boolean;
}

// ── Champ numérique éditable ──────────────────────────────────
function NumberField({
  label, description, value, onChange, suffix,
}: {
  label: string; description?: string; value: number;
  onChange: (v: number) => void; suffix?: string;
}) {
  return (
    <div className="grid grid-cols-[2fr_3fr] items-center gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-cream">{label}</p>
        {description && <p className="text-xs text-sage-muted">{description}</p>}
      </div>
      <div className="flex items-center gap-2">
        <AmountInput value={value} onChange={onChange} min={0} step={100} className="flex-1" />
        {suffix && <span className="shrink-0 text-xs text-sage">{suffix}</span>}
      </div>
    </div>
  );
}

// ── Carte créateur éligible ───────────────────────────────────
function CreatorBonusCard({
  creator, onPay, paying,
}: {
  creator: EligibleCreator;
  onPay: (id: string, tier: 1 | 2) => void;
  paying: string | null;
}) {
  const isPaying = paying === creator.id;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-ink-line bg-ink-surface p-3">
      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-ink-raised">
        {creator.avatar_url ? (
          <Image src={creator.avatar_url} alt="" fill className="object-cover" sizes="40px" />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-display text-gold">
            {(creator.display_name || creator.pseudo)[0]?.toUpperCase()}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-cream">{creator.display_name || creator.pseudo}</span>
          <span className="text-xs text-sage-muted">@{creator.pseudo}</span>
        </div>
        <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-sage-muted">
          <span>1er contenu : {formatRelativeDate(creator.first_published_at)}</span>
          <span>·</span>
          <span className="font-mono text-emerald">{formatFCFA(creator.gross_earnings_xcon)} bruts</span>
          {creator.bonus_already_paid_count > 0 && (
            <Badge variant="emerald">{creator.bonus_already_paid_count} bonus versé{creator.bonus_already_paid_count > 1 ? "s" : ""}</Badge>
          )}
        </div>
      </div>

      <div className="flex shrink-0 gap-2">
        {creator.bonus_1_eligible && (
          <Button
            size="sm"
            variant="outline"
            disabled={isPaying}
            onClick={() => onPay(creator.id, 1)}
          >
            {isPaying ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Gift className="h-3.5 w-3.5" />}
            Palier 1
          </Button>
        )}
        {creator.bonus_2_eligible && (
          <Button
            size="sm"
            disabled={isPaying}
            onClick={() => onPay(creator.id, 2)}
          >
            {isPaying ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Gift className="h-3.5 w-3.5" />}
            Palier 2
          </Button>
        )}
        {!creator.bonus_1_eligible && !creator.bonus_2_eligible && (
          <div className="flex items-center gap-1 text-xs text-sage-muted">
            <BadgeCheck className="h-3.5 w-3.5 text-emerald" />
            Bonus versés
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────
export default function AdminBonusPage() {
  const [config, setConfig]         = useState<BonusConfig | null>(null);
  const [draft, setDraft]           = useState<Partial<BonusConfig>>({});
  const [eligible, setEligible]     = useState<EligibleCreator[]>([]);
  const [threshold1, setThreshold1] = useState(0);
  const [threshold2, setThreshold2] = useState(0);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [paying, setPaying]         = useState<string | null>(null);
  const [toast, setToast]           = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: cfg }, { data: elig }] = await Promise.all([
        api.get("/admin/bonus/config"),
        api.get("/admin/bonus/eligible"),
      ]);
      setConfig(cfg);
      setDraft({});
      setEligible(elig.creators || []);
      setThreshold1(elig.threshold1 || 0);
      setThreshold2(elig.threshold2 || 0);
    } catch {
      showToast("Erreur lors du chargement", false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const current = (key: keyof BonusConfig): any =>
    key in draft ? draft[key] : config?.[key];

  const set = (key: keyof BonusConfig, val: any) =>
    setDraft((d) => ({ ...d, [key]: val }));

  const dirty = Object.keys(draft).length > 0;

  const saveConfig = async () => {
    if (!dirty) return;
    setSaving(true);
    try {
      await api.patch("/admin/bonus/config", draft);
      setConfig((c) => c ? { ...c, ...draft } : c);
      setDraft({});
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      showToast("Configuration sauvegardée", true);
    } catch {
      showToast("Erreur lors de la sauvegarde", false);
    } finally {
      setSaving(false);
    }
  };

  const payBonus = async (creatorId: string, tier: 1 | 2) => {
    setPaying(creatorId);
    try {
      const { data } = await api.post(`/admin/bonus/pay/${creatorId}`, { tier });
      showToast(`Bonus palier ${tier} versé : ${formatFCFA(data.amount_xcon)}`, true);
      await load();
    } catch (err: any) {
      showToast(err?.response?.data?.error || "Erreur lors du versement", false);
    } finally {
      setPaying(null);
    }
  };

  const eligible1 = eligible.filter((c) => c.bonus_1_eligible);
  const eligible2 = eligible.filter((c) => c.bonus_2_eligible);
  const inProgress = eligible.filter((c) => !c.bonus_1_eligible && !c.bonus_2_eligible && (c.threshold1_reached || c.threshold2_reached));

  if (loading) return (
    <div className="flex h-48 items-center justify-center">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-gold border-t-transparent" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-xl border px-4 py-3 shadow-lg ${
          toast.ok
            ? "border-emerald/40 bg-emerald/10 text-emerald"
            : "border-brick/40 bg-brick/10 text-brick"
        }`}>
          {toast.ok ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          <span className="text-sm">{toast.msg}</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-gold" />
          <h2 className="font-display text-xl font-medium text-cream">Bonus bienvenue créateurs</h2>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="h-3.5 w-3.5" />
          Actualiser
        </Button>
      </div>

      {/* Config */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Paramètres</span>
            <div className="flex items-center gap-2">
              {dirty && (
                <Button size="sm" onClick={saveConfig} disabled={saving}>
                  {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
                  Sauvegarder
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Toggle activation */}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-ink-line p-3">
            <div>
              <p className="font-medium text-cream">Activer les bonus bienvenue</p>
              <p className="text-xs text-sage-muted">Les versements manuels nécessitent ce flag activé</p>
            </div>
            <button
              onClick={() => set("bonus_welcome_enabled", !current("bonus_welcome_enabled"))}
              className="cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:ring-offset-1"
            >
              {current("bonus_welcome_enabled")
                ? <ToggleRight className="h-8 w-8 text-emerald" />
                : <ToggleLeft className="h-8 w-8 text-sage-muted" />}
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-3 rounded-xl border border-ink-line p-4">
              <p className="text-sm font-semibold text-gold">Palier 1</p>
              <NumberField
                label="Seuil de gains"
                description="Revenus bruts minimum pour déclencher ce bonus"
                value={current("bonus_welcome_threshold_1_xcon") ?? 0}
                onChange={(v) => set("bonus_welcome_threshold_1_xcon", v)}
                suffix="XAF"
              />
              <NumberField
                label="Montant du bonus"
                description="Somme créditée sur le wallet créateur"
                value={current("bonus_welcome_amount_1_xcon") ?? 0}
                onChange={(v) => set("bonus_welcome_amount_1_xcon", v)}
                suffix="XAF"
              />
            </div>

            <div className="space-y-3 rounded-xl border border-ink-line p-4">
              <p className="text-sm font-semibold text-gold">Palier 2</p>
              <NumberField
                label="Seuil de gains"
                description="Revenus bruts minimum pour déclencher ce bonus"
                value={current("bonus_welcome_threshold_2_xcon") ?? 0}
                onChange={(v) => set("bonus_welcome_threshold_2_xcon", v)}
                suffix="XAF"
              />
              <NumberField
                label="Montant du bonus"
                description="Somme créditée sur le wallet créateur"
                value={current("bonus_welcome_amount_2_xcon") ?? 0}
                onChange={(v) => set("bonus_welcome_amount_2_xcon", v)}
                suffix="XAF"
              />
              <NumberField
                label="Délai max"
                description="Fenêtre temporelle pour atteindre le palier 2"
                value={current("bonus_welcome_period_2_days") ?? 0}
                onChange={(v) => set("bonus_welcome_period_2_days", v)}
                suffix="jours"
              />
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-ink-line p-4">
            <p className="text-sm font-semibold text-gold">Commission bienvenue</p>
            <NumberField
              label="Taux réduit"
              description="Commission appliquée pendant la période de bienvenue"
              value={Math.round((current("commission_welcome_rate") ?? 0) * 100)}
              onChange={(v) => set("commission_welcome_rate", v / 100)}
              suffix="%"
            />
            <NumberField
              label="Durée de la période"
              description="Depuis le premier contenu publié"
              value={current("commission_welcome_days") ?? 0}
              onChange={(v) => set("commission_welcome_days", v)}
              suffix="jours"
            />
          </div>
        </CardContent>
      </Card>

      {/* Créateurs éligibles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>Versements manuels</span>
            {(eligible1.length + eligible2.length) > 0 && (
              <Badge variant="coral">{eligible1.length + eligible2.length} en attente</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="mb-3 text-xs text-sage-muted">
            Seuil 1 : {formatFCFA(threshold1)} · Seuil 2 : {formatFCFA(threshold2)}
            {" "}— Aucun versement automatique. Chaque paiement est audité.
          </p>

          {eligible1.length === 0 && eligible2.length === 0 ? (
            <div className="rounded-xl border border-dashed border-ink-line py-10 text-center text-sm text-sage-muted">
              Aucun créateur éligible pour l&apos;instant
            </div>
          ) : (
            <div className="space-y-2">
              {[...eligible1, ...eligible2.filter((c) => !eligible1.find((e) => e.id === c.id))]
                .sort((a, b) => b.gross_earnings_xcon - a.gross_earnings_xcon)
                .map((creator) => (
                  <CreatorBonusCard
                    key={creator.id}
                    creator={creator}
                    onPay={payBonus}
                    paying={paying}
                  />
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* En progression */}
      {inProgress.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>En progression</span>
              <Badge variant="default">{inProgress.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="mb-3 text-xs text-sage-muted">Bonus déjà versés à ces créateurs</p>
            {inProgress.map((creator) => (
              <CreatorBonusCard
                key={creator.id}
                creator={creator}
                onPay={payBonus}
                paying={paying}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
