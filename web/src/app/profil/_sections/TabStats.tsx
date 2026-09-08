"use client";
import { useState, useEffect, useCallback } from "react";
import {
  BarChart3, TrendingUp, Users, Heart, FileText,
  Wallet, ArrowDownRight, Star, MessageSquare, Sparkles, Trophy,
  UserPlus, HeartHandshake, Flame, Zap, Award, Crown, Gem, Rocket,
  PenLine, BookOpen, Layers, Archive, BadgeCheck,
  Banknote, CircleDollarSign, Landmark,
  ShieldCheck, Mail, Shield, User, ImageIcon,
  CalendarCheck, Calendar, CalendarDays,
  ThumbsUp, ThumbsDown, Minus, Lock,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useLocale } from "@/i18n/locale-context";
import { api } from "@/lib/api";
import { formatFCFA } from "@/lib/utils";

interface CreatorStats {
  profile: { subscribers_count: number; posts_count: number; total_likes: number; subscription_price_xcon: number };
  wallet: { balance_xcon: number; pending_balance_xcon: number; total_earned: number; total_withdrawn: number };
  revenue_30d: { subscriptions: number; tips: number; ppv: number; total: number };
}

interface Analytics {
  summary: { posts_created: number; total_likes: number; total_comments: number; active_subscribers: number };
  revenue: { tips: number; ppv: number; total: number };
  top_posts: Array<{ id: string; title?: string; likes_count: number; comments_count: number; created_at: string }>;
}

interface Sentiment {
  total: number;
  breakdown: { POSITIVE: number; NEUTRAL: number; NEGATIVE: number };
}

interface Payout {
  id: string;
  amount_xcon: number;
  status: string;
  created_at: string;
}

type Period = "7d" | "30d" | "90d";

const CREATOR_ROLES = ["influencer", "admin", "super_admin", "root_admin"];

/* ── Badges ─────────────────────────────────────────────────────────────── */
const BADGE_COLORS = [
  "#14B8A6", "#5B95DD", "#F59E0B", "#EC4899", "#8B5CF6",
  "#10B981", "#EF4444", "#F97316", "#06B6D4", "#84CC16",
  "#A855F7", "#E11D48", "#0EA5E9", "#22C55E", "#EAB308",
];
const getBadgeColor = (id: string) => {
  const sum = id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return BADGE_COLORS[sum % BADGE_COLORS.length];
};

type BadgeCategory = "community" | "content" | "engagement" | "revenue" | "profile" | "loyalty" | "support";

interface BadgeDef {
  id: string;
  icon: React.ElementType;
  iconColor: string;
  tileBg: string;
  labelFr: string;
  labelEn: string;
  descFr: string;
  descEn: string;
  category: BadgeCategory;
  check: (s: CreatorStats | null, subs: number, user: any) => boolean;
}

const monthsActive = (user: any) =>
  user?.created_at
    ? Math.floor((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30))
    : 0;

/* Créateur — 6 catégories */
const BADGE_DEFS: BadgeDef[] = [
  /* ── Communauté ── */
  {
    id: "sub_1", icon: UserPlus, iconColor: "text-emerald", tileBg: "bg-emerald/10 border-emerald/30",
    labelFr: "Premier fan", labelEn: "First fan",
    descFr: "Ton 1er abonné !", descEn: "Your 1st subscriber!",
    category: "community", check: (s) => (s?.profile.subscribers_count ?? 0) >= 1,
  },
  {
    id: "sub_10", icon: Users, iconColor: "text-emerald", tileBg: "bg-emerald/10 border-emerald/30",
    labelFr: "10 abonnés", labelEn: "10 subscribers",
    descFr: "Ta communauté grandit", descEn: "Your community grows",
    category: "community", check: (s) => (s?.profile.subscribers_count ?? 0) >= 10,
  },
  {
    id: "sub_50", icon: Sparkles, iconColor: "text-emerald", tileBg: "bg-emerald/10 border-emerald/30",
    labelFr: "50 abonnés", labelEn: "50 subscribers",
    descFr: "En route !", descEn: "On the way!",
    category: "community", check: (s) => (s?.profile.subscribers_count ?? 0) >= 50,
  },
  {
    id: "sub_100", icon: Star, iconColor: "text-gold", tileBg: "bg-gold/10 border-gold/30",
    labelFr: "Club des 100", labelEn: "100 Club",
    descFr: "100 abonnés fidèles", descEn: "100 loyal subscribers",
    category: "community", check: (s) => (s?.profile.subscribers_count ?? 0) >= 100,
  },
  {
    id: "sub_500", icon: Rocket, iconColor: "text-gold", tileBg: "bg-gold/10 border-gold/30",
    labelFr: "Étoile montante", labelEn: "Rising star",
    descFr: "500 abonnés", descEn: "500 subscribers",
    category: "community", check: (s) => (s?.profile.subscribers_count ?? 0) >= 500,
  },
  {
    id: "sub_1k", icon: Crown, iconColor: "text-gold", tileBg: "bg-gold/10 border-gold/30",
    labelFr: "1 000 abonnés", labelEn: "1,000 subscribers",
    descFr: "Créateur confirmé", descEn: "Established creator",
    category: "community", check: (s) => (s?.profile.subscribers_count ?? 0) >= 1000,
  },
  {
    id: "sub_5k", icon: Gem, iconColor: "text-coral", tileBg: "bg-coral/10 border-coral/30",
    labelFr: "5 000 abonnés", labelEn: "5,000 subscribers",
    descFr: "Elite", descEn: "Elite",
    category: "community", check: (s) => (s?.profile.subscribers_count ?? 0) >= 5000,
  },
  {
    id: "sub_10k", icon: Trophy, iconColor: "text-coral", tileBg: "bg-coral/10 border-coral/30",
    labelFr: "Superstar", labelEn: "Superstar",
    descFr: "10 000 abonnés", descEn: "10,000 subscribers",
    category: "community", check: (s) => (s?.profile.subscribers_count ?? 0) >= 10000,
  },

  /* ── Contenu ── */
  {
    id: "post_1", icon: PenLine, iconColor: "text-sage", tileBg: "bg-sage/10 border-sage/30",
    labelFr: "1er post", labelEn: "First post",
    descFr: "Le voyage commence", descEn: "The journey begins",
    category: "content", check: (s) => (s?.profile.posts_count ?? 0) >= 1,
  },
  {
    id: "post_10", icon: FileText, iconColor: "text-sage", tileBg: "bg-sage/10 border-sage/30",
    labelFr: "10 publications", labelEn: "10 posts",
    descFr: "Tu prends l'habitude", descEn: "Getting into the habit",
    category: "content", check: (s) => (s?.profile.posts_count ?? 0) >= 10,
  },
  {
    id: "post_25", icon: BookOpen, iconColor: "text-sage", tileBg: "bg-sage/10 border-sage/30",
    labelFr: "25 publications", labelEn: "25 posts",
    descFr: "Régulier et constant", descEn: "Regular and consistent",
    category: "content", check: (s) => (s?.profile.posts_count ?? 0) >= 25,
  },
  {
    id: "post_50", icon: Layers, iconColor: "text-gold", tileBg: "bg-gold/10 border-gold/30",
    labelFr: "50 publications", labelEn: "50 posts",
    descFr: "Prolifique", descEn: "Prolific",
    category: "content", check: (s) => (s?.profile.posts_count ?? 0) >= 50,
  },
  {
    id: "post_100", icon: Archive, iconColor: "text-gold", tileBg: "bg-gold/10 border-gold/30",
    labelFr: "100 publications", labelEn: "100 posts",
    descFr: "Centenaire du contenu", descEn: "Content centenary",
    category: "content", check: (s) => (s?.profile.posts_count ?? 0) >= 100,
  },
  {
    id: "post_500", icon: Crown, iconColor: "text-coral", tileBg: "bg-coral/10 border-coral/30",
    labelFr: "Machine à contenu", labelEn: "Content machine",
    descFr: "500 publications", descEn: "500 posts",
    category: "content", check: (s) => (s?.profile.posts_count ?? 0) >= 500,
  },

  /* ── Engagement ── */
  {
    id: "like_1", icon: Heart, iconColor: "text-coral", tileBg: "bg-coral/10 border-coral/30",
    labelFr: "Premier like", labelEn: "First like",
    descFr: "Quelqu'un t'aime !", descEn: "Someone loves you!",
    category: "engagement", check: (s) => (s?.profile.total_likes ?? 0) >= 1,
  },
  {
    id: "like_50", icon: HeartHandshake, iconColor: "text-coral", tileBg: "bg-coral/10 border-coral/30",
    labelFr: "50 likes", labelEn: "50 likes",
    descFr: "Tu connectes !", descEn: "You're connecting!",
    category: "engagement", check: (s) => (s?.profile.total_likes ?? 0) >= 50,
  },
  {
    id: "like_100", icon: Flame, iconColor: "text-brick", tileBg: "bg-brick/10 border-brick/30",
    labelFr: "100 likes", labelEn: "100 likes",
    descFr: "On feu !", descEn: "On fire!",
    category: "engagement", check: (s) => (s?.profile.total_likes ?? 0) >= 100,
  },
  {
    id: "like_500", icon: Zap, iconColor: "text-brick", tileBg: "bg-brick/10 border-brick/30",
    labelFr: "500 likes", labelEn: "500 likes",
    descFr: "Électrisant", descEn: "Electrifying",
    category: "engagement", check: (s) => (s?.profile.total_likes ?? 0) >= 500,
  },
  {
    id: "like_1k", icon: TrendingUp, iconColor: "text-gold", tileBg: "bg-gold/10 border-gold/30",
    labelFr: "1 000 likes", labelEn: "1,000 likes",
    descFr: "Tendance !", descEn: "Trending!",
    category: "engagement", check: (s) => (s?.profile.total_likes ?? 0) >= 1000,
  },
  {
    id: "like_5k", icon: Award, iconColor: "text-gold", tileBg: "bg-gold/10 border-gold/30",
    labelFr: "5 000 likes", labelEn: "5,000 likes",
    descFr: "Adulé(e)", descEn: "Adored",
    category: "engagement", check: (s) => (s?.profile.total_likes ?? 0) >= 5000,
  },
  {
    id: "like_10k", icon: Crown, iconColor: "text-coral", tileBg: "bg-coral/10 border-coral/30",
    labelFr: "10 000 likes", labelEn: "10,000 likes",
    descFr: "Icône", descEn: "Icon",
    category: "engagement", check: (s) => (s?.profile.total_likes ?? 0) >= 10000,
  },

  /* ── Revenus ── */
  {
    id: "rev_first", icon: Banknote, iconColor: "text-emerald", tileBg: "bg-emerald/10 border-emerald/30",
    labelFr: "Premier revenu", labelEn: "First earnings",
    descFr: "Ton 1er FCFA gagné", descEn: "Your first FCFA earned",
    category: "revenue", check: (s) => (s?.wallet.total_earned ?? 0) > 0,
  },
  {
    id: "rev_10k", icon: TrendingUp, iconColor: "text-emerald", tileBg: "bg-emerald/10 border-emerald/30",
    labelFr: "10 000 FCFA", labelEn: "10,000 FCFA",
    descFr: "La machine tourne", descEn: "The machine is running",
    category: "revenue", check: (s) => (s?.wallet.total_earned ?? 0) >= 10000,
  },
  {
    id: "rev_50k", icon: CircleDollarSign, iconColor: "text-gold", tileBg: "bg-gold/10 border-gold/30",
    labelFr: "50 000 FCFA", labelEn: "50,000 FCFA",
    descFr: "Business sérieux", descEn: "Serious business",
    category: "revenue", check: (s) => (s?.wallet.total_earned ?? 0) >= 50000,
  },
  {
    id: "rev_100k", icon: Award, iconColor: "text-gold", tileBg: "bg-gold/10 border-gold/30",
    labelFr: "100 000 FCFA", labelEn: "100,000 FCFA",
    descFr: "Six chiffres !", descEn: "Six figures!",
    category: "revenue", check: (s) => (s?.wallet.total_earned ?? 0) >= 100000,
  },
  {
    id: "rev_500k", icon: Wallet, iconColor: "text-coral", tileBg: "bg-coral/10 border-coral/30",
    labelFr: "500 000 FCFA", labelEn: "500,000 FCFA",
    descFr: "Demi-million !", descEn: "Half a million!",
    category: "revenue", check: (s) => (s?.wallet.total_earned ?? 0) >= 500000,
  },
  {
    id: "rev_1m", icon: Gem, iconColor: "text-coral", tileBg: "bg-coral/10 border-coral/30",
    labelFr: "Millionnaire", labelEn: "Millionaire",
    descFr: "1 000 000 FCFA", descEn: "1,000,000 FCFA",
    category: "revenue", check: (s) => (s?.wallet.total_earned ?? 0) >= 1000000,
  },
  {
    id: "payout_first", icon: Landmark, iconColor: "text-emerald", tileBg: "bg-emerald/10 border-emerald/30",
    labelFr: "Premier retrait", labelEn: "First payout",
    descFr: "Argent reçu !", descEn: "Cash received!",
    category: "revenue", check: (s) => (s?.wallet.total_withdrawn ?? 0) > 0,
  },

  /* ── Profil & Sécurité ── */
  {
    id: "kyc_ok", icon: BadgeCheck, iconColor: "text-emerald", tileBg: "bg-emerald/10 border-emerald/30",
    labelFr: "KYC vérifié", labelEn: "KYC verified",
    descFr: "Identité confirmée", descEn: "Identity confirmed",
    category: "profile", check: (_, _s, user) => user?.kyc_status === "VERIFIED",
  },
  {
    id: "email_ok", icon: Mail, iconColor: "text-sage", tileBg: "bg-sage/10 border-sage/30",
    labelFr: "Email confirmé", labelEn: "Email confirmed",
    descFr: "Adresse vérifiée", descEn: "Address verified",
    category: "profile", check: (_, _s, user) => Boolean(user?.email_confirmed),
  },
  {
    id: "twofa_ok", icon: Shield, iconColor: "text-sage", tileBg: "bg-sage/10 border-sage/30",
    labelFr: "2FA activé", labelEn: "2FA enabled",
    descFr: "Compte sécurisé", descEn: "Account secured",
    category: "profile", check: (_, _s, user) => Boolean(user?.twofa_enabled),
  },
  {
    id: "bio_ok", icon: User, iconColor: "text-sage", tileBg: "bg-sage/10 border-sage/30",
    labelFr: "Bio rédigée", labelEn: "Bio written",
    descFr: "Présente-toi !", descEn: "Introduce yourself!",
    category: "profile", check: (_, _s, user) => Boolean(user?.bio?.trim()),
  },
  {
    id: "avatar_ok", icon: ImageIcon, iconColor: "text-sage", tileBg: "bg-sage/10 border-sage/30",
    labelFr: "Photo de profil", labelEn: "Profile photo",
    descFr: "Visage connu", descEn: "Known face",
    category: "profile", check: (_, _s, user) => Boolean(user?.avatar_url),
  },

  /* ── Fidélité ── */
  {
    id: "loyal_1m", icon: CalendarCheck, iconColor: "text-sage", tileBg: "bg-sage/10 border-sage/30",
    labelFr: "1 mois", labelEn: "1 month",
    descFr: "Membre depuis 1 mois", descEn: "Member for 1 month",
    category: "loyalty", check: (_, _s, user) => monthsActive(user) >= 1,
  },
  {
    id: "loyal_3m", icon: Calendar, iconColor: "text-gold", tileBg: "bg-gold/10 border-gold/30",
    labelFr: "3 mois", labelEn: "3 months",
    descFr: "Régulier et fidèle", descEn: "Regular and loyal",
    category: "loyalty", check: (_, _s, user) => monthsActive(user) >= 3,
  },
  {
    id: "loyal_6m", icon: CalendarDays, iconColor: "text-gold", tileBg: "bg-gold/10 border-gold/30",
    labelFr: "6 mois", labelEn: "6 months",
    descFr: "Demi-anniversaire !", descEn: "Half birthday!",
    category: "loyalty", check: (_, _s, user) => monthsActive(user) >= 6,
  },
  {
    id: "loyal_1y", icon: Star, iconColor: "text-coral", tileBg: "bg-coral/10 border-coral/30",
    labelFr: "1 an", labelEn: "1 year",
    descFr: "Vétéran KasoLife", descEn: "KasoLife veteran",
    category: "loyalty", check: (_, _s, user) => monthsActive(user) >= 12,
  },
  {
    id: "loyal_2y", icon: Crown, iconColor: "text-coral", tileBg: "bg-coral/10 border-coral/30",
    labelFr: "2 ans", labelEn: "2 years",
    descFr: "Pilier de la plateforme", descEn: "Platform pillar",
    category: "loyalty", check: (_, _s, user) => monthsActive(user) >= 24,
  },
];

/* Fan — 3 catégories */
const FAN_BADGE_DEFS: BadgeDef[] = [
  /* ── Soutien ── */
  {
    id: "fan_sub_1", icon: Heart, iconColor: "text-coral", tileBg: "bg-coral/10 border-coral/30",
    labelFr: "1er soutien", labelEn: "First support",
    descFr: "Ton 1er abonnement", descEn: "Your first subscription",
    category: "support", check: (_, subs) => subs >= 1,
  },
  {
    id: "fan_sub_3", icon: HeartHandshake, iconColor: "text-coral", tileBg: "bg-coral/10 border-coral/30",
    labelFr: "3 créateurs", labelEn: "3 creators",
    descFr: "Tu soutiens !", descEn: "You're supporting!",
    category: "support", check: (_, subs) => subs >= 3,
  },
  {
    id: "fan_sub_5", icon: Users, iconColor: "text-gold", tileBg: "bg-gold/10 border-gold/30",
    labelFr: "5 créateurs", labelEn: "5 creators",
    descFr: "Fan engagé", descEn: "Engaged fan",
    category: "support", check: (_, subs) => subs >= 5,
  },
  {
    id: "fan_sub_10", icon: Star, iconColor: "text-gold", tileBg: "bg-gold/10 border-gold/30",
    labelFr: "Fan dévoué", labelEn: "Devoted fan",
    descFr: "10 créateurs soutenus", descEn: "10 creators supported",
    category: "support", check: (_, subs) => subs >= 10,
  },
  {
    id: "fan_sub_20", icon: Crown, iconColor: "text-coral", tileBg: "bg-coral/10 border-coral/30",
    labelFr: "Mécène", labelEn: "Patron",
    descFr: "20 créateurs soutenus", descEn: "20 creators supported",
    category: "support", check: (_, subs) => subs >= 20,
  },
  /* ── Profil ── */
  {
    id: "fan_kyc", icon: BadgeCheck, iconColor: "text-emerald", tileBg: "bg-emerald/10 border-emerald/30",
    labelFr: "KYC vérifié", labelEn: "KYC verified",
    descFr: "Identité confirmée", descEn: "Identity confirmed",
    category: "profile", check: (_, _s, user) => user?.kyc_status === "VERIFIED",
  },
  {
    id: "fan_email", icon: Mail, iconColor: "text-sage", tileBg: "bg-sage/10 border-sage/30",
    labelFr: "Email confirmé", labelEn: "Email confirmed",
    descFr: "Adresse vérifiée", descEn: "Address verified",
    category: "profile", check: (_, _s, user) => Boolean(user?.email_confirmed),
  },
  {
    id: "fan_2fa", icon: Shield, iconColor: "text-sage", tileBg: "bg-sage/10 border-sage/30",
    labelFr: "2FA activé", labelEn: "2FA enabled",
    descFr: "Compte sécurisé", descEn: "Account secured",
    category: "profile", check: (_, _s, user) => Boolean(user?.twofa_enabled),
  },
  /* ── Fidélité ── */
  {
    id: "fan_loyal_1m", icon: CalendarCheck, iconColor: "text-sage", tileBg: "bg-sage/10 border-sage/30",
    labelFr: "1 mois", labelEn: "1 month",
    descFr: "Membre depuis 1 mois", descEn: "Member for 1 month",
    category: "loyalty", check: (_, _s, user) => monthsActive(user) >= 1,
  },
  {
    id: "fan_loyal_6m", icon: CalendarDays, iconColor: "text-gold", tileBg: "bg-gold/10 border-gold/30",
    labelFr: "6 mois", labelEn: "6 months",
    descFr: "Fan de la première heure", descEn: "Early fan",
    category: "loyalty", check: (_, _s, user) => monthsActive(user) >= 6,
  },
  {
    id: "fan_loyal_1y", icon: Star, iconColor: "text-coral", tileBg: "bg-coral/10 border-coral/30",
    labelFr: "1 an", labelEn: "1 year",
    descFr: "Fan historique", descEn: "Long-time fan",
    category: "loyalty", check: (_, _s, user) => monthsActive(user) >= 12,
  },
];

const CATEGORY_META: Record<BadgeCategory, { labelFr: string; labelEn: string }> = {
  community:  { labelFr: "Communauté",       labelEn: "Community"         },
  content:    { labelFr: "Contenu",           labelEn: "Content"           },
  engagement: { labelFr: "Engagement",        labelEn: "Engagement"        },
  revenue:    { labelFr: "Revenus",           labelEn: "Revenue"           },
  profile:    { labelFr: "Profil & Sécurité", labelEn: "Profile & Security"},
  loyalty:    { labelFr: "Fidélité",          labelEn: "Loyalty"           },
  support:    { labelFr: "Soutien",           labelEn: "Support"           },
};

function BadgesSection({
  badges, stats, subsCount, user, isEn,
}: {
  badges: BadgeDef[];
  stats: CreatorStats | null;
  subsCount: number;
  user: any;
  isEn: boolean;
}) {
  const categories = Array.from(new Set(badges.map((b) => b.category)));
  const earned = badges.filter((b) => b.check(stats, subsCount, user)).length;
  const pct = badges.length > 0 ? Math.round((earned / badges.length) * 100) : 0;

  return (
    <div className="card-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-base font-medium text-cream">
          <Award className="h-5 w-5 text-gold" />
          {isEn ? "Badges & Achievements" : "Badges & Succès"}
        </h2>
        <span className="rounded-full bg-gold/10 px-2.5 py-0.5 text-xs font-medium text-gold">
          {earned}/{badges.length}
        </span>
      </div>

      {/* Progression globale */}
      <div className="mb-5">
        <div className="h-2 w-full overflow-hidden rounded-full bg-ink-raised">
          <div className="h-full rounded-full bg-gradient-to-r from-gold-dim to-gold transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1.5 text-right text-xs text-sage-muted">
          {pct}% {isEn ? "unlocked" : "débloqués"}
        </p>
      </div>

      {/* Grille par catégorie */}
      <div className="space-y-6">
        {categories.map((cat) => {
          const catBadges = badges.filter((b) => b.category === cat);
          const catEarned = catBadges.filter((b) => b.check(stats, subsCount, user)).length;
          const meta = CATEGORY_META[cat];
          return (
            <div key={cat}>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-widest text-sage-muted">
                  {isEn ? meta.labelEn : meta.labelFr}
                </p>
                <p className="text-xs text-sage-muted">{catEarned}/{catBadges.length}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {catBadges.map((badge) => {
                  const unlocked = badge.check(stats, subsCount, user);
                  const Icon = badge.icon;
                  const color = getBadgeColor(badge.id);
                  return (
                    <div
                      key={badge.id}
                      title={`${isEn ? badge.labelEn : badge.labelFr} — ${isEn ? badge.descEn : badge.descFr}`}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                        unlocked
                          ? "text-white shadow-sm"
                          : "border-ink-line bg-ink-raised text-sage-muted opacity-50"
                      }`}
                      style={unlocked ? { backgroundColor: color, borderColor: color } : undefined}
                    >
                      <Icon size={12} />
                      {isEn ? badge.labelEn : badge.labelFr}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatTile({
  label, value, icon: Icon, color = "text-gold",
}: {
  label: string; value: string | number; icon: React.ElementType; color?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-ink-line bg-ink-raised px-4 py-3">
      <div className="flex items-center gap-1.5">
        <Icon className={`h-4 w-4 shrink-0 ${color}`} />
        <span className="truncate text-xs text-sage-muted">{label}</span>
      </div>
      <p className="font-mono text-lg font-semibold tabular-nums text-cream">{value}</p>
    </div>
  );
}

const PAYOUT_STATUS: Record<string, { label_fr: string; label_en: string; color: string }> = {
  PENDING:   { label_fr: "En attente", label_en: "Pending",   color: "text-gold" },
  COMPLETED: { label_fr: "Payé",       label_en: "Paid",      color: "text-emerald-bright" },
  REJECTED:  { label_fr: "Rejeté",     label_en: "Rejected",  color: "text-brick" },
  CANCELLED: { label_fr: "Annulé",     label_en: "Cancelled", color: "text-sage-muted" },
};

export function TabStats() {
  const { user, wallet } = useAuth();
  const { locale } = useLocale();
  const isEn = locale === "en";
  const u = user as any;
  const isCreator = CREATOR_ROLES.includes(user?.role ?? "");

  const [period, setPeriod] = useState<Period>("30d");
  const [stats, setStats] = useState<CreatorStats | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [sentiment, setSentiment] = useState<Sentiment | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [subsCount, setSubsCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  const loadCreator = useCallback(async () => {
    setLoading(true);
    try {
      const [s, a, sen, p] = await Promise.all([
        api.get("/creators/me/stats").catch(() => ({ data: null })),
        api.get(`/creators/me/analytics?period=${period}`).catch(() => ({ data: null })),
        api.get("/creators/me/sentiment").catch(() => ({ data: null })),
        api.get("/payouts/me").catch(() => ({ data: [] })),
      ]);
      setStats(s.data);
      setAnalytics(a.data);
      setSentiment(sen.data);
      setPayouts((p.data || []).slice(0, 5));
    } finally {
      setLoading(false);
    }
  }, [period]);

  const loadFan = useCallback(async () => {
    try {
      const { data } = await api.get("/subscriptions/me");
      setSubsCount((data || []).filter((s: { status: string }) => s.status === "ACTIVE").length);
    } catch {}
  }, []);

  useEffect(() => {
    if (isCreator) loadCreator();
    else loadFan();
  }, [isCreator, loadCreator, loadFan]);

  /* ── VUE FAN ───────────────────────────────────────────────────── */
  if (!isCreator) {
    return (
      <div className="space-y-4">
        <div className="card-surface p-5">
          <h2 className="mb-4 flex items-center gap-2 font-display text-base font-medium text-cream">
            <BarChart3 className="h-5 w-5 text-gold" />
            {isEn ? "My activity" : "Mon activité"}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <StatTile label={isEn ? "Wallet balance" : "Solde wallet"} value={formatFCFA(wallet?.balance_xcon ?? 0)} icon={Wallet} />
            <StatTile label={isEn ? "Active subscriptions" : "Abonnements actifs"} value={subsCount} icon={Heart} color="text-coral" />
          </div>
        </div>
        <div className="rounded-2xl border border-gold/20 bg-gold/5 p-5 text-center">
          <Star className="mx-auto mb-3 h-8 w-8 text-gold opacity-50" />
          <p className="text-sm font-medium text-cream">
            {isEn ? "Become a creator" : "Deviens créateur"}
          </p>
          <p className="mt-1 text-xs text-sage-muted">
            {isEn
              ? "Access detailed analytics on your content and revenue."
              : "Accède à des statistiques détaillées sur ton contenu et tes revenus."}
          </p>
        </div>
        <BadgesSection badges={FAN_BADGE_DEFS} stats={null} subsCount={subsCount} user={u} isEn={isEn} />
      </div>
    );
  }

  /* ── VUE CRÉATEUR ──────────────────────────────────────────────── */
  const PERIODS: { key: Period; label: string }[] = [
    { key: "7d",  label: isEn ? "7d"  : "7j"  },
    { key: "30d", label: isEn ? "30d" : "30j" },
    { key: "90d", label: isEn ? "90d" : "90j" },
  ];

  return (
    <div className="space-y-4">

      {/* ── Vue d'ensemble ──────────────────────────────────────────── */}
      {stats && (
        <div className="card-surface p-5">
          <h2 className="mb-4 flex items-center gap-2 font-display text-base font-medium text-cream">
            <TrendingUp className="h-5 w-5 text-gold" />
            {isEn ? "Overview" : "Vue d'ensemble"}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <StatTile label={isEn ? "Subscribers" : "Abonnés"}        value={stats.profile.subscribers_count}       icon={Users}    />
            <StatTile label={isEn ? "Publications" : "Publications"}   value={stats.profile.posts_count}             icon={FileText} color="text-sage" />
            <StatTile label={isEn ? "Total likes" : "Likes totaux"}    value={stats.profile.total_likes}             icon={Heart}    color="text-coral" />
            <StatTile label={isEn ? "Total earned" : "Revenus totaux"} value={formatFCFA(stats.wallet.total_earned)} icon={Wallet}   />
          </div>
          {stats.wallet.pending_balance_xcon > 0 && (
            <div className="mt-3 flex items-center justify-between rounded-xl border border-gold/30 bg-gold/5 px-4 py-3">
              <p className="text-sm text-sage">{isEn ? "Pending payout" : "En attente de retrait"}</p>
              <p className="font-mono text-sm font-semibold text-gold">{formatFCFA(stats.wallet.pending_balance_xcon)}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Analytiques période ─────────────────────────────────────── */}
      <div className="card-surface p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-display text-base font-medium text-cream">
            <BarChart3 className="h-5 w-5 text-gold" />
            {isEn ? "Analytics" : "Analytiques"}
          </h2>
          <div className="flex gap-1">
            {PERIODS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setPeriod(key)}
                className={`rounded-xl px-3 py-1 text-xs font-medium transition-colors ${
                  period === key ? "bg-gold text-ink" : "text-sage hover:text-cream"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex h-24 items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-gold border-t-transparent" />
          </div>
        ) : analytics ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <StatTile label={isEn ? "Posts created" : "Posts créés"}         value={analytics.summary.posts_created}      icon={FileText}     color="text-sage" />
              <StatTile label={isEn ? "Likes" : "Likes"}                       value={analytics.summary.total_likes}         icon={Heart}        color="text-coral" />
              <StatTile label={isEn ? "Comments" : "Commentaires"}             value={analytics.summary.total_comments}      icon={MessageSquare} color="text-sage" />
              <StatTile label={isEn ? "Active subscribers" : "Abonnés actifs"} value={analytics.summary.active_subscribers}  icon={Users} />
            </div>

            {/* Détail revenus */}
            <div className="rounded-xl border border-ink-line bg-ink-raised p-4">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-sage-muted">
                {isEn ? "Revenue breakdown" : "Détail des revenus"}
              </p>
              <div className="space-y-2">
                {[
                  { label: isEn ? "Subscriptions" : "Abonnements", value: analytics.revenue.total - analytics.revenue.tips - analytics.revenue.ppv },
                  { label: "Tips", value: analytics.revenue.tips },
                  { label: "PPV",  value: analytics.revenue.ppv },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-sm text-sage">{label}</span>
                    <span className="font-mono text-sm font-medium text-cream">{formatFCFA(value)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-ink-line pt-2">
                  <span className="text-sm font-medium text-cream">Total</span>
                  <span className="font-mono text-sm font-bold text-gold">{formatFCFA(analytics.revenue.total)}</span>
                </div>
              </div>
            </div>

            {/* Top posts */}
            {analytics.top_posts?.length > 0 && (
              <div className="rounded-xl border border-ink-line bg-ink-raised p-4">
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-sage-muted">
                  {isEn ? "Top posts" : "Meilleurs posts"}
                </p>
                <div className="space-y-2">
                  {analytics.top_posts.slice(0, 3).map((post, i) => (
                    <div key={post.id} className="flex items-center gap-3">
                      <span className="w-4 shrink-0 text-xs font-bold text-sage-muted">#{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-cream">{post.title || (isEn ? "Untitled post" : "Post sans titre")}</p>
                        <p className="text-xs text-sage-muted">{new Date(post.created_at).toLocaleDateString("fr-FR")}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 text-xs text-sage-muted">
                        <span className="flex items-center gap-0.5"><Heart className="h-3 w-3" /> {post.likes_count}</span>
                        <span className="flex items-center gap-0.5"><MessageSquare className="h-3 w-3" /> {post.comments_count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-sage-muted">
            {isEn ? "No data for this period." : "Aucune donnée pour cette période."}
          </p>
        )}
      </div>

      {/* ── Sentiment commentaires ──────────────────────────────────── */}
      {sentiment && sentiment.total > 0 && (
        <div className="card-surface p-5">
          <h2 className="mb-4 flex items-center gap-2 font-display text-base font-medium text-cream">
            <Sparkles className="h-5 w-5 text-gold" />
            {isEn ? "Comment sentiment" : "Sentiment des commentaires"}
          </h2>
          <div className="mb-3 flex items-end gap-3">
            {[
              { key: "POSITIVE" as const, barColor: "bg-emerald", icon: ThumbsUp,   iconColor: "text-emerald", labelFr: "Positifs",  labelEn: "Positive" },
              { key: "NEUTRAL"  as const, barColor: "bg-gold",    icon: Minus,      iconColor: "text-gold",    labelFr: "Neutres",   labelEn: "Neutral"  },
              { key: "NEGATIVE" as const, barColor: "bg-brick",   icon: ThumbsDown, iconColor: "text-brick",   labelFr: "Négatifs",  labelEn: "Negative" },
            ].map(({ key, barColor, icon: SIcon, iconColor, labelFr, labelEn }) => {
              const count = sentiment.breakdown[key] ?? 0;
              const pct = sentiment.total > 0 ? Math.round((count / sentiment.total) * 100) : 0;
              return (
                <div key={key} className="flex-1 text-center">
                  <SIcon className={`mx-auto mb-1 h-4 w-4 ${iconColor}`} />
                  <p className="mb-1 text-xs text-sage-muted">{isEn ? labelEn : labelFr}</p>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-ink-raised">
                    <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1 text-xs font-semibold text-cream">{pct}%</p>
                </div>
              );
            })}
          </div>
          <p className="text-center text-xs text-sage-muted">
            {isEn ? `Based on ${sentiment.total} comments` : `Sur ${sentiment.total} commentaire${sentiment.total > 1 ? "s" : ""}`}
          </p>
        </div>
      )}

      {/* ── Badges & Achievements ──────────────────────────────────── */}
      <BadgesSection badges={BADGE_DEFS} stats={stats} subsCount={0} user={u} isEn={isEn} />

      {/* ── Historique retraits ─────────────────────────────────────── */}
      {payouts.length > 0 && (
        <div className="card-surface p-5">
          <h2 className="mb-4 flex items-center gap-2 font-display text-base font-medium text-cream">
            <ArrowDownRight className="h-5 w-5 text-gold" />
            {isEn ? "Recent payouts" : "Retraits récents"}
          </h2>
          <div className="space-y-2">
            {payouts.map((p) => {
              const st = PAYOUT_STATUS[p.status];
              return (
                <div key={p.id} className="flex items-center justify-between rounded-xl border border-ink-line bg-ink-raised px-4 py-3">
                  <div>
                    <p className="font-mono text-sm font-medium text-cream">{formatFCFA(p.amount_xcon)}</p>
                    <p className="text-xs text-sage-muted">
                      {new Date(p.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <span className={`text-xs font-medium ${st ? st.color : "text-sage"}`}>
                    {st ? (isEn ? st.label_en : st.label_fr) : p.status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
