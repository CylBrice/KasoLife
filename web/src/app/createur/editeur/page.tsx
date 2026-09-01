"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, Film, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useT } from "@/i18n/locale-context";
import { PostEditorDialog } from "../posts/post-editor-dialog";

// URL de l'instance OpenReel auto-hébergée (voir README déploiement).
// OpenReel Video (MIT) est un éditeur vidéo 100% navigateur (WebCodecs/WebGPU) :
// https://github.com/Augani/openreel-video
const OPENREEL_URL = process.env.NEXT_PUBLIC_OPENREEL_URL;

type EditorStatus = "idle" | "loading" | "ready" | "exporting" | "uploading";

export default function CreatorStudioPage() {
  const t = useT();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<EditorStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [exportedUrl, setExportedUrl] = useState<string | null>(null);
  const [exportedThumb, setExportedThumb] = useState<string | null>(null);
  const [showPostDialog, setShowPostDialog] = useState(false);

  const editorOrigin = OPENREEL_URL ? new URL(OPENREEL_URL).origin : null;

  // ── Pont PostMessage avec OpenReel ───────────────────────────────────────
  // OpenReel (fork ComfyUI) expose une API postMessage pour l'injection de
  // contenu et la réception d'exports. On adapte le même contrat ici :
  //   → envoyé : { type: "openreel:load", payload: { url, name, mimeType } }
  //   ← reçu   : { type: "openreel:export", payload: { blob | url, mimeType } }
  //   ← reçu   : { type: "openreel:ready" }
  useEffect(() => {
    if (!editorOrigin) return;

    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== editorOrigin) return;
      const { type, payload } = event.data || {};

      if (type === "openreel:ready") {
        setStatus("ready");
      }

      if (type === "openreel:export") {
        setStatus("uploading");
        setError(null);
        try {
          let blob: Blob;
          if (payload?.blob instanceof Blob) {
            blob = payload.blob;
          } else if (payload?.url) {
            const res = await fetch(payload.url);
            blob = await res.blob();
          } else {
            throw new Error("Export invalide reçu du Studio vidéo");
          }

          const file = new File([blob], "montage.mp4", { type: payload?.mimeType || "video/mp4" });
          const formData = new FormData();
          formData.append("file", file);

          const { data } = await api.post("/uploads/post_video", formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });

          setExportedUrl(data.url);
          setExportedThumb(data.thumbnail_url || null);
          setStatus("ready");
          setShowPostDialog(true);
        } catch (err: any) {
          setError(err?.response?.data?.error || t("creatorDashboard.exportImportError"));
          setStatus("ready");
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [editorOrigin]);

  // ── Charger un fichier local dans OpenReel ───────────────────────────────
  const handleLoadFile = useCallback((file: File) => {
    if (!iframeRef.current?.contentWindow || !editorOrigin) return;
    const url = URL.createObjectURL(file);
    iframeRef.current.contentWindow.postMessage(
      { type: "openreel:load", payload: { url, name: file.name, mimeType: file.type } },
      editorOrigin
    );
  }, [editorOrigin]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleLoadFile(file);
  };

  if (!OPENREEL_URL) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-2xl font-medium text-cream">{t("creatorDashboard.videoStudio")}</h1>
          <p className="mt-1 text-sm text-sage">Montage rapide intégré, propulsé par OpenReel.</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <AlertCircle className="h-8 w-8 text-gold" />
            <p className="font-display text-lg text-cream">Studio vidéo non configuré</p>
            <p className="max-w-md text-sm text-sage">
              Le Studio vidéo intègre OpenReel (éditeur open-source, MIT), déployé séparément.
              Définissez <code className="rounded bg-ink-raised px-1.5 py-0.5 font-mono text-xs">NEXT_PUBLIC_OPENREEL_URL</code>{" "}
              pour l&apos;activer.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-medium text-cream">Studio vidéo</h1>
          <p className="mt-1 text-sm text-sage">
            Montez votre clip (découpe, transitions, texte) puis exportez-le directement vers vos publications.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4" /> Importer une vidéo
          </Button>
          <input ref={fileInputRef} type="file" accept="video/*" onChange={handleFileSelect} className="hidden" />
        </div>
      </div>

      {status === "uploading" && (
        <p className="rounded-xl border border-gold/30 bg-gold/10 px-3 py-2 text-sm text-gold-bright">
          Import et compression du montage exporté en cours...
        </p>
      )}
      {error && (
        <p className="rounded-xl border border-brick/30 bg-brick/10 px-3 py-2 text-sm text-brick">{error}</p>
      )}

      <div className="overflow-hidden rounded-2xl border border-ink-line bg-ink-raised">
        <iframe
          ref={iframeRef}
          src={OPENREEL_URL}
          title={`${t("creatorDashboard.videoStudio")} KasoLife`}
          className="h-[70vh] w-full"
          allow="camera; microphone; clipboard-write"
        />
      </div>

      <p className="text-xs text-sage-muted">
        <Film className="mr-1 inline h-3 w-3" />
        Le montage se fait entièrement dans votre navigateur — aucune donnée vidéo n&apos;est envoyée
        à nos serveurs avant que vous n&apos;exportiez et publiiez votre clip.
      </p>

      {showPostDialog && exportedUrl && (
        <PostEditorDialog
          onClose={() => setShowPostDialog(false)}
          onCreated={() => setShowPostDialog(false)}
          initialMediaUrl={exportedUrl}
          initialThumbnailUrl={exportedThumb || undefined}
          initialMediaType="VIDEO"
        />
      )}
    </div>
  );
}
