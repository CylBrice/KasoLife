"use client";

import { useState } from "react";
import { SubTabs } from "@/components/admin/sub-tabs";
import { useAuth } from "@/contexts/auth-context";
import { Lock } from "lucide-react";
import UtilisateursPage from "@/app/admin/utilisateurs/page";
import CandidaturesPage from "@/app/admin/candidatures/page";
import SupportPage from "@/app/admin/support/page";
import LitigesPage from "@/app/admin/litiges/page";

type Tab = "utilisateurs" | "candidatures" | "support" | "litiges";

const TABS = [
  { key: "utilisateurs",  label: "Utilisateurs" },
  { key: "candidatures",  label: "Candidatures" },
  { key: "support",       label: "Support" },
  { key: "litiges",       label: "Litiges" },
];

export default function CommunautePage() {
  const [tab, setTab] = useState<Tab>("utilisateurs");
  const { user } = useAuth();
  const isSuperAdmin = ["super_admin", "root_admin"].includes(user?.role ?? "");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-medium text-cream">Communauté</h1>
        <p className="mt-1 text-sm text-sage">Utilisateurs, candidatures, support et litiges.</p>
      </div>

      <SubTabs tabs={TABS} active={tab} onChange={(k) => setTab(k as Tab)} />

      {tab === "utilisateurs"  && <UtilisateursPage />}
      {tab === "candidatures"  && <CandidaturesPage />}
      {tab === "support"       && <SupportPage />}
      {tab === "litiges"       && (
        isSuperAdmin ? <LitigesPage /> : (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-ink-line py-20 text-center">
            <Lock className="h-8 w-8 text-sage-muted" />
            <p className="font-display text-lg text-cream">Accès restreint</p>
            <p className="text-sm text-sage-muted">La résolution de litiges est réservée aux Super Admin et Root Admin.</p>
          </div>
        )
      )}
    </div>
  );
}
