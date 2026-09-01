"use client";

import { useEffect, useState } from "react";
import { Check, X, Banknote } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatFCFA, formatRelativeDate } from "@/lib/utils";
import { api } from "@/lib/api";
import { SubTabs } from "@/components/admin/sub-tabs";
import type { Payout } from "@/types";

export default function AdminRetraitsPage() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<"pending"|"approved"|"rejected">("pending");

  const load = (t = tab) => {
    const status = t === "pending" ? "PENDING" : t === "approved" ? "APPROVED" : "REJECTED";
    api.get(`/admin/payouts?status=${status}`)
      .then(({ data }) => setPayouts(data || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(tab); }, [tab]); // eslint-disable-line

  const handleApprove = async (id: string) => {
    const ref = prompt("Référence de la transaction Mobile Money (optionnel) :") || undefined;
    setError(null);
    try {
      await api.post(`/admin/payouts/${id}/approve`, { gateway_ref: ref });
      setPayouts((prev) => prev.filter((p) => p.id !== id));
    } catch (err: any) {
      setError(err?.response?.data?.error || "Erreur.");
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt("Motif du rejet (min. 5 caractères) :");
    if (!reason || reason.trim().length < 5) return;
    setError(null);
    try {
      await api.post(`/admin/payouts/${id}/reject`, { reason: reason.trim() });
      setPayouts((prev) => prev.filter((p) => p.id !== id));
    } catch (err: any) {
      setError(err?.response?.data?.error || "Erreur.");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-medium text-cream">Retraits créateurs</h1>
        <p className="mt-1 text-sm text-sage">Demandes de retrait en attente de validation.</p>
      </div>

      {error && <p className="text-sm text-brick">{error}</p>}

      {loading ? (
        <p className="text-sm text-sage-muted">Chargement...</p>
      ) : payouts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-line px-6 py-16 text-center">
          <Banknote className="mx-auto h-8 w-8 text-sage-muted" />
          <p className="mt-2 font-display text-lg text-cream">Aucune demande en attente</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {payouts.map((payout) => {
            const kycVerified = payout.creator?.kyc_status === "VERIFIED";
            return (
              <Card key={payout.id}>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-display text-lg text-cream">@{payout.creator?.pseudo}</p>
                      <p className="text-sm text-sage">
                        {payout.operator} · {payout.phone} · {formatRelativeDate(payout.created_at)}
                      </p>
                    </div>
                    <Badge variant={kycVerified ? "emerald" : "coral"}>
                      KYC {kycVerified ? "vérifié" : "non vérifié"}
                    </Badge>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-sage-muted">Montant brut</p>
                      <p className="font-mono tabular text-cream">{formatFCFA(payout.amount_xcon)}</p>
                    </div>
                    <div>
                      <p className="text-sage-muted">Commission (1,5%)</p>
                      <p className="font-mono tabular text-cream">{formatFCFA(payout.commission_xcon)}</p>
                    </div>
                    <div>
                      <p className="text-sage-muted">À verser</p>
                      <p className="font-mono tabular text-gold-bright">{formatFCFA(payout.net_amount_xcon)}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="success" onClick={() => handleApprove(payout.id)}>
                      <Check className="h-4 w-4" /> Approuver et marquer payé
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => handleReject(payout.id)}>
                      <X className="h-4 w-4" /> Rejeter
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
