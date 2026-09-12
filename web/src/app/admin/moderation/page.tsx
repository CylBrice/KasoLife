"use client";

import { useState } from "react";
import { SubTabs } from "@/components/admin/sub-tabs";
import SignalementsPage from "@/app/admin/signalements/page";
import FraudePage from "@/app/admin/fraude/page";

type Tab = "signalements" | "fraude";

const TABS = [
  { key: "signalements", label: "Signalements" },
  { key: "fraude",       label: "Fraude" },
];

export default function ModerationPage() {
  const [tab, setTab] = useState<Tab>("signalements");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-medium text-cream">Modération</h1>
        <p className="mt-1 text-sm text-sage">Signalements de contenu et alertes de fraude.</p>
      </div>

      <SubTabs tabs={TABS} active={tab} onChange={(k) => setTab(k as Tab)} />

      {tab === "signalements" && <SignalementsPage />}
      {tab === "fraude"       && <FraudePage />}
    </div>
  );
}
