"use client";

import { useState } from "react";
import Image from "next/image";
import { Heart, MessageCircle, Lock, Play, Music, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatFCFA, formatRelativeDate, cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { CommentSection } from "./comment-section";
import type { Post } from "@/types";

export function PostCard({ post, onUnlocked }: { post: Post; onUnlocked?: (postId: string) => void }) {
  const { user } = useAuth();
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(post.likes_count);
  const [showComments, setShowComments] = useState(false);
  const [commentCount, setCommentCount] = useState(post.comments_count);

  const locked = !post.has_access;

  const handleUnlock = async () => {
    setError(null);
    setUnlocking(true);
    try {
      await api.post(`/posts/${post.id}/purchase`);
      onUnlocked?.(post.id);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Achat impossible. Vérifiez votre solde.");
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
    <article className="overflow-hidden rounded-2xl border border-ink-line bg-ink-surface">
      {/* En-tête créateur */}
      <div className="flex items-center gap-2.5 p-3">
        <div className="relative h-9 w-9 overflow-hidden rounded-full bg-ink-raised">
          {post.creator?.avatar_url ? (
            <Image src={post.creator.avatar_url} alt="" fill className="object-cover" sizes="36px" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm font-medium text-gold">
              {post.creator?.pseudo?.[0]?.toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-cream">@{post.creator?.pseudo}</p>
          <p className="text-xs text-sage-muted">{formatRelativeDate(post.created_at)}</p>
        </div>
        {post.access_level !== "FREE" && (
          <Badge variant={post.access_level === "PPV" ? "gold" : "emerald"}>
            {post.access_level === "PPV" ? `${formatFCFA(post.price_xcon)}` : "Abonnés"}
          </Badge>
        )}
      </div>

      {/* Légende */}
      {post.caption && (
        <p className="px-3 pb-2 text-sm text-cream">{post.caption}</p>
      )}

      {/* Média */}
      {post.media_type !== "TEXT" && (
        <div
          className={cn(
            "relative aspect-square w-full bg-ink-raised",
            locked && "lock-overlay"
          )}
        >
          {post.media_url ? (
            post.media_type === "VIDEO" ? (
              <video src={post.media_url} controls className="h-full w-full object-cover" />
            ) : post.media_type === "AUDIO" ? (
              <div className="flex h-full items-center justify-center gap-3">
                <Music className="h-8 w-8 text-gold" />
                <audio src={post.media_url} controls />
              </div>
            ) : (
              <Image src={post.media_url} alt="" fill className="object-cover" sizes="600px" />
            )
          ) : post.thumbnail_url ? (
            <Image src={post.thumbnail_url} alt="" fill className="object-cover" sizes="600px" />
          ) : (
            <div className="flex h-full items-center justify-center text-sage-muted">
              {post.media_type === "VIDEO" ? <Play className="h-10 w-10" /> : <Music className="h-10 w-10" />}
            </div>
          )}

          {locked && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 px-6 text-center">
              <Lock className="h-7 w-7 text-gold" />
              {post.access_level === "PPV" ? (
                <>
                  <p className="font-display text-lg text-cream">
                    Débloquer pour {formatFCFA(post.price_xcon)}
                  </p>
                  <Button onClick={handleUnlock} disabled={unlocking} size="sm">
                    {unlocking ? "Achat en cours..." : "Débloquer"}
                  </Button>
                </>
              ) : (
                <>
                  <p className="font-display text-lg text-cream">Réservé aux abonnés</p>
                  <p className="text-sm text-sage">Abonnez-vous pour accéder à ce contenu</p>
                </>
              )}
              {error && <p className="text-xs text-brick">{error}</p>}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 border-t border-ink-line p-3">
        <button onClick={handleLike} className="flex items-center gap-1.5 text-sm text-sage hover:text-coral transition">
          <Heart className={cn("h-4.5 w-4.5", liked && "fill-coral text-coral")} />
          {likes}
        </button>
        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-1.5 text-sm text-sage hover:text-emerald transition"
        >
          <MessageCircle className="h-4.5 w-4.5" />
          {commentCount}
        </button>
      </div>

      {/* Commentaires */}
      {showComments && (
        <div className="border-t border-ink-line p-3">
          <CommentSection
            postId={post.id}
            creatorId={post.creator_id}
            isAuthenticated={!!user}
            currentUserId={user?.id}
            onCommentAdded={() => {
              setCommentCount(c => c + 1);
            }}
          />
        </div>
      )}
    </article>
  );
}
