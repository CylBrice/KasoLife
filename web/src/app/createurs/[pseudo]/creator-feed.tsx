"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PostCard } from "@/components/posts/post-card";
import type { Post } from "@/types";

export function CreatorFeed({ creatorId }: { creatorId: string }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/posts/creator/${creatorId}`)
      .then(({ data }) => setPosts(data.posts || []))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, [creatorId]);

  const handleUnlocked = (postId: string) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, has_access: true } : p))
    );
    // Recharge le post débloqué pour récupérer media_url
    api.get(`/posts/${postId}`).then(({ data }) => {
      setPosts((prev) => prev.map((p) => (p.id === postId ? data : p)));
    });
  };

  if (loading) {
    return <p className="py-8 text-center text-sm text-sage-muted">Chargement...</p>;
  }

  if (posts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ink-line px-6 py-16 text-center">
        <p className="font-display text-lg text-cream">Aucune publication</p>
        <p className="mt-1 text-sm text-sage">Ce créateur n&apos;a pas encore publié de contenu.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} onUnlocked={handleUnlocked} />
      ))}
    </div>
  );
}
