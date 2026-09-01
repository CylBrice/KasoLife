"use client";

import { useT } from "@/i18n/locale-context";

import { useEffect, useState } from "react";
import { Sparkles, ShieldAlert, MessageSquareWarning, Flag, Tags, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { SubTabs } from "@/components/admin/sub-tabs";

interface AIConfigEntry {
  key: string;
  enabled: boolean;
  description: string;
  updated_at: string | null;
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  AI_CONTENT_MODERATION_ENABLED: ShieldAlert,
  AI_TEXT_MODERATION_ENABLED: MessageSquareWarning,
  AI_REPORT_TRIAGE_ENABLED: Flag,
  AI_AUTO_TAGGING_ENABLED: Tags,
  AI_FRAUD_DETECTION_ENABLED: TrendingUp,
};

const LABELS: Record<string, string> = {
  AI_CONTENT_MODERATION_ENABLED: "Scan des médias uploadés",
  AI_TEXT_MODERATION_ENABLED: "Modération des messages et commentaires",
  AI_REPORT_TRIAGE_ENABLED: "Triage automatique des signalements",
  AI_AUTO_TAGGING_ENABLED: "Tags automatiques sur les publications",
  AI_FRAUD_DETECTION_ENABLED: "Détection de fraude transactionnelle",
};

export default function AdminIAPage() {
  const t = useT();
  const [tab, setTab] = useState<"toggles"|"usage">("toggles");
  const [config, setConfig] = useState<AIConfigEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get("/admin/ai-config").then(({ data }) => setConfig(data || [])).finally(() => setLoading(false));
  }, []);

  const handleToggle = async (key: string, current: boolean) => {
    setError(null);
    setUpdating(key);
    try {
      await api.put(`/admin/ai-config/${key}`, { enabled: !current });
      setConfig((prev) => prev.map((c) => (c.key === key ? { ...c, enabled: !current } : c)));
    } catch (err: any) {
      setError(err?.response?.data?.error || "Erreur lors de la mise à jour.");
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-medium text-cream">{t("admin.aiFeatures")}</h1>
        <p className="mt-1 text-sm text-sage">Activez/désactivez les automatisations IA.</p>
      </div>
      <SubTabs tabs={[
        { key: "toggles", label: "🔧 Fonctionnalités" },
        { key: "usage",   label: "💡 Coûts & usage" },
      ]} active={tab} onChange={(k) => setTab(k as any)} />

      {error && <p className="text-sm text-brick">{error}</p>}

      {loading ? (
        <p className="text-sm text-sage-muted">{t("common.loading")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {config.map((entry) => {
            const Icon = ICONS[entry.key] || Sparkles;
            return (
              <Card key={entry.key}>
                <CardContent className="flex items-center justify-between gap-4 p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink-raised">
                      <Icon className="h-4.5 w-4.5 text-gold" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-cream">{LABELS[entry.key] || entry.key}</p>
                        <Badge variant={entry.enabled ? "emerald" : "default"}>
                          {entry.enabled ? t("common.yes") : t("common.no")}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-sm text-sage">{entry.description}</p>
                      {entry.key === "AI_CONTENT_MODERATION_ENABLED" && (
                        <p className="mt-1 text-xs text-sage-muted">
                          Lorsqu&apos;activé, les images et vignettes vidéo sont analysées avant publication.
                          Le contenu manifestement hors-charte est refusé ; les cas ambigus sont signalés pour revue.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Interrupteur */}
                  <button
                    onClick={() => handleToggle(entry.key, entry.enabled)}
                    disabled={updating !== null}
                    role="switch"
                    aria-checked={entry.enabled}
                    className={cn(
                      "relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50",
                      entry.enabled ? "bg-emerald" : "bg-ink-line"
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-1 h-5 w-5 rounded-full bg-cream transition-transform",
                        entry.enabled ? "translate-x-6" : "translate-x-1"
                      )}
                    />
                  </button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
