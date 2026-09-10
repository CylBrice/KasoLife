"use client";

// Page créateur : gestion des snapshots payants
// Prise manuelle (pendant live ou standalone) → vente aux fans

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { Camera, Plus, Trash2, Eye, EyeOff, AlertTriangle, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatFCFA, formatRelativeDate } from "@/lib/utils";
import { api } from "@/lib/api";

interface Snapshot {
  id: string;
  thumbnail_url?: string;
  title?: string;
  price_xcon: number;
  access_level: string;
  is_published: boolean;
  created_at: string;
}

const ACCESS_LABELS: Record<string, string> = {
  FREE: "Gratuit", SUBSCRIBERS: "Abonnés", PPV: "PPV",
};

export default function CreateurSnapshotsPage() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  // Formulaire
  const [mediaUrl, setMediaUrl]       = useState("");
  const [thumbUrl, setThumbUrl]       = useState("");
  const [title, setTitle]             = useState("");
  const [price, setPrice]             = useState(2000);
  const [accessLevel, setAccessLevel] = useState("PPV");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/creators/me/stats"); // récupère l'id implicitement
      const creatorId = data?.profile?.user_id;
      if (creatorId) {
        const { data: snaps } = await api.get(`/snapshots?creator_id=${creatorId}&page=1&limit=50`);
        // Inclure non-publiés (on passe par l'endpoint créateur - voir note)
        // Pour l'instant l'API publique ne retourne que les publiés
        setSnapshots(snaps.snapshots || []);
      }
    } catch {
      // silencieux
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const createSnapshot = async () => {
    if (!mediaUrl.trim()) { setError("URL du média requise"); return; }
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/snapshots", {
        media_url: mediaUrl,
        thumbnail_url: thumbUrl || undefined,
        title: title || undefined,
        price_xcon: accessLevel === "PPV" ? price : 0,
        access_level: accessLevel,
      });
      setShowForm(false);
      setMediaUrl(""); setThumbUrl(""); setTitle(""); setPrice(2000); setAccessLevel("PPV");
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || "Erreur lors de la création");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteSnapshot = async (id: string) => {
    try {
      await api.delete(`/snapshots/${id}`);
      setSnapshots((prev) => prev.filter((s) => s.id !== id));
    } catch (err: any) {
      alert(err?.response?.data?.error || "Erreur");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-medium text-cream flex items-center gap-2">
            <Camera className="h-5 w-5 text-gold" />
            Snapshots payants
          </h2>
          <p className="text-sm text-sage-muted mt-0.5">Photos/vidéos vendues à l&apos;unité — streaming uniquement pour les acheteurs</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-3.5 w-3.5" />
          Nouveau snapshot
        </Button>
      </div>

      {/* Formulaire de création */}
      {showForm && (
        <div className="rounded-xl border border-ink-line bg-ink-surface p-5 space-y-4">
          <p className="font-medium text-cream">Publier un snapshot</p>
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-brick/30 bg-brick/10 px-3 py-2 text-xs text-brick">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />{error}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-sage mb-1">URL du média (R2) *</label>
            <input
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-xl border border-ink-line bg-ink-raised px-3 py-2 text-sm text-cream placeholder:text-sage-muted focus:border-gold focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-sage mb-1">URL de la miniature (optionnel)</label>
            <input
              value={thumbUrl}
              onChange={(e) => setThumbUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-xl border border-ink-line bg-ink-raised px-3 py-2 text-sm text-cream placeholder:text-sage-muted focus:border-gold focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-sage mb-1">Titre (optionnel)</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border border-ink-line bg-ink-raised px-3 py-2 text-sm text-cream focus:border-gold focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-sage mb-1">Accès</label>
              <select
                value={accessLevel}
                onChange={(e) => setAccessLevel(e.target.value)}
                className="w-full rounded-xl border border-ink-line bg-ink-raised px-3 py-2 text-sm text-cream focus:border-gold focus:outline-none"
              >
                <option value="FREE">Gratuit</option>
                <option value="SUBSCRIBERS">Abonnés</option>
                <option value="PPV">PPV</option>
              </select>
            </div>
          </div>
          {accessLevel === "PPV" && (
            <div>
              <label className="block text-xs font-medium text-sage mb-1">Prix (XAF)</label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                className="w-full rounded-xl border border-ink-line bg-ink-raised px-3 py-2 text-sm text-cream focus:border-gold focus:outline-none"
              />
            </div>
          )}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Annuler</Button>
            <Button className="flex-1" onClick={createSnapshot} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Publier
            </Button>
          </div>
        </div>
      )}

      {/* Liste */}
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-gold" />
        </div>
      ) : snapshots.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-line py-14 text-center">
          <Camera className="mx-auto mb-3 h-8 w-8 text-sage-muted" />
          <p className="text-sage-muted text-sm">Aucun snapshot publié</p>
          <p className="text-xs text-sage-muted mt-1">Prenez des snapshots pendant vos lives ou créez-en ici</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {snapshots.map((snap) => (
            <div key={snap.id} className="group relative overflow-hidden rounded-xl border border-ink-line bg-ink-surface">
              <div className="aspect-square bg-ink-raised">
                {snap.thumbnail_url ? (
                  <Image
                    src={snap.thumbnail_url}
                    alt={snap.title || ""}
                    fill
                    className="object-cover"
                    sizes="200px"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Camera className="h-8 w-8 text-sage-muted" />
                  </div>
                )}
              </div>
              <div className="p-2 space-y-1.5">
                {snap.title && (
                  <p className="truncate text-xs font-medium text-cream">{snap.title}</p>
                )}
                <div className="flex items-center justify-between gap-1">
                  <Badge variant="default" className="text-xs">
                    {ACCESS_LABELS[snap.access_level] || snap.access_level}
                  </Badge>
                  {snap.access_level === "PPV" && (
                    <span className="font-mono text-xs text-gold">{formatFCFA(snap.price_xcon)}</span>
                  )}
                </div>
                <p className="text-xs text-sage-muted">{formatRelativeDate(snap.created_at)}</p>
              </div>
              <button
                onClick={() => deleteSnapshot(snap.id)}
                className="absolute right-2 top-2 hidden h-7 w-7 items-center justify-center rounded-full bg-brick/80 text-white group-hover:flex"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
