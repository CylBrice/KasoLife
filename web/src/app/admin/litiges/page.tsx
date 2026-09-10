"use client";

// Page admin : résolution des litiges custom requests
import { useEffect, useState, useCallback } from "react";
import { AlertTriangle, CheckCircle, Loader2, RefreshCw, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatFCFA, formatRelativeDate } from "@/lib/utils";
import { api } from "@/lib/api";

interface Dispute {
  id: string;
  fan_id: string;
  creator_id: string;
  fan_pseudo: string;
  creator_pseudo: string;
  description: string;
  budget_xcon: number;
  agreed_price_xcon: number;
  dispute_reason: string;
  disputed_by: string;
  created_at: string;
}

export default function AdminLitigesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading]   = useState(true);
  const [acting, setActing]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/custom-requests/admin/disputes");
      setDisputes(data.disputes || []);
    } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const resolve = async (id: string, refundFan: boolean) => {
    const resolution = prompt(refundFan ? "Motif du remboursement :" : "Motif du paiement créateur :");
    if (!resolution?.trim()) return;
    setActing(id);
    try {
      await api.post(`/custom-requests/admin/${id}/resolve`, {
        resolution,
        refund_fan: refundFan,
      });
      load();
    } catch (e: any) {
      alert(e?.response?.data?.error || "Erreur");
    } finally { setActing(null); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-medium text-cream flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-brick" />
            Litiges custom requests
          </h2>
          <p className="text-sm text-sage-muted mt-0.5">
            Résolution manuelle — rembourser le fan ou payer le créateur
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gold" /></div>
      ) : disputes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-line py-14 text-center">
          <CheckCircle className="mx-auto mb-3 h-8 w-8 text-emerald-400" />
          <p className="text-sage-muted text-sm">Aucun litige en cours</p>
        </div>
      ) : (
        <div className="space-y-4">
          {disputes.map(d => (
            <div key={d.id} className="rounded-xl border border-brick/20 bg-brick/5 p-5 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-cream">
                    @{d.fan_pseudo} → @{d.creator_pseudo}
                  </p>
                  <p className="text-xs text-sage-muted">{formatRelativeDate(d.created_at)}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm text-gold">{formatFCFA(d.agreed_price_xcon || d.budget_xcon)}</p>
                  <p className="text-xs text-sage-muted">Montant bloqué</p>
                </div>
              </div>

              <div className="rounded-xl border border-ink-line bg-ink-raised p-3 text-sm text-sage">
                <p className="text-xs font-medium text-sage-muted mb-1">Demande originale</p>
                {d.description}
              </div>

              <div className="rounded-xl border border-brick/20 bg-brick/10 p-3">
                <p className="text-xs font-medium text-brick mb-1">
                  Motif du litige — signalé par : {d.disputed_by === 'fan' ? 'Fan' : 'Créateur'}
                </p>
                <p className="text-sm text-sage">{d.dispute_reason}</p>
              </div>

              <div className="flex gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 border-brick/40 text-brick hover:bg-brick/10"
                  onClick={() => resolve(d.id, true)}
                  disabled={acting === d.id}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Rembourser le fan
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => resolve(d.id, false)}
                  disabled={acting === d.id}
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  Payer le créateur
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
