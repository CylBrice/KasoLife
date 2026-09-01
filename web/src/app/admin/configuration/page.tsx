"use client";

import { useEffect, useState } from "react";
import { Save, RotateCcw, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SubTabs } from "@/components/admin/sub-tabs";
import { api } from "@/lib/api";

type Tab = "commissions" | "ia" | "maintenance" | "advanced";

interface ConfigEntry { key: string; value: string; description: string | null; updated_at: string | null; }

const CATEGORIES: Record<Tab, string[]> = {
  commissions: ["SUBSCRIPTION_COMMISSION_RATE", "TIP_COMMISSION_RATE", "PPV_COMMISSION_RATE"],
  ia: ["AI_CONTENT_MODERATION_ENABLED","AI_TEXT_MODERATION_ENABLED","AI_REPORT_TRIAGE_ENABLED","AI_AUTO_TAGGING_ENABLED","AI_FRAUD_DETECTION_ENABLED","AI_FAN_REMINDERS_ENABLED","AI_CHURN_PREDICTION_ENABLED","AI_CREATOR_DIGEST_ENABLED","AI_TRANSLATION_ENABLED","AI_DISTRESS_DETECTION_ENABLED","AI_CATEGORY_CONSISTENCY_ENABLED","AI_DUPLICATE_CONTENT_ENABLED","AI_THUMBNAIL_AB_TESTING_ENABLED","AI_SENTIMENT_ANALYSIS_ENABLED","AI_KYC_CONSISTENCY_ENABLED","AI_CHARGEBACK_DETECTION_ENABLED"],
  maintenance: ["MAINTENANCE_STATUS"],
  advanced: [],  // tout le reste
};

const TABS = [
  { key: "commissions", label: "💰 Commissions" },
  { key: "ia",          label: "🤖 IA" },
  { key: "maintenance", label: "🔧 Maintenance" },
  { key: "advanced",    label: "⚙️ Avancé" },
];

const isBool  = (k: string) => k.startsWith("AI_") || k === "MAINTENANCE_STATUS";
const isRate  = (k: string) => k.endsWith("_RATE");

function ConfigItem({ entry, onSave }: { entry: ConfigEntry; onSave: (key: string, val: string) => Promise<void> }) {
  const [editVal, setEditVal] = useState<string | undefined>(undefined);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const display = editVal ?? entry.value;
  const dirty   = editVal !== undefined && editVal !== entry.value;

  const save = async () => {
    if (!dirty) return;
    setSaving(true);
    await onSave(entry.key, editVal!);
    setEditVal(undefined); setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-sm font-medium text-cream">{entry.key}</p>
            {entry.description && <p className="mt-0.5 text-xs text-sage">{entry.description}</p>}
          </div>
          <div className="flex items-center gap-2">
            {isBool(entry.key) ? (
              <button onClick={() => setEditVal(display === "true" ? "false" : "true")}
                role="switch" aria-checked={display === "true"}
                className={`relative h-7 w-12 rounded-full transition-colors ${display === "true" ? "bg-emerald" : "bg-ink-line"}`}>
                <span className={`absolute top-1 h-5 w-5 rounded-full bg-cream transition-transform ${display === "true" ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            ) : (
              <input type={isRate(entry.key) ? "number" : "text"} step={isRate(entry.key) ? "0.01" : undefined}
                value={display} onChange={(e) => setEditVal(e.target.value)}
                className="w-28 rounded-lg border border-ink-line bg-ink-raised px-2 py-1.5 text-center text-sm text-cream focus:border-gold focus:outline-none" />
            )}
            {dirty && (
              <>
                <Button size="sm" onClick={save} disabled={saving}>
                  <Save className="h-3.5 w-3.5" />{saving ? "..." : "Sauver"}
                </Button>
                <button onClick={() => setEditVal(undefined)} className="text-sage-muted hover:text-cream">
                  <RotateCcw className="h-4 w-4" />
                </button>
              </>
            )}
            {saved && <span className="text-xs text-emerald-bright">✓</span>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ConfigurationPage() {
  const [tab, setTab]     = useState<Tab>("commissions");
  const [config, setConfig] = useState<ConfigEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get("/admin/config").then(({ data }) => setConfig(data || [])).finally(() => setLoading(false));
  }, []);

  const handleSave = async (key: string, value: string) => {
    setError(null);
    try {
      await api.put(`/admin/config/${key}`, { value });
      setConfig((prev) => prev.map((c) => c.key === key ? { ...c, value } : c));
    } catch (err: any) { setError(err?.response?.data?.error || "Erreur."); }
  };

  const catKeys = CATEGORIES[tab];
  const entries = catKeys.length > 0
    ? config.filter((c) => catKeys.includes(c.key))
    : config.filter((c) => !Object.values(CATEGORIES).flat().includes(c.key));  // "avancé" = tout le reste

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-medium text-cream">Configuration</h1>
        <p className="mt-1 text-sm text-sage">Paramètres globaux de la plateforme.</p>
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-4 py-3">
        <AlertTriangle className="h-4 w-4 shrink-0 text-gold" />
        <p className="text-sm text-gold-bright">Ces réglages affectent l&apos;ensemble de la plateforme immédiatement.</p>
      </div>
      <SubTabs tabs={TABS} active={tab} onChange={(k) => setTab(k as Tab)} />
      {error && <p className="text-sm text-brick">{error}</p>}
      {loading ? <p className="text-sm text-sage-muted">Chargement...</p> : (
        <div className="flex flex-col gap-2">
          {entries.length === 0
            ? <p className="py-8 text-center text-sm text-sage-muted">Aucun paramètre dans cette catégorie.</p>
            : entries.map((e) => <ConfigItem key={e.key} entry={e} onSave={handleSave} />)
          }
        </div>
      )}
    </div>
  );
}
