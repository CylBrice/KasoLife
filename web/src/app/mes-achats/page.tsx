"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ShoppingBag, Image as ImageIcon, Film, Package,
  ChevronDown, Play, X,
} from "lucide-react";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SecureImage } from "@/components/ui/secure-image";
import { formatFCFA, formatRelativeDate } from "@/lib/utils";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";

// ── Types ────────────────────────────────────────────────────
type PurchaseType = "all" | "post" | "album" | "album_item";

interface Purchase {
  purchase_id:     string;
  purchase_type:   "post" | "album" | "album_item";
  item_id:         string;
  price_paid_xcon: number;
  purchased_at:    string;
  title?:          string;
  description?:    string;
  media_url?:      string;
  thumbnail_url?:  string;
  media_type?:     string;
  items_count?:    number;
  album_id?:       string;
  album_title?:    string;
  creator_id:      string;
  creator_pseudo:  string;
  creator_name?:   string;
  creator_avatar?: string;
}

// ── Viewer sécurisé vidéo (streaming, jamais de téléchargement) ─
function SecureVideoViewer({ mediaUrl, onClose }: { mediaUrl: string; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.addEventListener("contextmenu", (e) => e.preventDefault());
    // Bloquer le téléchargement via clavier
    const blockSave = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") e.preventDefault();
    };
    window.addEventListener("keydown", blockSave);
    return () => window.removeEventListener("keydown", blockSave);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      <div className="relative max-w-3xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <button
          className="absolute -top-10 right-0 text-white/70 hover:text-white"
          onClick={onClose}
        >
          <X className="h-6 w-6" />
        </button>
        <video
          ref={videoRef}
          src={mediaUrl}
          controls
          autoPlay
          controlsList="nodownload nofullscreen"
          disablePictureInPicture
          className="w-full rounded-xl"
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>
    </div>
  );
}

// ── Carte d'un achat ─────────────────────────────────────────
function PurchaseCard({ item }: { item: Purchase }) {
  const [videoOpen, setVideoOpen] = useState(false);
  const isVideo = item.media_type === "video" || item.media_type === "VIDEO";
  const isAlbum = item.purchase_type === "album";

  return (
    <>
      {videoOpen && item.media_url && (
        <SecureVideoViewer mediaUrl={item.media_url} onClose={() => setVideoOpen(false)} />
      )}
      <div className="flex gap-3 rounded-xl border border-ink-line bg-ink-surface p-3">
        {/* Miniature */}
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-ink-raised">
          {isAlbum ? (
            item.thumbnail_url ? (
              <Image src={item.thumbnail_url} alt="" fill className="object-cover" sizes="80px" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-gold">
                <Package className="h-7 w-7" />
              </div>
            )
          ) : item.purchase_type === "post" ? (
            <SecureImage postId={item.item_id} className="h-full w-full" />
          ) : item.thumbnail_url ? (
            <Image src={item.thumbnail_url} alt="" fill className="object-cover" sizes="80px" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-gold">
              <ImageIcon className="h-7 w-7" />
            </div>
          )}

          {isVideo && !isAlbum && (
            <button
              className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/60 transition-colors"
              onClick={() => item.media_url && setVideoOpen(true)}
            >
              <Play className="h-6 w-6 fill-white text-white" />
            </button>
          )}

          {isAlbum && (
            <Link
              href={`/albums/${item.item_id}`}
              className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/60 transition-colors"
            >
              <Play className="h-6 w-6 fill-white text-white" />
            </Link>
          )}
        </div>

        {/* Contenu */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-medium text-cream">
                {item.title || (item.purchase_type === "post" ? "Contenu PPV" : "Contenu sans titre")}
              </p>
              {item.album_title && (
                <p className="truncate text-xs text-sage-muted">Album : {item.album_title}</p>
              )}
              <Link
                href={`/createurs/${item.creator_pseudo}`}
                className="mt-0.5 flex items-center gap-1.5 text-xs text-sage hover:text-gold"
              >
                {item.creator_avatar ? (
                  <Image
                    src={item.creator_avatar}
                    alt=""
                    width={16}
                    height={16}
                    className="rounded-full object-cover"
                  />
                ) : null}
                <span>{item.creator_name || item.creator_pseudo}</span>
              </Link>
            </div>

            <div className="shrink-0 text-right">
              <p className="font-mono text-sm font-medium text-gold-bright">
                {formatFCFA(item.price_paid_xcon)}
              </p>
              <p className="text-xs text-sage-muted">{formatRelativeDate(item.purchased_at)}</p>
            </div>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <TypeBadge type={item.purchase_type} mediaType={item.media_type} />
            {isAlbum && item.items_count != null && (
              <span className="text-xs text-sage-muted">{item.items_count} média{item.items_count > 1 ? "s" : ""}</span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function TypeBadge({ type, mediaType }: { type: Purchase["purchase_type"]; mediaType?: string }) {
  if (type === "album") {
    const isVideo = mediaType === "VIDEO";
    return (
      <Badge variant="default" className="flex items-center gap-1">
        {isVideo ? <Film className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
        Album {isVideo ? "vidéo" : "photo"}
      </Badge>
    );
  }
  if (type === "post") return <Badge variant="default">Contenu PPV</Badge>;
  return <Badge variant="default">Pièce isolée</Badge>;
}

// ── Filtres ──────────────────────────────────────────────────
const FILTERS: { key: PurchaseType; label: string; icon: React.ElementType }[] = [
  { key: "all",        label: "Tout",         icon: ShoppingBag },
  { key: "post",       label: "Posts PPV",    icon: ImageIcon },
  { key: "album",      label: "Albums",       icon: Package },
  { key: "album_item", label: "Pièces",       icon: Film },
];

// ── Page principale ──────────────────────────────────────────
export default function MesAchatsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [filter, setFilter]       = useState<PurchaseType>("all");
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [page, setPage]           = useState(1);
  const [hasMore, setHasMore]     = useState(false);
  const [fetching, setFetching]   = useState(false);
  const [counts, setCounts]       = useState({ total: 0, posts: 0, albums: 0, album_items: 0 });

  useEffect(() => {
    if (!loading && !user) router.push("/connexion");
  }, [loading, user, router]);

  useEffect(() => {
    if (user) {
      api.get("/purchases/my/count").then(({ data }) => setCounts(data)).catch(() => {});
    }
  }, [user]);

  const load = useCallback(async (pageNum: number, type: PurchaseType, reset: boolean) => {
    if (!user) return;
    setFetching(true);
    try {
      const params = new URLSearchParams({ page: String(pageNum), limit: "20" });
      if (type !== "all") params.set("type", type);
      const { data } = await api.get(`/purchases/my?${params}`);
      setPurchases((prev) => reset ? data.purchases : [...prev, ...data.purchases]);
      setHasMore(data.has_more);
      setPage(pageNum);
    } catch {
      // silencieux
    } finally {
      setFetching(false);
    }
  }, [user]);

  useEffect(() => {
    load(1, filter, true);
  }, [filter, load]);

  const handleFilterChange = (key: PurchaseType) => {
    setFilter(key);
  };

  if (loading || !user) return null;

  return (
    <>
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-6 md:pb-12">
        <div className="flex items-center gap-3 mb-5">
          <ShoppingBag className="h-6 w-6 text-gold" />
          <h1 className="font-display text-2xl font-medium text-cream">Mes achats</h1>
          {counts.total > 0 && (
            <span className="rounded-full bg-ink-raised px-2 py-0.5 text-xs font-medium text-sage">
              {counts.total}
            </span>
          )}
        </div>

        {/* Filtres */}
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => handleFilterChange(key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm transition-colors ${
                filter === key
                  ? "border-gold/60 bg-gold/10 text-gold"
                  : "border-ink-line bg-ink-raised text-sage hover:border-gold/30 hover:text-cream"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
              {key !== "all" && (
                <span className="text-xs opacity-60">
                  {key === "post" ? counts.posts : key === "album" ? counts.albums : counts.album_items}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Liste */}
        {purchases.length === 0 && !fetching ? (
          <div className="mt-6 rounded-2xl border border-dashed border-ink-line px-6 py-16 text-center">
            <ShoppingBag className="mx-auto mb-3 h-10 w-10 text-sage-muted" />
            <p className="font-display text-lg text-cream">Aucun achat pour l&apos;instant</p>
            <p className="mt-1 text-sm text-sage-muted">
              Découvrez des créateurs et achetez des contenus exclusifs.
            </p>
            <Link href="/" className="mt-4 inline-block">
              <Button>Explorer les créateurs</Button>
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {purchases.map((item) => (
              <PurchaseCard key={item.purchase_id} item={item} />
            ))}
          </div>
        )}

        {/* Chargement / Voir plus */}
        {fetching && (
          <div className="mt-6 flex justify-center">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-gold border-t-transparent" />
          </div>
        )}
        {!fetching && hasMore && (
          <div className="mt-4 flex justify-center">
            <Button
              variant="outline"
              onClick={() => load(page + 1, filter, false)}
              className="flex items-center gap-2"
            >
              <ChevronDown className="h-4 w-4" />
              Voir plus
            </Button>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
