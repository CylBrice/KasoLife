"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/locale-context";
import { useDynamicSegment } from "@/lib/use-dynamic-segment";
import Image from "next/image";
import { BadgeCheck, Users, FileText } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Footer } from "@/components/layout/footer";
import { Badge } from "@/components/ui/badge";
import { getCategoryIcon } from "@/lib/categories";
import { api } from "@/lib/api";
import { SubscribeButton } from "./subscribe-button";
import { CreatorFeed } from "./creator-feed";

interface CreatorProfile {
  id: string;
  pseudo: string;
  display_name: string;
  avatar_url?: string;
  banner_url?: string;
  bio?: string;
  is_verified_badge: boolean;
  is_subscribed: boolean;
  is_own_profile: boolean;
  is_accepting_subs: boolean;
  subscription_price_xcon: number;
  subscribers_count: number;
  posts_count: number;
  welcome_message?: string;
  category?: { name: string; slug: string };
}

export default function CreatorProfileClient() {
  const t = useT();
  const pseudo = useDynamicSegment(1); // /createurs/[pseudo]
  const router = useRouter();
  const [creator, setCreator] = useState<CreatorProfile | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!pseudo) return;
    api.get(`/creators/${pseudo}`)
      .then(({ data }) => setCreator(data))
      .catch((err) => {
        if (err?.response?.status === 404) setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [pseudo]);

  if (pseudo === null || loading) return null;

  if (notFound || !creator) {
    return (
      <>
        <Navbar />
        <main className="mx-auto max-w-3xl px-4 py-16 text-center">
          <p className="font-display text-2xl text-cream">{t('creatorProfile.notFound')}</p>
          <p className="mt-2 text-sm text-sage">Ce profil n&apos;existe pas ou n&apos;est plus disponible.</p>
          <button onClick={() => router.push("/")} className="mt-4 text-sm text-gold hover:underline">
            Retour à l&apos;accueil
          </button>
        </main>
        <BottomNav />
      <Footer />
      </>
    );
  }

  const Icon = creator.category ? getCategoryIcon(creator.category.slug) : null;

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 pb-24 md:pb-12">
        {/* Bannière */}
        <div className="relative -mx-4 aspect-[3/1] w-screen overflow-hidden bg-ink-raised md:-mx-0 md:w-full md:rounded-2xl">
          {creator.banner_url ? (
            <Image src={creator.banner_url} alt="" fill className="object-cover" sizes="800px" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-emerald/30 to-gold/20" />
          )}
        </div>

        {/* En-tête profil */}
        <div className="relative px-1">
          <div className="relative -mt-10 h-20 w-20 overflow-hidden rounded-full border-4 border-ink bg-ink-raised">
            {creator.avatar_url ? (
              <Image src={creator.avatar_url} alt="" fill className="object-cover" sizes="80px" />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-display text-2xl text-gold">
                {creator.display_name?.[0]?.toUpperCase()}
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-2xl font-medium text-cream">
                  {creator.display_name}
                </h1>
                {creator.is_verified_badge && <BadgeCheck className="h-5 w-5 text-gold" />}
              </div>
              <p className="text-sm text-sage">@{creator.pseudo}</p>
              <div className="mt-2 flex items-center gap-3 text-sm text-sage-muted">
                {creator.category && Icon && (
                  <Badge variant="default">
                    <Icon className="h-3.5 w-3.5" />
                    {creator.category.name}
                  </Badge>
                )}
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" /> {creator.subscribers_count} {t('creatorProfile.subscribers')}
                </span>
                <span className="flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" /> {creator.posts_count} {t('creatorProfile.posts')}
                </span>
              </div>
            </div>

            <SubscribeButton
              creatorId={creator.id}
              priceXcon={creator.subscription_price_xcon}
              isSubscribed={creator.is_subscribed}
              isOwnProfile={creator.is_own_profile}
              acceptingSubs={creator.is_accepting_subs}
            />
          </div>

          {creator.bio && <p className="mt-3 text-sm text-cream">{creator.bio}</p>}

          {creator.is_subscribed && creator.welcome_message && (
            <div className="mt-4 rounded-xl border border-emerald/30 bg-emerald/10 px-4 py-3 text-sm text-cream">
              <p className="mb-1 font-medium text-emerald-bright">Message de bienvenue</p>
              {creator.welcome_message}
            </div>
          )}
        </div>

        {/* Fil de contenu */}
        <div className="mt-6">
          <CreatorFeed creatorId={creator.id} />
        </div>
      </main>
      <BottomNav />
      <Footer />
    </>
  );
}
