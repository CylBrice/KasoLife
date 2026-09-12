"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SubTabs } from "@/components/admin/sub-tabs";
import { useAuth } from "@/contexts/auth-context";
import ConfigurationPage from "@/app/admin/configuration/page";
import IAPage from "@/app/admin/ia/page";
import MaintenancePage from "@/app/admin/maintenance/page";
import PrivateShowsPage from "@/app/admin/private-shows/page";
import ToyPaliersPage from "@/app/admin/toy-paliers/page";
import AdminsPage from "@/app/admin/admins/page";
import AuditPage from "@/app/admin/audit/page";
import AiCostsSection from "./_ai-costs";

type Tab = "configuration" | "ia" | "maintenance" | "contenus" | "equipe" | "audit" | "couts-ia";

const TABS_COMMON = [
  { key: "ia",          label: "IA" },
  { key: "maintenance", label: "Maintenance" },
  { key: "contenus",    label: "Contenus" },
  { key: "audit",       label: "Audit" },
];

const TABS_SUPER = [
  { key: "configuration", label: "Configuration" },
  { key: "equipe",        label: "Équipe" },
  { key: "couts-ia",      label: "Coûts IA" },
];

export default function PlatefomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const isSuperAdmin = ["super_admin", "root_admin"].includes(user?.role ?? "");

  const TABS = isSuperAdmin
    ? [TABS_SUPER[0], ...TABS_COMMON, TABS_SUPER[1], TABS_SUPER[2]]
    : TABS_COMMON;

  const [tab, setTab] = useState<Tab>(isSuperAdmin ? "configuration" : "ia");

  useEffect(() => {
    if (!loading && !["admin", "super_admin", "root_admin"].includes(user?.role ?? "")) {
      router.replace("/admin");
    }
  }, [loading, user, router]);

  if (loading || !user) return null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-medium text-cream">Plateforme</h1>
        <p className="mt-1 text-sm text-sage">Configuration, IA, maintenance et gestion de l&apos;équipe.</p>
      </div>

      <SubTabs tabs={TABS} active={tab} onChange={(k) => setTab(k as Tab)} />

      {tab === "configuration" && isSuperAdmin && <ConfigurationPage />}
      {tab === "ia"            && <IAPage />}
      {tab === "maintenance"   && <MaintenancePage />}
      {tab === "contenus"      && (
        <div className="flex flex-col gap-8">
          <PrivateShowsPage />
          <ToyPaliersPage />
        </div>
      )}
      {tab === "equipe"   && isSuperAdmin && <AdminsPage />}
      {tab === "audit"    && <AuditPage />}
      {tab === "couts-ia" && isSuperAdmin && <AiCostsSection />}
    </div>
  );
}
