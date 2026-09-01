"use client";

import { useT } from "@/i18n/locale-context";

import { useEffect, useState } from "react";
import { ShieldAlert, Check, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatFCFA, formatRelativeDate } from "@/lib/utils";
import { api } from "@/lib/api";
import { SubTabs } from "@/components/admin/sub-tabs";

interface FraudFlag {
  id: string;
  user_id: string;
  flag_type: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  details: Record<string, any>;
  status: string;
  created_at: string;
  user?: { pseudo: string; kyc_status: string; created_at: string };
}

const SEVERITY_VARIANT: Record<string, "default" | "gold" | "coral"> = {
  LOW: "default",
  MEDIUM: "gold",
  HIGH: "coral",
  CRITICAL: "coral",
};

const TYPE_LABELS: Record<string, string> = {
  RAPID_DEPOSIT_WITHDRAW: "Dépôt suivi d'un retrait rapide",
  REFERRAL_ABUSE: "Abus du programme de parrainage",
  LINKED_ACCOUNTS: "Comptes liés (même Mobile Money)",
};

export default function AdminFraudePage() {
  const t = useT();
  const [tab, setTab] = useState<"pending"|"reviewed">("pending");
  const [flags, setFlags] = useState<FraudFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = (t = tab) => {
    const status = t === "pending" ? "PENDING" : "REVIEWED";
    api.get(`/admin/fraud-flags?status=${status}`)
      .then(({ data }) => setFlags(data || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(tab); }, [tab]); // eslint-disable-line

  const handleReview = async (id: string, action: "DISMISS" | "ACTION") => {
    setError(null);
    try {
      await api.post(`/admin/fraud-flags/${id}/review`, { action });
      setFlags((prev) => prev.filter((f) => f.id !== id));
    } catch (err: any) {
      setError(err?.response?.data?.error || "Erreur.");
    }
  };

  const renderDetails = (flag: FraudFlag) => {
    const d = flag.details || {};
    switch (flag.flag_type) {
      case "RAPID_DEPOSIT_WITHDRAW":
        return (
          <p className="text-sm text-cream">
            Dépôt de {formatFCFA(d.deposit_amount)} suivi d&apos;un retrait de{" "}
            {formatFCFA(d.withdrawal_amount)} après seulement {d.gap_minutes} min.
          </p>
        );
      case "REFERRAL_ABUSE":
        return (
          <p className="text-sm text-cream">
            {d.referrals_last_24h} filleuls inscrits en 24h (seuil normal : {d.threshold}).
          </p>
        );
      case "LINKED_ACCOUNTS":
        return (
          <p className="text-sm text-cream">
            Numéro {d.operator} partagé avec {d.shared_with_count} autre(s) compte(s).
          </p>
        );
      default:
        return <p className="text-sm text-cream">{JSON.stringify(d)}</p>;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-medium text-cream">{t("admin.fraud")}</h1>
        <p className="mt-1 text-sm text-sage" style={{display:"none"}}>
          Anomalies détectées automatiquement sur les transactions et comptes (toutes les 30 minutes).
        </p>
        <p className="mt-1 text-sm text-sage">Anomalies détectées automatiquement.</p>
      </div>
      <SubTabs tabs={[
        { key: "pending",  label: "⏳ En attente", badge: flags.filter(f => f.status === "PENDING").length },
        { key: "reviewed", label: "✅ Traités" },
      ]} active={tab} onChange={(k) => setTab(k as any)} />

      {error && <p className="text-sm text-brick">{error}</p>}

      {loading ? (
        <p className="text-sm text-sage-muted">{t("common.loading")}</p>
      ) : flags.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-line px-6 py-16 text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-sage-muted" />
          <p className="mt-2 font-display text-lg text-cream">{t("common.comingSoon")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {flags.map((flag) => (
            <Card key={flag.id}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-display text-lg text-cream">@{flag.user?.pseudo}</p>
                    <p className="text-sm text-sage">
                      {TYPE_LABELS[flag.flag_type] || flag.flag_type} · {formatRelativeDate(flag.created_at)}
                    </p>
                  </div>
                  <Badge variant={SEVERITY_VARIANT[flag.severity] || "default"}>{flag.severity}</Badge>
                </div>

                <div className="mt-2">{renderDetails(flag)}</div>

                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => handleReview(flag.id, "DISMISS")}>
                    <X className="h-4 w-4" /> Ignorer
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => handleReview(flag.id, "ACTION")}>
                    <Check className="h-4 w-4" /> Marquer comme traité (action prise)
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
