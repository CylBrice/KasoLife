"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Heart, MessageCircle, Lock, Music, BadgeCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatFCFA, cn } from "@/lib/utils";
import { getCategoryIcon } from "@/lib/categories";
import { api } from "@/lib/api";
import { useT } from "@/i18n/locale-context";
import type { Post } from "@/types";

/**
 * Carte plein écran pour le feed découverte (style "For You").
 * Réutilise le même voile de verrouillage (.lock-overlay) que PostCard,
 * sans modifier la palette ni les styles existants — uniquement la disposition.
 */
export function FeedCard({ post, onUnlocked }: { post: Post; onUnlocked?: (postId: string) => void }) {
  const t = useT();
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(post.likes_count);

  const locked = !post.has_access;
  const CategoryIcon = post.category ? getCategoryIcon(post.category.slug) : null;

  const handleUnlock = async () => {
    setError(null);
    setUnlocking(true);
    try {
      await api.post(`/posts/${post.id}/purchase`);
      onUnlocked?.(post.id);
    } catch (err: any) {
      setError(err?.response?.data?.error || t("post.purchaseError"));
    } finally {
      setUnlocking(false);
    }
  };

  const handleLike = async () => {
    try {
      const { data } = await api.post(`/posts/${post.id}/like`);
      setLiked(data.liked);
      setLikes((n) => (data.liked ? n + 1 : n - 1));
    } catch {}
  };

  return (
    <section className="relative h-[calc(100vh-4rem)] w-full snap-start overflow-hidden bg-ink md:h-[calc(100vh-2rem)] md:rounded-2xl md:border md:border-ink-line">
      {/* Média en arrière-plan */}
      <div className={cn("absolute inset-0", locked && "lock-overlay")}>
        {post.media_url ? (
          post.media_type === "VIDEO" ? (
            <video
              src={post.media_url}
              autoPlay
              muted
              loop
              playsInline
              controls
              className="h-full w-full object-cover"
            />
          ) : post.media_type === "AUDIO" ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 bg-gradient-to-br from-emerald/20 to-gold/10">
              <Music className="h-16 w-16 text-gold" />
              <audio src={post.media_url} controls />
            </div>
          ) : (
            <Image src={post.media_url} alt="" fill className="object-cover" sizes="100vw" priority />
          )
        ) : post.thumbnail_url ? (
          <Image src={post.thumbnail_url} alt="" fill className="object-cover" sizes="100vw" />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-emerald/20 to-gold/10 px-8 text-center">
            <p className="font-display text-2xl text-cream">{post.caption}</p>
          </div>
        )}

        {locked && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <Lock className="h-8 w-8 text-gold" />
            {post.access_level === "PPV" ? (
              <>
                <p className="font-display text-xl text-cream">
                  {t("post.unlockFor", { price: formatFCFA(post.price_xcon) })}
                </p>
                <Button onClick={handleUnlock} disabled={unlocking}>
                  {unlocking ? t("post.unlocking") : t("post.unlock")}
                </Button>
              </>
            ) : (
              <>
                <p className="font-display text-xl text-cream">{t("post.subscribersOnly")}</p>
                <p className="text-sm text-sage">{t("post.subscribeToAccess")}</p>
                <Link href={`/createurs/${post.creator?.pseudo}`}>
                  <Button>{t("post.viewProfile")}</Button>
                </Link>
              </>
            )}
            {error && <p className="text-xs text-brick">{error}</p>}
          </div>
        )}
      </div>

      {/* Voile de lisibilité en bas */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink via-ink/60 to-transparent" />

      {/* Overlay d'infos */}
      <div className="absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-3 p-4 pb-6">
        <div className="min-w-0 flex-1">
          <Link href={`/createurs/${post.creator?.pseudo}`} className="flex items-center gap-2">
            <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border-2 border-ink bg-ink-raised">
              {post.creator?.avatar_url ? (
                <Image src={post.creator.avatar_url} alt="" fill className="object-cover" sizes="36px" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm font-medium text-gold">
                  {post.creator?.pseudo?.[0]?.toUpperCase()}
                </div>
              )}
            </div>
            <span className="truncate font-display text-base font-medium text-cream">
              @{post.creator?.pseudo}
            </span>
            {CategoryIcon && (
              <Badge variant="default">
                <CategoryIcon className="h-3 w-3" />
                {post.category?.name}
              </Badge>
            )}
          </Link>
          {post.caption && !locked && (
            <p className="mt-2 line-clamp-2 text-sm text-cream/90">{post.caption}</p>
          )}
        </div>

        {/* Actions verticales */}
        <div className="flex flex-col items-center gap-4">
          <button onClick={handleLike} className="flex flex-col items-center gap-1 text-cream">
            <Heart className={cn("h-7 w-7 drop-shadow", liked && "fill-coral text-coral")} />
            <span className="text-xs font-mono tabular">{likes}</span>
          </button>
          <Link href={`/createurs/${post.creator?.pseudo}`} className="flex flex-col items-center gap-1 text-cream">
            <MessageCircle className="h-7 w-7 drop-shadow" />
            <span className="text-xs font-mono tabular">{post.comments_count}</span>
          </Link>
        </div>
      </div>

      {/* Badge accès en haut */}
      {post.access_level !== "FREE" && (
        <div className="absolute right-3 top-3 z-20">
          <Badge variant={post.access_level === "PPV" ? "gold" : "emerald"}>
            <BadgeCheck className="h-3 w-3" />
            {post.access_level === "PPV" ? formatFCFA(post.price_xcon) : t("post.subscribers")}
          </Badge>
        </div>
      )}
    </section>
  );
}
