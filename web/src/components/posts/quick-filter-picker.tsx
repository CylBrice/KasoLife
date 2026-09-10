"use client";

import { useEffect, useRef, useState } from "react";
import { Wand2, SkipForward, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FilterPreset {
  id: string;
  label: string;
  filter: string;
}

const PRESETS: FilterPreset[] = [
  { id: "none",  label: "Original", filter: "" },
  { id: "vivid", label: "Vivid",    filter: "saturate(1.6) contrast(1.1)" },
  { id: "warm",  label: "Warm",     filter: "sepia(0.35) saturate(1.3) brightness(1.05)" },
  { id: "mono",  label: "Mono",     filter: "grayscale(1)" },
  { id: "cool",  label: "Cool",     filter: "hue-rotate(20deg) saturate(0.85) brightness(1.05)" },
];

interface Props {
  file: File;
  onConfirm: (blob: Blob | File) => void;
  onCancel: () => void;
}

export function QuickFilterPicker({ file, onConfirm, onCancel }: Props) {
  const [selected, setSelected] = useState<string>("none");
  const [applying, setApplying] = useState(false);

  // Image bitmap chargée une fois pour toutes les miniatures
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);

  useEffect(() => {
    createImageBitmap(file).then(setBitmap);
  }, [file]);

  const handleApply = async () => {
    if (!bitmap) return;
    const preset = PRESETS.find((p) => p.id === selected)!;
    if (!preset.filter) {
      // Pas de filtre : renvoie le fichier original directement, pas de re-encodage
      onConfirm(file);
      return;
    }
    setApplying(true);
    const canvas = document.createElement("canvas");
    canvas.width  = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d")!;
    ctx.filter = preset.filter;
    ctx.drawImage(bitmap, 0, 0);
    canvas.toBlob(
      (blob) => { if (blob) onConfirm(blob); },
      "image/webp",
      0.88
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-ink-line bg-ink-surface p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-medium text-cream">Filtre photo</h2>
          <button onClick={onCancel} className="rounded p-1 text-sage hover:text-cream">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Prévisualisation principale */}
        <div className="mt-4 overflow-hidden rounded-xl border border-ink-line bg-ink-raised">
          {bitmap ? (
            <PreviewCanvas
              bitmap={bitmap}
              filter={PRESETS.find((p) => p.id === selected)?.filter ?? ""}
              className="aspect-video w-full object-contain"
            />
          ) : (
            <div className="flex aspect-video items-center justify-center text-sm text-sage-muted">
              Chargement…
            </div>
          )}
        </div>

        {/* Sélecteur de presets */}
        <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelected(p.id)}
              className={cn(
                "flex flex-col items-center gap-1.5 shrink-0",
              )}
            >
              <div
                className={cn(
                  "h-16 w-16 overflow-hidden rounded-xl border-2 transition-colors",
                  selected === p.id ? "border-brick" : "border-ink-line"
                )}
              >
                {bitmap ? (
                  <PreviewCanvas bitmap={bitmap} filter={p.filter} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full bg-ink-raised" />
                )}
              </div>
              <span className={cn("text-[11px]", selected === p.id ? "text-cream" : "text-sage-muted")}>
                {p.label}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-5 flex gap-2">
          <Button variant="ghost" onClick={onCancel} className="gap-1.5">
            <X className="h-4 w-4" /> Annuler
          </Button>
          <Button variant="ghost" onClick={() => onConfirm(file)} className="gap-1.5">
            <SkipForward className="h-4 w-4" /> Ignorer
          </Button>
          <Button onClick={handleApply} disabled={applying || !bitmap} className="flex-1 gap-1.5">
            <Wand2 className="h-4 w-4" /> Appliquer
          </Button>
        </div>
      </div>
    </div>
  );
}

// Composant canvas inline pour éviter de recréer le bitmap à chaque rendu
function PreviewCanvas({
  bitmap,
  filter,
  className,
}: {
  bitmap: ImageBitmap;
  filter: string;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width  = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d")!;
    ctx.filter = filter || "none";
    ctx.drawImage(bitmap, 0, 0);
  }, [bitmap, filter]);

  return <canvas ref={canvasRef} className={className} />;
}
