"use client";

import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import { ZoomIn, ZoomOut } from "lucide-react";
import { Modal, ModalActions } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { getCroppedImg } from "@/utils/crop-image";

export type CropRatio = "square" | "banner";

export interface CropResult {
  blob: Blob;
  crop: { ratio: CropRatio; x: number; y: number; width: number; height: number };
}

interface Props {
  imageSrc: string;
  ratio: CropRatio;
  onCancel: () => void;
  onConfirm: (result: CropResult) => void;
}

const RATIO_VALUES: Record<CropRatio, number> = { square: 1, banner: 16 / 9 };
// Largeur max de sortie selon le type
const MAX_WIDTH: Record<CropRatio, number> = { square: 800, banner: 1920 };

const LABELS: Record<CropRatio, { fr: string; en: string }> = {
  square: { fr: "Recadrer la photo", en: "Crop photo" },
  banner: { fr: "Recadrer la bannière", en: "Crop banner" },
};

export function ImageCropper({ imageSrc, ratio, onCancel, onConfirm }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<{
    x: number; y: number; width: number; height: number;
  } | null>(null);
  const [processing, setProcessing] = useState(false);

  const onCropComplete = useCallback(
    (_: unknown, pixels: { x: number; y: number; width: number; height: number }) => {
      setCroppedAreaPixels(pixels);
    },
    [],
  );

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    setProcessing(true);
    try {
      const blob = await getCroppedImg(imageSrc, croppedAreaPixels, MAX_WIDTH[ratio]);
      if (!blob) throw new Error("Crop failed");

      const img = new Image();
      img.src = imageSrc;
      await new Promise<void>((res) => { img.onload = () => res(); img.onerror = () => res(); });
      const srcW = img.naturalWidth || 1;
      const srcH = img.naturalHeight || 1;

      onConfirm({
        blob,
        crop: {
          ratio,
          x: croppedAreaPixels.x / srcW,
          y: croppedAreaPixels.y / srcH,
          width: croppedAreaPixels.width / srcW,
          height: croppedAreaPixels.height / srcH,
        },
      });
    } catch {
      // silencieux — l'appelant gère ses erreurs
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Modal
      open
      onClose={onCancel}
      title={LABELS[ratio].fr}
      size="md"
      persistent={processing}
    >
      {/* Zone de crop */}
      <div
        className="relative w-full overflow-hidden rounded-xl bg-black"
        style={{ height: ratio === "square" ? 300 : 220 }}
      >
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={RATIO_VALUES[ratio]}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
          style={{
            containerStyle: { borderRadius: "0.75rem" },
            cropAreaStyle: { border: "2px solid #D4A843" }, // gold
          }}
        />
      </div>

      {/* Zoom */}
      <div className="mt-4 flex items-center gap-3">
        <ZoomOut className="h-4 w-4 shrink-0 text-sage-muted" />
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="flex-1 accent-gold"
          aria-label="Zoom"
        />
        <ZoomIn className="h-4 w-4 shrink-0 text-sage-muted" />
        <span className="w-10 text-right text-xs font-mono text-sage">{zoom.toFixed(1)}×</span>
      </div>

      <ModalActions>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={processing}>
          Annuler
        </Button>
        <Button size="sm" onClick={handleConfirm} disabled={processing || !croppedAreaPixels}>
          {processing ? "Traitement…" : "Valider"}
        </Button>
      </ModalActions>
    </Modal>
  );
}
