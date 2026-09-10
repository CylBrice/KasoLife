"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { FeedCard } from "@/components/posts/feed-card";
import { useT } from "@/i18n/locale-context";
import type { Post } from "@/types";

export type FeedMode = "boosted" | "popular" | "trending" | "followed" | "personalized" | "all";

export function DiscoverFeed({
  categories,
  search,
  mode = "boosted",
}: {
  categories?: string[];
  search?: string;
  mode?: FeedMode;
}) {
  const t = useT();
  const [posts, setPosts] = useState<Post[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const categoriesKey = categories?.join(",") ?? "";
  const searchKey = search?.trim() ?? "";

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      let data;
      if (searchKey) {
        ({ data } = await api.get("/posts/search", { params: { q: searchKey, page, limit: 10 } }));
      } else {
        const params: Record<string, unknown> = { page, limit: 10 };
        if (categoriesKey) params.categories = categoriesKey;
        if (mode !== "boosted") params.mode = mode === "all" ? "all" : mode;
        ({ data } = await api.get("/posts/discover", { params }));
      }
      const newPosts: Post[] = data.posts || [];
      if (newPosts.length === 0) {
        setHasMore(false);
      } else {
        setPosts((prev) => [...prev, ...newPosts]);
        setPage((p) => p + 1);
      }
    } catch {
      setHasMore(false);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, loading, hasMore, categoriesKey, searchKey, mode]);

  useEffect(() => {
    setPosts([]);
    setPage(1);
    setHasMore(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoriesKey, searchKey, mode]);

  useEffect(() => {
    if (posts.length === 0 && hasMore && !loading) {
      loadMore();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts.length, categoriesKey, searchKey, mode]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { rootMargin: "200% 0px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  const handleUnlocked = (postId: string) => {
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, has_access: true } : p)));
    api.get(`/posts/${postId}`).then(({ data }) => {
      setPosts((prev) => prev.map((p) => (p.id === postId ? data : p)));
    }).catch(() => {});
  };

  if (posts.length === 0 && !loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center px-6 text-center">
        <p className="font-display text-lg text-cream">{t("home.noContent")}</p>
        <p className="mt-1 text-sm text-sage">{t("home.noContentSub")}</p>
      </div>
    );
  }

  return (
    <div className="md:gap-2 md:px-2 md:py-2">
      {posts.map((post, idx) => (
        <div key={`${post.id}-${idx}`} className="md:pb-2">
          <FeedCard post={post} onUnlocked={handleUnlocked} />
        </div>
      ))}
      <div ref={sentinelRef} className="h-1" />
      {loading && (
        <div className="flex h-24 items-center justify-center">
          <p className="text-sm text-sage-muted">{t("common.loading")}</p>
        </div>
      )}
    </div>
  );
}
