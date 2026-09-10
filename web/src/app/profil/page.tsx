"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  BadgeCheck, Wallet, Coins, Layers, ChevronRight,
  UserCircle, Shield, CreditCard, BarChart3, Settings, Users,
} from "lucide-react";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/auth-context";
import { useLocale } from "@/i18n/locale-context";
import { formatFCFA } from "@/lib/utils";
import { TabIdentite } from "./_sections/TabIdentite";
import { TabSecurite } from "./_sections/TabSecurite";
import { TabPaiements } from "./_sections/TabPaiements";
import { TabStats } from "./_sections/TabStats";
import { TabConfig } from "./_sections/TabConfig";

type Tab = "identite" | "securite" | "paiements" | "stats" | "config";

const ROLE_LABELS: Record<string, string> = {
  user: "Fan",
  influencer: "Créateur",
  admin: "Admin",
  super_admin: "Super Admin",
  root_admin: "Root Admin",
};

const CREATOR_ROLES = ["influencer", "admin", "super_admin", "root_admin"];

export default function ProfilPage() {
  const { user, wallet, loading } = useAuth();
  const { locale } = useLocale();
  const isEn = locale === "en";
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("identite");
  const [activeSubsCount, setActiveSubsCount] = useState<number>(0);
  const [subscribersCount, setSubscribersCount] = useState<number>(0);

  useEffect(() => {
    if (!loading && !user) router.push("/connexion");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    import("@/lib/api").then(({ api }) => {
      api.get("/subscriptions/me").then(({ data }) => {
        const active = (data || []).filter((s: { status: string }) => s.status === "ACTIVE").length;
        setActiveSubsCount(active);
      }).catch(() => {});

      if (CREATOR_ROLES.includes(user.role)) {
        api.get("/subscriptions/subscribers?limit=1").then(({ data }) => {
          setSubscribersCount(data?.pagination?.total ?? 0);
        }).catch(() => {});
      }
    });
  }, [user]);

  if (loading || !user) return null;

  const u = user as any;
  const isCreator = CREATOR_ROLES.includes(user.role);

  const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "identite",  label: isEn ? "Identity"   : "Identité",     icon: UserCircle },
    { key: "securite",  label: isEn ? "Security"   : "Sécurité",     icon: Shield     },
    { key: "paiements", label: isEn ? "Payments"   : "Paiements",    icon: CreditCard },
    { key: "stats",     label: isEn ? "Statistics" : "Statistiques", icon: BarChart3  },
    { key: "config",    label: isEn ? "Settings"   : "Config",       icon: Settings   },
  ];

  return (
    <>
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-0 md:pb-12">

        {/* ── HERO : bannière + avatar ─────────────────────────────── */}
        <div className="relative -mx-4 md:mx-0">
          <div className="relative aspect-[4/1] w-full overflow-hidden bg-gradient-to-br from-gold/20 via-ink-raised to-emerald/20 md:rounded-2xl">
            {u.banner_url && (
              <Image src={u.banner_url} alt="" fill className="object-cover" sizes="768px" />
            )}
          </div>
          <div className="absolute -bottom-10 left-4 md:left-0">
            <div className="relative h-20 w-20 overflow-hidden rounded-full border-4 border-ink bg-ink-raised">
              {user.avatar_url ? (
                <Image src={user.avatar_url} alt="" fill className="object-cover" sizes="80px" />
              ) : (
                <div className="flex h-full w-full items-center justify-center font-display text-2xl text-gold">
                  {user.pseudo?.[0]?.toUpperCase() || "?"}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Identité rapide ─────────────────────────────────────── */}
        <div className="mt-14">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-2xl font-medium text-cream">
                  {u.name || user.pseudo}
                </h1>
                {user.kyc_status === "VERIFIED" && (
                  <BadgeCheck className="h-5 w-5 shrink-0 text-gold" aria-label={isEn ? "Verified identity" : "Identité vérifiée"} />
                )}
              </div>
              <p className="text-sm text-sage">@{user.pseudo}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <Badge variant={isCreator ? "emerald" : "default"}>
                  {ROLE_LABELS[user.role] || user.role}
                </Badge>
                {u.created_at && (
                  <span className="text-xs text-sage-muted">
                    {isEn ? "Member since " : "Membre depuis "}
                    {new Date(u.created_at).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
                  </span>
                )}
              </div>
            </div>
            {!isCreator && (
              <Link href="/devenir-createur" className="shrink-0">
                <Button size="sm">{isEn ? "Become creator" : "Devenir créateur"}</Button>
              </Link>
            )}
          </div>

          {/* Stat tiles */}
          <div className={`mt-4 grid gap-3 ${isCreator ? "grid-cols-3" : "grid-cols-2"}`}>
            <Link href="/wallet" className="group">
              <div className="flex items-center gap-3 rounded-xl border border-ink-line bg-ink-surface px-4 py-3 transition-colors hover:border-gold/40 hover:bg-ink-raised">
                <Coins className="h-5 w-5 shrink-0 text-gold" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-base font-medium tabular text-cream">
                    {formatFCFA(wallet?.balance_xcon ?? 0)}
                  </p>
                  <p className="text-xs text-sage-muted">{isEn ? "Wallet" : "Wallet"}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-sage-muted opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
            </Link>
            <Link href="/abonnements" className="group">
              <div className="flex items-center gap-3 rounded-xl border border-ink-line bg-ink-surface px-4 py-3 transition-colors hover:border-gold/40 hover:bg-ink-raised">
                <Layers className="h-5 w-5 shrink-0 text-coral" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-base font-medium tabular text-cream">{activeSubsCount}</p>
                  <p className="text-xs text-sage-muted">{isEn ? "Subscriptions" : "Abonnements"}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-sage-muted opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
            </Link>
            {isCreator && (
              <Link href="/createur/abonnes" className="group">
                <div className="flex items-center gap-3 rounded-xl border border-ink-line bg-ink-surface px-4 py-3 transition-colors hover:border-gold/40 hover:bg-ink-raised">
                  <Users className="h-5 w-5 shrink-0 text-emerald" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-base font-medium tabular text-cream">{subscribersCount}</p>
                    <p className="text-xs text-sage-muted">{isEn ? "Subscribers" : "Abonnés"}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-sage-muted opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
              </Link>
            )}
          </div>
        </div>

        {/* ── Navigation onglets ──────────────────────────────────── */}
        <div className="mt-6 flex gap-1 overflow-x-auto scrollbar-none border-b border-ink-line pb-px">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex shrink-0 items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === key
                  ? "border-gold text-gold"
                  : "border-transparent text-sage hover:text-cream"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {/* ── Contenu onglet ──────────────────────────────────────── */}
        <div className="mt-4">
          {tab === "identite"  && <TabIdentite />}
          {tab === "securite"  && <TabSecurite />}
          {tab === "paiements" && <TabPaiements />}
          {tab === "stats"     && <TabStats />}
          {tab === "config"    && <TabConfig />}
        </div>

      </main>
      <Footer />
    </>
  );
}
