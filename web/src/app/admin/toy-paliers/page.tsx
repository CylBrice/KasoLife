"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Save, Loader2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AmountInput } from "@/components/ui/amount-input";
import { api } from "@/lib/api";

interface Palier {
  palier: number;
  min: number;
  max: number;
  duration_s: number;
  intensity_min: number;
  intensity_max: number;
}

const DEFAULT_PALIERS: Palier[] = [
  { palier: 1, min: 1, max: 9, duration_s: 2, intensity_min: 20, intensity_max: 40 },
  { palier: 2, min: 10, max: 24, duration_s: 5, intensity_min: 40, intensity_max: 60 },
  { palier: 3, min: 25, max: 99, duration_s: 10, intensity_min: 60, intensity_max: 75 },
  { palier: 4, min: 100, max: 499, duration_s: 40, intensity_min: 75, intensity_max: 90 },
  { palier: 5, min: 500, max: 899, duration_s: 160, intensity_min: 80, intensity_max: 100 },
  { palier: 6, min: 900, max: 1299, duration_s: 380, intensity_min: 90, intensity_max: 100 },
  { palier: 7, min: 1300, max: 999999, duration_s: 600, intensity_min: 100, intensity_max: 100 },
];

export default function AdminToyPaliersPage() {
  const [paliers, setPaliers] = useState<Palier[]>(DEFAULT_PALIERS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [currentVersion, setCurrentVersion] = useState(1);

  useEffect(() => {
    loadPaliers();
  }, []);

  const loadPaliers = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/admin/toy-paliers");
      if (data.paliers && data.paliers.length > 0) {
        setPaliers(data.paliers);
        setCurrentVersion(data.current_version || 1);
      }
    } catch (err: any) {
      setError("Impossible de charger les paliers");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      await api.post("/admin/toy-paliers", { paliers });
      setSuccess("Paliers mis à jour avec succès");
      setCurrentVersion(currentVersion + 1);

      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const updatePalier = (index: number, field: keyof Palier, value: any) => {
    const updated = [...paliers];
    updated[index] = { ...updated[index], [field]: Number(value) };
    setPaliers(updated);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-medium text-cream">
          <Settings className="h-6 w-6 text-gold" /> Paliers de tips jouet
        </h1>
        <p className="mt-1 text-sm text-sage">
          Configurez les seuils tip → durée/intensité appliqués à tous les créateurs
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-brick/30 bg-brick/10 px-4 py-3 text-sm text-brick">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {success && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-400">
          ✓ {success}
        </div>
      )}

      {/* Version info */}
      <div className="rounded-xl border border-ink-line bg-ink-surface p-4">
        <p className="text-sm text-sage-muted">
          <span className="font-medium text-cream">Version courante:</span> {currentVersion}
        </p>
      </div>

      {/* Paliers table */}
      <div className="rounded-xl border border-ink-line bg-ink-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-line bg-ink-raised">
                <th className="px-4 py-3 text-left font-medium text-cream">Palier</th>
                <th className="px-4 py-3 text-left font-medium text-cream">Min (XAF)</th>
                <th className="px-4 py-3 text-left font-medium text-cream">Max (XAF)</th>
                <th className="px-4 py-3 text-left font-medium text-cream">Durée (s)</th>
                <th className="px-4 py-3 text-left font-medium text-cream">Intensité min (%)</th>
                <th className="px-4 py-3 text-left font-medium text-cream">Intensité max (%)</th>
              </tr>
            </thead>
            <tbody>
              {paliers.map((p, idx) => (
                <tr key={p.palier} className="border-b border-ink-line hover:bg-ink-raised/50">
                  <td className="px-4 py-3 text-cream font-medium">{p.palier}</td>
                  <td className="px-4 py-3">
                    <AmountInput value={p.min} onChange={(v) => updatePalier(idx, "min", String(v))} min={1} max={999999} step={1} />
                  </td>
                  <td className="px-4 py-3">
                    <AmountInput value={p.max} onChange={(v) => updatePalier(idx, "max", String(v))} min={1} max={999999} step={1} />
                  </td>
                  <td className="px-4 py-3">
                    <AmountInput value={p.duration_s} onChange={(v) => updatePalier(idx, "duration_s", String(v))} min={1} max={3600} step={5} />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={p.intensity_min}
                      onChange={(e) => updatePalier(idx, "intensity_min", e.target.value)}
                      className="w-full rounded-lg border border-ink-line bg-ink-surface px-2 py-1 font-mono text-sm text-cream focus:border-gold focus:outline-none"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={p.intensity_max}
                      onChange={(e) => updatePalier(idx, "intensity_max", e.target.value)}
                      className="w-full rounded-lg border border-ink-line bg-ink-surface px-2 py-1 font-mono text-sm text-cream focus:border-gold focus:outline-none"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Save button */}
      <div className="flex gap-3">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="flex-1"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Sauvegarde…
            </>
          ) : (
            <>
              <Save className="h-4 w-4" /> Sauvegarder les paliers
            </>
          )}
        </Button>
        <Button variant="outline" onClick={loadPaliers} disabled={loading || saving}>
          Réinitialiser
        </Button>
      </div>

      {/* Info */}
      <Card>
        <CardContent className="pt-4 text-sm text-sage-muted space-y-2">
          <p>
            <strong className="text-cream">Important:</strong> Les paliers sont appliqués à tous les créateurs.
            Les créateurs ne peuvent pas les modifier — c'est un mécanisme anti-abus.
          </p>
          <p>
            Lorsque vous sauvegardez, une nouvelle version est créée (pour audit trail).
            Le cache Redis est automatiquement invalidé.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
