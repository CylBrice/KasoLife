"use client";

import { useEffect, useState } from "react";
import { Cpu, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { fmtNum } from "@/lib/utils";
import { api } from "@/lib/api";

export default function AiCostsSection() {
  const [aiCosts, setAiCosts] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get("/admin/ai-costs")
      .then(({ data }) => setAiCosts(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-sage-muted">Chargement...</p>;
  if (!aiCosts)  return <p className="text-sm text-brick">Données indisponibles.</p>;

  return (
    <div className="flex flex-col gap-4">
      {aiCosts.alert && (
        <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
          aiCosts.alert.level === "red"
            ? "border-brick/30 bg-brick/10 text-brick"
            : "border-gold/30 bg-gold/10 text-gold-bright"
        }`}>
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {aiCosts.alert.message}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Aujourd'hui", data: aiCosts.day },
          { label: "7 jours",     data: aiCosts.week },
          { label: "Ce mois",     data: aiCosts.month },
          { label: "Cette année", data: aiCosts.year },
        ].map(({ label, data }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <Cpu className="h-4 w-4 text-sage-muted" />
              <p className="mt-2 font-mono text-lg tabular text-cream">
                ${data?.cost_usd?.toFixed(4) || "0.0000"}
              </p>
              <p className="text-xs text-sage-muted">{label}</p>
              <p className="text-xs text-sage-muted">{fmtNum(data?.count || 0)} appel(s)</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-5">
          <p className="mb-1 text-sm font-medium text-cream">Tokens consommés ce mois</p>
          <div className="flex gap-6 text-sm">
            <div>
              <p className="text-sage-muted">Entrée</p>
              <p className="font-mono text-cream">{fmtNum(aiCosts.month?.input_tokens || 0)}</p>
            </div>
            <div>
              <p className="text-sage-muted">Sortie</p>
              <p className="font-mono text-cream">{fmtNum(aiCosts.month?.output_tokens || 0)}</p>
            </div>
            <div>
              <p className="text-sage-muted">Seuil d&apos;alerte</p>
              <p className="font-mono text-cream">${aiCosts.threshold_usd || 10}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {aiCosts.dailyCurve?.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <p className="mb-3 text-sm font-medium text-cream">Courbe de dépenses (30 derniers jours)</p>
            <div className="flex items-end gap-1 h-24">
              {aiCosts.dailyCurve.map((d: any, i: number) => {
                const maxCost = Math.max(...aiCosts.dailyCurve.map((x: any) => x.cost_usd || 0), 0.0001);
                const pct = Math.round(((d.cost_usd || 0) / maxCost) * 100);
                return (
                  <div key={i} className="group relative flex flex-1 flex-col items-center">
                    <div
                      className="w-full rounded-t bg-gold/60 hover:bg-gold transition-colors"
                      style={{ height: `${Math.max(pct, 2)}%` }}
                      title={`${d.date}: $${d.cost_usd?.toFixed(4)}`}
                    />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
