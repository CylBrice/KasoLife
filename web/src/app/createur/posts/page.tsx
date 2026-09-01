"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Plus, Eye, EyeOff, Trash2, Film, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatFCFA, formatRelativeDate } from "@/lib/utils";
import { api } from "@/lib/api";
import { useT } from "@/i18n/locale-context";
import type { MyPost } from "@/types";
import { PostEditorDialog } from "./post-editor-dialog";

export default function CreatorPostsPage() {
  const t = useT();
  const [posts, setPosts] = useState<MyPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);

  const loadPosts = () => {
    api.get("/posts/me").then(({ data }) => setPosts(data.posts || [])).finally(() => setLoading(false));
  };

  useEffect(() => { loadPosts(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm(t("common.delete") + " ?")) return;
    try {
      await api.delete(`/posts/${id}`);
      setPosts((prev) => prev.filter((p) => p.id !== id));
    } catch {}
  };

  const handleTogglePublish = async (post: MyPost) => {
    try {
      await api.put(`/posts/${post.id}`, { is_published: !post.is_published });
      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, is_published: !p.is_published } : p)));
    } catch {}
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-medium text-cream">Publications</h1>
          <p className="mt-1 text-sm text-sage">Gérez votre contenu publié.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/createur/editeur">
            <Button variant="secondary">
              <Film className="h-4 w-4" /> Studio vidéo
            </Button>
          </Link>
          <Button onClick={() => setShowEditor(true)}>
            <Plus className="h-4 w-4" /> Nouvelle publication
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-sage-muted">Chargement...</p>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-line px-6 py-16 text-center">
          <p className="font-display text-lg text-cream">{t("creatorDashboard.noPosts")}</p>
          <p className="mt-1 text-sm text-sage">Créez votre première publication pour vos abonnés.</p>
          <Button className="mt-4" onClick={() => setShowEditor(true)}>
            <Plus className="h-4 w-4" /> Nouvelle publication
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {posts.map((post) => (
            <Card key={post.id} className="overflow-hidden">
              <div className="relative aspect-square bg-ink-raised">
                {post.thumbnail_url || post.media_url ? (
                  <Image
                    src={post.thumbnail_url || post.media_url || ""}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="200px"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sage-muted text-sm p-3 text-center">
                    {post.caption?.slice(0, 80) || t("creatorDashboard.textOnly")}
                  </div>
                )}
                <div className="absolute left-2 top-2 flex gap-1">
                  {post.access_level !== "FREE" && (
                    <Badge variant={post.access_level === "PPV" ? "gold" : "emerald"}>
                      <Lock className="h-3 w-3" />
                      {post.access_level === "PPV" ? formatFCFA(post.price_xcon) : t("creatorCard.subscribers")}
                    </Badge>
                  )}
                </div>
                {!post.is_published && (
                  <div className="absolute inset-0 flex items-center justify-center bg-ink/70">
                    <Badge variant="default">Brouillon</Badge>
                  </div>
                )}
                {post.is_flagged && (
                  <div className="absolute right-2 top-2">
                    <Badge variant="coral">Signalé</Badge>
                  </div>
                )}
              </div>
              <CardContent className="flex items-center justify-between p-2">
                <p className="text-xs text-sage-muted">{formatRelativeDate(post.created_at)}</p>
                <div className="flex gap-1">
                  <button onClick={() => handleTogglePublish(post)} className="rounded p-1.5 text-sage hover:bg-ink-raised hover:text-cream">
                    {post.is_published ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={() => handleDelete(post.id)} className="rounded p-1.5 text-sage hover:bg-brick/10 hover:text-brick">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showEditor && (
        <PostEditorDialog
          onClose={() => setShowEditor(false)}
          onCreated={() => { setShowEditor(false); loadPosts(); }}
        />
      )}
    </div>
  );
}
