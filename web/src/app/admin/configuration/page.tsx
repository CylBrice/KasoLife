"use client";

import { useEffect, useState } from "react";
import { Save, RotateCcw, AlertTriangle, Check, Percent, Gift, Users, Image, Cpu, Settings, Banknote, FileText, Shield } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SubTabs } from "@/components/admin/sub-tabs";
import { api } from "@/lib/api";

type Tab = "montants" | "utilisateurs" | "contenu" | "commissions" | "bonus" | "fanclub" | "tarifs" | "ia" | "systeme";

interface ConfigEntry { key: string; value: string; description: string | null; updated_at: string | null; }

// ── Labels humains ────────────────────────────────────────────
const LABELS: Record<string, string> = {
  // Montants financiers
  subscription_price_min:        "Abonnement — prix minimum (FCFA)",
  subscription_price_max:        "Abonnement — prix maximum (FCFA)",
  tip_min:                       "Pourboire — montant minimum (FCFA)",
  tip_max:                       "Pourboire — montant maximum (FCFA)",
  ppv_price_min:                 "Contenu PPV — prix minimum (FCFA)",
  ppv_price_max:                 "Contenu PPV — prix maximum (FCFA)",
  min_payout_amount:             "Retrait Lifeur — minimum (FCFA)",
  min_wallet_withdraw_xcon:      "Retrait wallet utilisateur — minimum (FCFA)",
  min_deposit_xcon:              "Dépôt — minimum (FCFA)",
  retrait_max_day_xcon:          "Retrait maximum par jour (FCFA)",
  default_subscription_price:    "Prix d'abonnement par défaut (nouveau profil Lifeur)",
  referral_bonus_fcfa:           "Bonus de parrainage (FCFA)",
  referral_max_per_day:          "Filleuls max comptabilisés par jour",
  // Limites utilisateur
  pseudo_max_changes:            "Changements de pseudo — maximum à vie",
  otp_expiry_minutes:            "Validité des codes OTP (minutes)",
  mobile_money_max_per_operator: "Numéros Mobile Money max par opérateur",
  mobile_money_max_total:        "Numéros Mobile Money max au total",
  story_duration_hours:          "Durée de vie d'une story (heures)",
  // Limites de contenu
  max_upload_avatar_mb:          "Taille max avatar (Mo)",
  max_upload_banner_mb:          "Taille max bannière (Mo)",
  max_upload_image_mb:           "Taille max image de post (Mo)",
  max_upload_video_mb:           "Taille max vidéo de post (Mo)",
  max_upload_audio_mb:           "Taille max audio de post (Mo)",
  max_caption_chars:             "Longueur max légende de post (caractères)",
  max_message_chars:             "Longueur max message privé (caractères)",
  max_comment_chars:             "Longueur max commentaire (caractères)",
  // Commissions
  commission_subscription:     "Abonnements",
  commission_tip:              "Pourboires",
  commission_ppv:              "Contenu PPV",
  commission_prerecorded:      "Contenu pré-enregistré & albums",
  commission_fanclub:          "Fan Club",
  commission_referral:         "Parrainage membres",
  commission_withdrawal:       "Retraits Lifeurs",
  commission_welcome_rate:     "Taux réduit bienvenue",
  commission_welcome_days:     "Durée période bienvenue",
  SUBSCRIPTION_COMMISSION_RATE: "Abonnements (legacy)",
  TIP_COMMISSION_RATE:          "Pourboires (legacy)",
  PPV_COMMISSION_RATE:          "PPV (legacy)",
  // Bonus bienvenue
  bonus_welcome_enabled:          "Activer les bonus bienvenue",
  bonus_welcome_threshold_1_xcon: "Seuil de gains — Palier 1",
  bonus_welcome_amount_1_xcon:    "Montant bonus — Palier 1",
  bonus_welcome_threshold_2_xcon: "Seuil de gains — Palier 2",
  bonus_welcome_amount_2_xcon:    "Montant bonus — Palier 2",
  bonus_welcome_period_2_days:    "Fenêtre temporelle palier 2",
  // Fan Club
  fanclub_level_1_min_price_xcon: "Prix minimum niveau 1",
  fanclub_level_2_min_price_xcon: "Prix minimum niveau 2",
  fanclub_level_3_min_price_xcon: "Prix minimum niveau 3",
  // Tarifs & Planchers
  snapshot_min_price_xcon:             "Snapshot — prix minimum",
  snapshot_max_price_xcon:             "Snapshot — prix maximum",
  custom_request_min_price_xcon:       "Demande personnalisée — prix minimum",
  custom_request_max_price_xcon:       "Demande personnalisée — prix maximum",
  custom_request_expiry_days:          "Demande personnalisée — expiration",
  custom_request_auto_confirm_hours:   "Demande personnalisée — confirmation auto",
  stream_goal_min_amount_xcon:         "Objectif live — montant minimum",
  private_show_grace_period_seconds:   "Private Show — délai de grâce",
  private_show_request_timeout_seconds:"Private Show — timeout demande",
  private_show_spy_min_price_xcon:     "Private Show Spy — prix minimum/min",
  private_chat_price_15min:            "Chat privé — prix (15 min)",
  private_chat_request_timeout_min:    "Chat privé — timeout demande",
  vip_show_min_price_xcon:             "VIP Show — prix minimum",
  vip_show_max_price_xcon:             "VIP Show — prix maximum",
  // IA Modération
  AI_CONTENT_MODERATION_ENABLED:  "Scan des médias uploadés",
  AI_TEXT_MODERATION_ENABLED:     "Modération des messages & commentaires",
  AI_REPORT_TRIAGE_ENABLED:       "Triage automatique des signalements",
  AI_FRAUD_DETECTION_ENABLED:     "Détection de fraude transactionnelle",
  AI_KYC_CONSISTENCY_ENABLED:     "Cohérence KYC / identité",
  AI_CHARGEBACK_DETECTION_ENABLED:"Détection réclamations PPV abusives",
  AI_DUPLICATE_CONTENT_ENABLED:   "Détection de contenu dupliqué",
  AI_DISTRESS_DETECTION_ENABLED:  "Détection de signaux de détresse",
  // IA Automatisation
  AI_AUTO_TAGGING_ENABLED:        "Tags automatiques sur les publications",
  AI_CATEGORY_CONSISTENCY_ENABLED:"Cohérence catégorie/contenu des posts",
  AI_FAN_REMINDERS_ENABLED:       "Rappels personnalisés pour les fans",
  AI_CHURN_PREDICTION_ENABLED:    "Prédiction de désabonnement",
  AI_CREATOR_DIGEST_ENABLED:      "Digest hebdo pour les Lifeurs",
  AI_TRANSLATION_ENABLED:         "Traduction automatique des messages",
  AI_SENTIMENT_ANALYSIS_ENABLED:  "Analyse de sentiment commentaires",
  AI_THUMBNAIL_AB_TESTING_ENABLED:"Test A/B vignettes automatique",
  // Système
  MAINTENANCE_STATUS:          "Mode maintenance",
  watermark_visible_enabled:   "Watermark visible (ID + timestamp)",
  watermark_invisible_enabled: "Watermark invisible (stéganographie)",
};

const CATEGORIES: Record<Tab, string[]> = {
  montants: [
    "subscription_price_min", "subscription_price_max",
    "tip_min", "tip_max",
    "ppv_price_min", "ppv_price_max",
    "min_payout_amount", "min_wallet_withdraw_xcon", "min_deposit_xcon",
    "retrait_max_day_xcon",
    "default_subscription_price",
    "referral_bonus_fcfa", "referral_max_per_day",
  ],
  utilisateurs: [
    "pseudo_max_changes",
    "otp_expiry_minutes",
    "mobile_money_max_per_operator", "mobile_money_max_total",
    "story_duration_hours",
  ],
  contenu: [
    "max_upload_avatar_mb", "max_upload_banner_mb",
    "max_upload_image_mb", "max_upload_video_mb", "max_upload_audio_mb",
    "max_caption_chars", "max_message_chars", "max_comment_chars",
  ],
  commissions: [
    "commission_subscription", "commission_tip", "commission_ppv",
    "commission_prerecorded", "commission_fanclub", "commission_referral",
    "commission_withdrawal", "commission_welcome_rate", "commission_welcome_days",
    "SUBSCRIPTION_COMMISSION_RATE", "TIP_COMMISSION_RATE", "PPV_COMMISSION_RATE",
  ],
  bonus: [
    "bonus_welcome_enabled",
    "bonus_welcome_threshold_1_xcon", "bonus_welcome_amount_1_xcon",
    "bonus_welcome_threshold_2_xcon", "bonus_welcome_amount_2_xcon",
    "bonus_welcome_period_2_days",
  ],
  fanclub: [
    "fanclub_level_1_min_price_xcon",
    "fanclub_level_2_min_price_xcon",
    "fanclub_level_3_min_price_xcon",
  ],
  tarifs: [
    "snapshot_min_price_xcon", "snapshot_max_price_xcon",
    "custom_request_min_price_xcon", "custom_request_max_price_xcon",
    "custom_request_expiry_days", "custom_request_auto_confirm_hours",
    "stream_goal_min_amount_xcon",
    "private_show_grace_period_seconds", "private_show_request_timeout_seconds",
    "private_show_spy_min_price_xcon",
    "private_chat_price_15min", "private_chat_request_timeout_min",
    "vip_show_min_price_xcon", "vip_show_max_price_xcon",
  ],
  ia: [
    "AI_CONTENT_MODERATION_ENABLED", "AI_TEXT_MODERATION_ENABLED",
    "AI_REPORT_TRIAGE_ENABLED",      "AI_FRAUD_DETECTION_ENABLED",
    "AI_KYC_CONSISTENCY_ENABLED",    "AI_CHARGEBACK_DETECTION_ENABLED",
    "AI_DUPLICATE_CONTENT_ENABLED",  "AI_DISTRESS_DETECTION_ENABLED",
    "AI_AUTO_TAGGING_ENABLED",       "AI_CATEGORY_CONSISTENCY_ENABLED",
    "AI_FAN_REMINDERS_ENABLED",      "AI_CHURN_PREDICTION_ENABLED",
    "AI_CREATOR_DIGEST_ENABLED",     "AI_TRANSLATION_ENABLED",
    "AI_SENTIMENT_ANALYSIS_ENABLED", "AI_THUMBNAIL_AB_TESTING_ENABLED",
  ],
  systeme: [
    "MAINTENANCE_STATUS",
    "watermark_visible_enabled",
    "watermark_invisible_enabled",
  ],
};

const TAB_META: Record<Tab, { label: string; icon: React.ElementType; description: string }> = {
  montants:      { label: "Montants",           icon: Banknote,  description: "Limites financières : dépôts, retraits, prix min/max, bonus parrainage" },
  utilisateurs:  { label: "Utilisateurs",       icon: Shield,    description: "Limites utilisateur : pseudo, OTP, Mobile Money, stories" },
  contenu:       { label: "Contenu",            icon: FileText,  description: "Tailles max des fichiers et longueurs max des textes" },
  commissions:   { label: "Commissions",        icon: Percent,   description: "Taux de commission par canal de revenus" },
  bonus:         { label: "Bonus bienvenue",    icon: Gift,      description: "Paliers et montants des bonus d'accueil Lifeurs" },
  fanclub:       { label: "Fan Club",           icon: Users,     description: "Prix planchers par niveau d'abonnement Fan Club" },
  tarifs:        { label: "Tarifs & Planchers", icon: Image,     description: "Prix min/max pour contenus, live, chat et shows" },
  ia:            { label: "IA",                icon: Cpu,       description: "Modération, automatisation, personnalisation et prédictions" },
  systeme:       { label: "Système",            icon: Settings,  description: "Maintenance et protection des contenus" },
};

const TABS = (Object.keys(TAB_META) as Tab[]).map((key) => ({
  key,
  label: TAB_META[key].label,
}));

const isBool = (k: string, v?: string) =>
  k.startsWith("AI_") ||
  k === "MAINTENANCE_STATUS" ||
  k.endsWith("_enabled") ||
  v === "true" || v === "false";

const isNumeric = (k: string) =>
  k.endsWith("_xcon") || k.endsWith("_days") || k.endsWith("_hours") ||
  k.endsWith("_seconds") || k.endsWith("_min") || k.endsWith("_mb") ||
  k.endsWith("_chars") || k.endsWith("_fcfa") || k.endsWith("_RATE") ||
  k.endsWith("_rate") || k.endsWith("_changes") || k.endsWith("_minutes") ||
  k.endsWith("_total") || k.endsWith("_day") || k.endsWith("_per_day") ||
  k.endsWith("_per_operator") || k.endsWith("_price");

const isFloat = (k: string) => k.endsWith("_RATE") || k.endsWith("_rate");

// ── Composant ligne config ────────────────────────────────────
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

  const label = LABELS[entry.key] || entry.key;

  return (
    <div className="grid grid-cols-[2fr_3fr] items-center gap-4 border-b border-ink-line py-3 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-cream">{label}</p>
        {entry.description && (
          <p className="mt-0.5 text-xs text-sage">{entry.description}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {isBool(entry.key, display) ? (
          <button
            onClick={() => setEditVal(display === "true" ? "false" : "true")}
            role="switch" aria-checked={display === "true"}
            className={`relative h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:ring-offset-1 ${display === "true" ? "bg-emerald" : "bg-ink-line"}`}
          >
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${display === "true" ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        ) : (
          <input
            type={isNumeric(entry.key) ? "number" : "text"}
            step={isFloat(entry.key) ? "0.01" : "1"}
            value={display}
            onChange={(e) => setEditVal(e.target.value)}
            className="w-36 shrink-0 rounded-xl border border-ink-line bg-ink-raised px-3 py-1.5 text-center font-mono text-sm text-cream focus:border-gold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        )}
        {dirty && (
          <>
            <Button size="sm" onClick={save} disabled={saving} className="shrink-0">
              {saving ? "..." : <><Save className="h-3.5 w-3.5" /> Sauver</>}
            </Button>
            <button onClick={() => setEditVal(undefined)} className="shrink-0 text-sage-muted hover:text-cream">
              <RotateCcw className="h-4 w-4" />
            </button>
          </>
        )}
        {saved && <Check className="h-4 w-4 shrink-0 text-emerald-bright" />}
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────
export default function ConfigurationPage() {
  const [tab, setTab]     = useState<Tab>("montants");
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
  const allCategorized = Object.values(CATEGORIES).flat();
  const entries = catKeys.length > 0
    ? config.filter((c) => catKeys.includes(c.key))
    : config.filter((c) => !allCategorized.includes(c.key));

  const meta = TAB_META[tab];
  const Icon = meta.icon;

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

      {!loading && (
        <Card>
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-2 border-b border-ink-line pb-4">
              <Icon className="h-5 w-5 text-gold" />
              <div>
                <p className="font-medium text-cream">{meta.label}</p>
                <p className="text-xs text-sage-muted">{meta.description}</p>
              </div>
            </div>

            {loading ? (
              <p className="py-4 text-sm text-sage-muted">Chargement...</p>
            ) : entries.length === 0 ? (
              <p className="py-8 text-center text-sm text-sage-muted">Aucun paramètre dans cette section.</p>
            ) : (
              <div className="flex flex-col">
                {entries.map((e) => <ConfigItem key={e.key} entry={e} onSave={handleSave} />)}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {loading && <p className="text-sm text-sage-muted">Chargement...</p>}
    </div>
  );
}
