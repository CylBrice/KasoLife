"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  Save, RotateCcw, AlertTriangle, Check, Percent, Gift, Users,
  Image, Cpu, Settings, Banknote, FileText, Shield, Eye, EyeOff,
  RefreshCw, Lock,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SubTabs } from "@/components/admin/sub-tabs";
import { Modal } from "@/components/ui/modal";
import { api } from "@/lib/api";

type Tab = "montants" | "utilisateurs" | "contenu" | "commissions" | "bonus" | "fanclub" | "tarifs" | "ia" | "systeme";

interface ConfigEntry { key: string; value: string; description: string | null; updated_at: string | null; }

// ── Labels humains ────────────────────────────────────────────
const LABELS: Record<string, string> = {
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
  pseudo_max_changes:            "Changements de pseudo — maximum à vie",
  otp_expiry_minutes:            "Validité des codes OTP (minutes)",
  mobile_money_max_per_operator: "Numéros Mobile Money max par opérateur",
  mobile_money_max_total:        "Numéros Mobile Money max au total",
  story_duration_hours:          "Durée de vie d'une story (heures)",
  max_upload_avatar_mb:          "Taille max avatar (Mo)",
  max_upload_banner_mb:          "Taille max bannière (Mo)",
  max_upload_image_mb:           "Taille max image de post (Mo)",
  max_upload_video_mb:           "Taille max vidéo de post (Mo)",
  max_upload_audio_mb:           "Taille max audio de post (Mo)",
  max_caption_chars:             "Longueur max légende de post (caractères)",
  max_message_chars:             "Longueur max message privé (caractères)",
  max_comment_chars:             "Longueur max commentaire (caractères)",
  commission_subscription:       "Abonnements",
  commission_tip:                "Pourboires",
  commission_ppv:                "Contenu PPV",
  commission_prerecorded:        "Contenu pré-enregistré & albums",
  commission_fanclub:            "Fan Club",
  commission_referral:           "Parrainage membres",
  commission_withdrawal:         "Retraits Lifeurs",
  commission_welcome_rate:       "Taux réduit bienvenue",
  commission_welcome_days:       "Durée période bienvenue",
  SUBSCRIPTION_COMMISSION_RATE:  "Abonnements (legacy)",
  TIP_COMMISSION_RATE:           "Pourboires (legacy)",
  PPV_COMMISSION_RATE:           "PPV (legacy)",
  bonus_welcome_enabled:          "Activer les bonus bienvenue",
  bonus_welcome_threshold_1_xcon: "Seuil de gains — Palier 1",
  bonus_welcome_amount_1_xcon:    "Montant bonus — Palier 1",
  bonus_welcome_threshold_2_xcon: "Seuil de gains — Palier 2",
  bonus_welcome_amount_2_xcon:    "Montant bonus — Palier 2",
  bonus_welcome_period_2_days:    "Fenêtre temporelle palier 2",
  fanclub_level_1_min_price_xcon: "Prix minimum niveau 1",
  fanclub_level_2_min_price_xcon: "Prix minimum niveau 2",
  fanclub_level_3_min_price_xcon: "Prix minimum niveau 3",
  snapshot_min_price_xcon:             "Snapshot — prix minimum",
  snapshot_max_price_xcon:             "Snapshot — prix maximum",
  custom_request_min_price_xcon:       "Demande personnalisée — prix minimum",
  custom_request_max_price_xcon:       "Demande personnalisée — prix maximum",
  custom_request_expiry_days:          "Demande personnalisée — expiration",
  custom_request_auto_confirm_hours:   "Demande personnalisée — confirmation auto",
  stream_goal_min_amount_xcon:         "Objectif live — montant minimum",
  private_show_grace_period_seconds:    "Private Show — délai de grâce (s)",
  private_show_request_timeout_min:     "Private Show — timeout demande (min)",
  private_show_spy_min_price_xcon:      "Private Show Spy — prix minimum/min",
  private_show_min_standard_15min:      "Private Show Standard — 15 min",
  private_show_min_standard_30min:      "Private Show Standard — 30 min",
  private_show_min_standard_45min:      "Private Show Standard — 45 min",
  private_show_min_standard_60min:      "Private Show Standard — 60 min",
  private_show_min_premium_15min:       "Private Show Premium — 15 min",
  private_show_min_premium_30min:       "Private Show Premium — 30 min",
  private_show_min_premium_45min:       "Private Show Premium — 45 min",
  private_show_min_premium_60min:       "Private Show Premium — 60 min",
  private_chat_price_15min:             "Chat privé — prix (15 min)",
  private_chat_price_30min:             "Chat privé — prix (30 min)",
  private_chat_price_45min:             "Chat privé — prix (45 min)",
  private_chat_price_60min:             "Chat privé — prix (60 min)",
  private_chat_request_timeout_min:     "Chat privé — timeout demande (min)",
  private_chat_cam2cam_grace_seconds:   "Chat privé — délai de grâce cam2cam (s)",
  vip_show_min_price_xcon:              "VIP Show — prix minimum",
  vip_show_max_price_xcon:              "VIP Show — prix maximum",
  AI_CONTENT_MODERATION_ENABLED:   "Scan des médias uploadés",
  AI_TEXT_MODERATION_ENABLED:      "Modération des messages & commentaires",
  AI_REPORT_TRIAGE_ENABLED:        "Triage automatique des signalements",
  AI_FRAUD_DETECTION_ENABLED:      "Détection de fraude transactionnelle",
  AI_KYC_CONSISTENCY_ENABLED:      "Cohérence KYC / identité",
  AI_CHARGEBACK_DETECTION_ENABLED: "Détection réclamations PPV abusives",
  AI_DUPLICATE_CONTENT_ENABLED:    "Détection de contenu dupliqué",
  AI_DISTRESS_DETECTION_ENABLED:   "Détection de signaux de détresse",
  AI_AUTO_TAGGING_ENABLED:         "Tags automatiques sur les publications",
  AI_CATEGORY_CONSISTENCY_ENABLED: "Cohérence catégorie/contenu des posts",
  AI_FAN_REMINDERS_ENABLED:        "Rappels personnalisés pour les fans",
  AI_CHURN_PREDICTION_ENABLED:     "Prédiction de désabonnement",
  AI_CREATOR_DIGEST_ENABLED:       "Digest hebdo pour les Lifeurs",
  AI_TRANSLATION_ENABLED:          "Traduction automatique des messages",
  AI_SENTIMENT_ANALYSIS_ENABLED:   "Analyse de sentiment commentaires",
  AI_THUMBNAIL_AB_TESTING_ENABLED: "Test A/B vignettes automatique",
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
    "vip_show_min_price_xcon", "vip_show_max_price_xcon",
    "private_show_grace_period_seconds", "private_show_request_timeout_min",
    "private_show_spy_min_price_xcon",
    "private_show_min_standard_15min", "private_show_min_standard_30min",
    "private_show_min_standard_45min", "private_show_min_standard_60min",
    "private_show_min_premium_15min",  "private_show_min_premium_30min",
    "private_show_min_premium_45min",  "private_show_min_premium_60min",
    "private_chat_price_15min", "private_chat_price_30min",
    "private_chat_price_45min", "private_chat_price_60min",
    "private_chat_request_timeout_min", "private_chat_cam2cam_grace_seconds",
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
    "maintenance_status",
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
  ia:            { label: "IA",                 icon: Cpu,       description: "Modération, automatisation, personnalisation et prédictions" },
  systeme:       { label: "Système",            icon: Settings,  description: "Maintenance et protection des contenus" },
};

const TABS = (Object.keys(TAB_META) as Tab[]).map((key) => ({ key, label: TAB_META[key].label }));

const isBool = (k: string, v?: string) =>
  k.startsWith("AI_") || k === "maintenance_status" || k.endsWith("_enabled") ||
  v === "true" || v === "false";

const isNumeric = (k: string) =>
  k.endsWith("_xcon") || k.endsWith("_days") || k.endsWith("_hours") ||
  k.endsWith("_seconds") || k.endsWith("_min") || k.endsWith("_mb") ||
  k.endsWith("_chars") || k.endsWith("_fcfa") || k.endsWith("_RATE") ||
  k.endsWith("_rate") || k.endsWith("_changes") || k.endsWith("_minutes") ||
  k.endsWith("_total") || k.endsWith("_day") || k.endsWith("_per_day") ||
  k.endsWith("_per_operator") || k.endsWith("_price");

const isFloat = (k: string) => k.endsWith("_RATE") || k.endsWith("_rate");

// ── Modale confirmation mot de passe ─────────────────────────
interface PendingAction {
  type: "save-section" | "reset-section" | "save-field" | "reset-field";
  section: Tab;
  changes: { key: string; old_value: string; new_value: string }[];
}

function PasswordModal({
  open, onClose, onConfirm, title, description,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (password: string) => Promise<void>;
  title: string;
  description: string;
}) {
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) { setPassword(""); setError(null); setTimeout(() => inputRef.current?.focus(), 50); }
  }, [open]);

  const submit = async () => {
    if (!password) { setError("Mot de passe requis"); return; }
    setLoading(true); setError(null);
    try {
      await onConfirm(password);
    } catch (e: any) {
      setError(e?.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={title} description={description} size="sm" persistent>
      <div className="mt-4 flex flex-col gap-4">
        <div className="relative">
          <input
            ref={inputRef}
            type={showPwd ? "text" : "password"}
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className="w-full rounded-xl border border-ink-line bg-ink-raised px-3 py-2 pr-10 text-sm text-cream placeholder:text-sage-muted focus:border-gold focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setShowPwd((s) => !s)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sage-muted hover:text-cream"
          >
            {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {error && <p className="text-xs text-brick">{error}</p>}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onClose} className="flex-1" disabled={loading}>
            Annuler
          </Button>
          <Button size="sm" onClick={submit} disabled={loading} className="flex-1">
            {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
            Confirmer
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Ligne de configuration ────────────────────────────────────
function ConfigItem({
  entry, draft, defaultValue, onChange, onReset,
}: {
  entry: ConfigEntry;
  draft?: string;
  defaultValue: string;
  onChange: (key: string, val: string) => void;
  onReset: (key: string) => void;
}) {
  const current = draft ?? entry.value;
  const isDirty = current !== defaultValue;

  const label = LABELS[entry.key] || entry.key;

  return (
    <div className="grid grid-cols-[2fr_3fr] items-center gap-4 border-b border-ink-line py-3 last:border-0">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium text-cream">{label}</p>
          {isDirty && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />}
        </div>
        {entry.description && (
          <p className="mt-0.5 text-xs text-sage">{entry.description}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {isBool(entry.key, current) ? (
          <button
            onClick={() => onChange(entry.key, current === "true" ? "false" : "true")}
            role="switch" aria-checked={current === "true"}
            className={`relative h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:ring-offset-1 ${current === "true" ? "bg-gold" : "bg-toggle-off"}`}
          >
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${current === "true" ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        ) : (
          <input
            type={isNumeric(entry.key) ? "number" : "text"}
            step={isFloat(entry.key) ? "0.01" : "1"}
            value={current}
            onChange={(e) => onChange(entry.key, e.target.value)}
            className="w-36 shrink-0 rounded-xl border border-ink-line bg-ink-raised px-3 py-1.5 text-center font-mono text-sm text-cream focus:border-gold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        )}
        {isDirty && (
          <button
            onClick={() => onReset(entry.key)}
            title="Revenir à la valeur d'origine"
            className="shrink-0 rounded-xl p-1 text-sage-muted hover:text-cream hover:bg-ink-raised transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────
export default function ConfigurationPage() {
  const [tab, setTab]               = useState<Tab>("montants");
  const [config, setConfig]         = useState<ConfigEntry[]>([]);
  const [initialConfig, setInitial] = useState<Record<string, string>>({});
  const [draft, setDraft]           = useState<Record<string, string>>({});
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [toast, setToast]           = useState<{ msg: string; ok: boolean } | null>(null);

  // Modale mot de passe
  const [pwdModal, setPwdModal]     = useState(false);
  const [pendingAction, setPending] = useState<PendingAction | null>(null);
  const [pwdTitle, setPwdTitle]     = useState("");
  const [pwdDesc, setPwdDesc]       = useState("");

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    api.get("/admin/config").then(({ data }) => {
      setConfig(data || []);
      const defaults: Record<string, string> = {};
      for (const e of (data || [])) defaults[e.key] = e.value;
      setInitial(defaults);
    }).finally(() => setLoading(false));
  }, []);

  const handleChange = (key: string, val: string) => {
    setDraft((d) => ({ ...d, [key]: val }));
  };

  const handleResetField = (key: string) => {
    setDraft((d) => {
      const next = { ...d };
      delete next[key];
      return next;
    });
  };

  // Prépare et ouvre la modale de confirmation
  const requestSaveSection = (currentTab: Tab) => {
    const keys = CATEGORIES[currentTab];
    const entries = config.filter((c) => keys.includes(c.key));
    const changes = entries
      .filter((e) => draft[e.key] !== undefined && draft[e.key] !== e.value)
      .map((e) => ({ key: e.key, old_value: e.value, new_value: draft[e.key] }));
    if (changes.length === 0) { showToast("Aucune modification à sauvegarder", false); return; }
    setPending({ type: "save-section", section: currentTab, changes });
    setPwdTitle("Confirmer la sauvegarde");
    setPwdDesc(`${changes.length} modification(s) dans la section « ${TAB_META[currentTab].label} ». Entrez votre mot de passe pour valider.`);
    setPwdModal(true);
  };

  const requestResetSection = (currentTab: Tab) => {
    const keys = CATEGORIES[currentTab];
    const entries = config.filter((c) => keys.includes(c.key));
    const changes = entries
      .filter((e) => (draft[e.key] ?? e.value) !== initialConfig[e.key])
      .map((e) => ({ key: e.key, old_value: draft[e.key] ?? e.value, new_value: initialConfig[e.key] }));
    if (changes.length === 0) { showToast("La section est déjà aux valeurs d'origine", false); return; }
    setPending({ type: "reset-section", section: currentTab, changes });
    setPwdTitle("Réinitialiser la section");
    setPwdDesc(`${changes.length} champ(s) vont revenir à leurs valeurs d'origine dans « ${TAB_META[currentTab].label} ». Entrez votre mot de passe pour confirmer.`);
    setPwdModal(true);
  };

  const executeAction = useCallback(async (password: string) => {
    if (!pendingAction) return;

    // 1. Vérification du mot de passe
    try {
      await api.post("/admin/verify-password", { password });
    } catch {
      throw new Error("Mot de passe incorrect");
    }

    const { section, changes, type } = pendingAction;

    if (type === "reset-section") {
      // Applique le reset localement (revenir aux valeurs initiales)
      setDraft((d) => {
        const next = { ...d };
        for (const { key } of changes) delete next[key];
        return next;
      });
      setPwdModal(false);
      setPending(null);

      // Envoie notification groupée si les valeurs initiales ≠ valeurs en DB
      const serverChanges = changes.filter((c) => c.old_value !== c.new_value);
      if (serverChanges.length > 0) {
        await api.patch("/admin/config/batch", { changes: serverChanges, section, action: "reset" });
        setConfig((prev) => prev.map((c) => {
          const ch = serverChanges.find((s) => s.key === c.key);
          return ch ? { ...c, value: ch.new_value } : c;
        }));
        setInitial((prev) => {
          const next = { ...prev };
          for (const { key, new_value } of serverChanges) next[key] = new_value;
          return next;
        });
      }
      showToast(`Section « ${TAB_META[section].label} » réinitialisée`, true);
      return;
    }

    // save-section
    await api.patch("/admin/config/batch", { changes, section, action: "save" });
    setConfig((prev) => prev.map((c) => {
      const ch = changes.find((s) => s.key === c.key);
      return ch ? { ...c, value: ch.new_value } : c;
    }));
    setInitial((prev) => {
      const next = { ...prev };
      for (const { key, new_value } of changes) next[key] = new_value;
      return next;
    });
    setDraft((d) => {
      const next = { ...d };
      for (const { key } of changes) delete next[key];
      return next;
    });
    setPwdModal(false);
    setPending(null);
    showToast(`${changes.length} modification(s) sauvegardée(s)`, true);
  }, [pendingAction]);

  const catKeys = CATEGORIES[tab];
  const allCategorized = Object.values(CATEGORIES).flat();
  const entries = catKeys.length > 0
    ? config.filter((c) => catKeys.includes(c.key))
    : config.filter((c) => !allCategorized.includes(c.key));

  const sectionDirtyCount = entries.filter((e) =>
    (draft[e.key] ?? e.value) !== initialConfig[e.key]
  ).length;

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

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-xl border px-4 py-3 shadow-lg ${toast.ok ? "border-emerald/40 bg-emerald/10 text-emerald" : "border-brick/40 bg-brick/10 text-brick"}`}>
          {toast.ok ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          <span className="text-sm">{toast.msg}</span>
        </div>
      )}

      {!loading && (
        <Card>
          <CardContent className="p-5">
            {/* En-tête section */}
            <div className="mb-4 flex items-center justify-between gap-2 border-b border-ink-line pb-4">
              <div className="flex items-center gap-2">
                <Icon className="h-5 w-5 text-gold" />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-cream">{meta.label}</p>
                    {sectionDirtyCount > 0 && (
                      <span className="rounded-full bg-gold/20 px-2 py-0.5 text-xs font-medium text-gold">
                        {sectionDirtyCount} modif.
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-sage-muted">{meta.description}</p>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => requestResetSection(tab)}
                  title="Annuler toutes les modifications de cette section"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Réinitialiser
                </Button>
                <Button
                  size="sm"
                  onClick={() => requestSaveSection(tab)}
                  disabled={sectionDirtyCount === 0}
                >
                  <Save className="h-3.5 w-3.5" />
                  Sauvegarder ({sectionDirtyCount})
                </Button>
              </div>
            </div>

            {entries.length === 0 ? (
              <p className="py-8 text-center text-sm text-sage-muted">Aucun paramètre dans cette section.</p>
            ) : (
              <div className="flex flex-col">
                {entries.map((e) => (
                  <ConfigItem
                    key={e.key}
                    entry={e}
                    draft={draft[e.key]}
                    defaultValue={initialConfig[e.key] ?? e.value}
                    onChange={handleChange}
                    onReset={handleResetField}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {loading && <p className="text-sm text-sage-muted">Chargement...</p>}

      <PasswordModal
        open={pwdModal}
        onClose={() => { setPwdModal(false); setPending(null); }}
        onConfirm={executeAction}
        title={pwdTitle}
        description={pwdDesc}
      />
    </div>
  );
}
