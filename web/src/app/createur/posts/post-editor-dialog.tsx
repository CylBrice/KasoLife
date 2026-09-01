"use client";

import { useT } from "@/i18n/locale-context";

import { useState, useRef } from "react";
import { X, Upload, Image as ImageIcon, Video, Music, Type, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

type MediaType = "TEXT" | "IMAGE" | "VIDEO" | "AUDIO";
type AccessLevel = "FREE" | "SUBSCRIBERS" | "PPV";

export function PostEditorDialog({
  onClose,
  onCreated,
  initialMediaUrl,
  initialThumbnailUrl,
  initialMediaType = "VIDEO",
}: {
  onClose: () => void;
  onCreated: () => void;
  /** Pré-remplit le post avec un média déjà uploadé (ex: export du Studio vidéo) */
  initialMediaUrl?: string;
  initialThumbnailUrl?: string;
  initialMediaType?: MediaType;
}) {
  const t = useT();

  const MEDIA_OPTIONS: { type: MediaType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { type: "TEXT", label: t("postEditor.mediaType.TEXT"), icon: Type },
    { type: "IMAGE", label: t("postEditor.mediaType.IMAGE"), icon: ImageIcon },
    { type: "VIDEO", label: t("postEditor.mediaType.VIDEO"), icon: Video },
    { type: "AUDIO", label: t("postEditor.mediaType.AUDIO"), icon: Music },
  ];
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mediaType, setMediaType] = useState<MediaType>(initialMediaUrl ? initialMediaType : "TEXT");
  const [mediaUrl, setMediaUrl] = useState<string | undefined>(initialMediaUrl);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | undefined>(initialThumbnailUrl);
  const [caption, setCaption] = useState("");
  const [accessLevel, setAccessLevel] = useState<AccessLevel>("FREE");
  const [price, setPrice] = useState("500");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [mediaRef, setMediaRef] = useState<{ bucket: string; path: string } | null>(null);
  const [aiTags, setAiTags] = useState<string[]>([]);
  const [moderationStatus, setModerationStatus] = useState<string | null>(null);
  const [generatingCaption, setGeneratingCaption] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const uploadType =
      mediaType === "IMAGE" ? "post_image" : mediaType === "VIDEO" ? "post_video" : "post_audio";

    setUploading(true);
    setUploadProgress(t("postEditor.uploadingProgress"));
    setError(null);
    setWarning(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (caption) formData.append("caption", caption);
      const { data } = await api.post(`/uploads/${uploadType}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMediaUrl(data.url);
      if (data.thumbnail_url) setThumbnailUrl(data.thumbnail_url);
      setMediaRef({ bucket: data.bucket, path: data.path });
      setAiTags(data.ai_tags || []);
      setModerationStatus(data.moderation_status || null);
      if (data.moderation_status === "FLAGGED") {
        setWarning(
          data.moderation_reason
            ? `Contenu signalé pour revue : ${data.moderation_reason}`
            : "Ce contenu a été marqué pour revue par notre équipe de modération."
        );
      }
      setUploadProgress(null);
    } catch (err: any) {
      if (err?.response?.status === 422) {
        setError(err?.response?.data?.error || "Contenu refusé par la modération.");
      } else {
        setError(err?.response?.data?.error || "Échec du téléversement.");
      }
      setUploadProgress(null);
    } finally {
      setUploading(false);
    }
  };

  const handleGenerateCaption = async () => {
    if (!mediaRef) return;
    setGeneratingCaption(true);
    setError(null);
    try {
      const { data } = await api.post("/uploads/generate-caption", {
        bucket: mediaRef.bucket,
        path: mediaRef.path,
        tone: "engageant",
      });
      if (data.caption) setCaption(data.caption);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Génération de légende indisponible.");
    } finally {
      setGeneratingCaption(false);
    }
  };

  const handleSubmit = async () => {
    setError(null);
    if (mediaType !== "TEXT" && !mediaUrl) {
      setError("Veuillez ajouter un média ou choisir le type Texte.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/posts", {
        caption: caption || undefined,
        media_type: mediaType,
        media_url: mediaUrl,
        thumbnail_url: thumbnailUrl,
        access_level: accessLevel,
        price_xcon: accessLevel === "PPV" ? Number(price) : undefined,
        moderation_status: moderationStatus || undefined,
        ai_tags: aiTags.length > 0 ? aiTags : undefined,
      });
      onCreated();
    } catch (err: any) {
      setError(err?.response?.data?.error || "Erreur lors de la publication.");
    } finally {
      setSubmitting(false);
    }
  };

  const acceptFor: Record<MediaType, string> = {
    TEXT: "",
    IMAGE: "image/jpeg,image/png,image/webp,image/gif",
    VIDEO: "video/mp4,video/quicktime,video/webm",
    AUDIO: "audio/mpeg,audio/mp4,audio/wav,audio/ogg",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-ink-line bg-ink-surface p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-medium text-cream">Nouvelle publication</h2>
          <button onClick={onClose} className="rounded p-1 text-sage hover:text-cream">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Type de média */}
        <div className="mt-4 grid grid-cols-4 gap-2">
          {MEDIA_OPTIONS.map(({ type, label, icon: Icon }) => (
            <button
              key={type}
              onClick={() => { setMediaType(type); setMediaUrl(undefined); setThumbnailUrl(undefined); }}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl border p-3 text-xs transition-colors",
                mediaType === type
                  ? "border-gold bg-gold/10 text-gold-bright"
                  : "border-ink-line bg-ink-raised text-sage hover:text-cream"
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </button>
          ))}
        </div>

        {/* Upload de média */}
        {mediaType !== "TEXT" && (
          <div className="mt-4">
            {mediaUrl ? (
              <div className="relative overflow-hidden rounded-xl border border-ink-line bg-ink-raised">
                {mediaType === "VIDEO" ? (
                  <video src={mediaUrl} controls className="max-h-64 w-full" />
                ) : mediaType === "AUDIO" ? (
                  <audio src={mediaUrl} controls className="w-full p-3" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mediaUrl} alt="" className="max-h-64 w-full object-cover" />
                )}
                <button
                  onClick={() => { setMediaUrl(undefined); setThumbnailUrl(undefined); }}
                  className="absolute right-2 top-2 rounded-full bg-ink/80 p-1.5 text-cream hover:bg-brick"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-ink-line text-sage hover:border-gold hover:text-gold-bright"
              >
                <Upload className="h-6 w-6" />
                <span className="text-sm">{uploadProgress || t("postEditor.uploadPrompt")}</span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept={acceptFor[mediaType]}
              onChange={handleFileSelect}
              className="hidden"
            />
            {mediaType === "VIDEO" && (
              <p className="mt-1.5 text-xs text-sage-muted">
                Astuce : utilisez le Studio vidéo pour monter votre clip avant de le publier.
              </p>
            )}
          </div>
        )}

        {/* Légende */}
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-sm font-medium text-cream">Légende</label>
            {mediaRef && (mediaType === "IMAGE" || mediaType === "VIDEO") && (
              <button
                onClick={handleGenerateCaption}
                disabled={generatingCaption}
                className="flex items-center gap-1 text-xs text-gold-bright hover:underline disabled:opacity-50"
              >
                <Sparkles className="h-3 w-3" />
                {generatingCaption ? t("postEditor.generating") : t("postEditor.generateWithAI")}
              </button>
            )}
          </div>
          <textarea
            className="min-h-20 w-full rounded-xl border border-ink-line bg-ink-raised px-3.5 py-2.5 text-sm text-cream placeholder:text-sage-muted focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
            placeholder={t("postEditor.captionPlaceholder")}
            maxLength={2000}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
          {aiTags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {aiTags.map((tag) => (
                <span key={tag} className="rounded-full border border-ink-line bg-ink-raised px-2 py-0.5 text-xs text-sage">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {warning && (
          <p className="mt-3 rounded-xl border border-gold/30 bg-gold/10 px-3 py-2 text-sm text-gold-bright">
            {warning}
          </p>
        )}

        {/* Niveau d'accès */}
        <div className="mt-4">
          <label className="text-sm font-medium text-cream">Visibilité</label>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {([
              { value: "FREE", label: t("postEditor.visibilityPublic") },
              { value: "SUBSCRIBERS", label: t("postEditor.visibilitySubscribers") },
              { value: "PPV", label: t("postEditor.visibilityPPV") },
            ] as { value: AccessLevel; label: string }[]).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setAccessLevel(opt.value)}
                className={cn(
                  "rounded-xl border px-3 py-2 text-sm transition-colors",
                  accessLevel === opt.value
                    ? "border-gold bg-gold/10 text-gold-bright"
                    : "border-ink-line bg-ink-raised text-sage hover:text-cream"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {accessLevel === "PPV" && (
          <div className="mt-3">
            <Input
              label="Prix (FCFA, entre 100 et 200 000)"
              type="number"
              min={100}
              max={200000}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
        )}

        {error && <p className="mt-3 text-sm text-brick">{error}</p>}

        <div className="mt-5 flex gap-2">
          <Button variant="ghost" onClick={onClose} className="flex-1">Annuler</Button>
          <Button onClick={handleSubmit} disabled={submitting || uploading} className="flex-1">
            {submitting ? t("postEditor.publishing") : t("postEditor.publish")}
          </Button>
        </div>
      </div>
    </div>
  );
}
