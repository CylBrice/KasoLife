"use client";

import { useEffect, useState } from "react";
import { Check, X, BadgeCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRelativeDate } from "@/lib/utils";
import { api } from "@/lib/api";
import { SubTabs } from "@/components/admin/sub-tabs";
import type { CreatorApplication } from "@/types";

export default function AdminCandidaturesPage() {
  const [applications, setApplications] = useState<CreatorApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<"pending"|"approved"|"rejected">("pending");

  const load = (t = tab) => {
    const status = t === "pending" ? "PENDING" : t === "approved" ? "APPROVED" : "REJECTED";
    api.get(`/admin/creator-applications?status=${status}`)
      .then(({ data }) => setApplications(data || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(tab); }, [tab]); // eslint-disable-line

  const handleApprove = async (id: string) => {
    setError(null);
    try {
      await api.post(`/admin/creator-applications/${id}/approve`);
      setApplications((prev) => prev.filter((a) => a.id !== id));
    } catch (err: any) {
      setError(err?.response?.data?.error || "Erreur lors de l'approbation.");
    }
  };

  const handleReject = async (id: string) => {
    if (rejectReason.trim().length < 5) {
      setError("Motif de rejet requis (min. 5 caractères).");
      return;
    }
    setError(null);
    try {
      await api.post(`/admin/creator-applications/${id}/reject`, { reason: rejectReason.trim() });
      setApplications((prev) => prev.filter((a) => a.id !== id));
      setRejectingId(null);
      setRejectReason("");
    } catch (err: any) {
      setError(err?.response?.data?.error || "Erreur lors du rejet.");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-medium text-cream">Candidatures créateur</h1>
        <p className="mt-1 text-sm text-sage">Candidatures en attente de validation.</p>
      </div>

      {error && <p className="text-sm text-brick">{error}</p>}

      {loading ? (
        <p className="text-sm text-sage-muted">Chargement...</p>
      ) : applications.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-line px-6 py-16 text-center">
          <p className="font-display text-lg text-cream">Aucune candidature en attente</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {applications.map((app) => {
            let motivation = "";
            try {
              const parsed = JSON.parse(app.motivation || "{}");
              motivation = parsed.text || "";
            } catch {
              motivation = app.motivation || "";
            }
            const kycVerified = app.user?.kyc_status === "VERIFIED";

            return (
              <Card key={app.id}>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-display text-lg text-cream">{app.display_name}</p>
                      <p className="text-sm text-sage">
                        @{app.user?.pseudo} · {app.category?.name} · {formatRelativeDate(app.created_at)}
                      </p>
                    </div>
                    <Badge variant={kycVerified ? "emerald" : "coral"}>
                      <BadgeCheck className="h-3 w-3" />
                      KYC {kycVerified ? "vérifié" : "non vérifié"}
                    </Badge>
                  </div>

                  {motivation && <p className="mt-2 text-sm text-cream">{motivation}</p>}

                  {rejectingId === app.id ? (
                    <div className="mt-3 flex flex-col gap-2">
                      <textarea
                        className="min-h-16 rounded-xl border border-ink-line bg-ink-raised px-3 py-2 text-sm text-cream placeholder:text-sage-muted focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
                        placeholder="Motif du rejet (min. 5 caractères)"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => { setRejectingId(null); setRejectReason(""); }}>
                          Annuler
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => handleReject(app.id)}>
                          Confirmer le rejet
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        variant="success"
                        disabled={!kycVerified}
                        onClick={() => handleApprove(app.id)}
                        title={!kycVerified ? "KYC non vérifié" : undefined}
                      >
                        <Check className="h-4 w-4" /> Approuver
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => setRejectingId(app.id)}>
                        <X className="h-4 w-4" /> Rejeter
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
