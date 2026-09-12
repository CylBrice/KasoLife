"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SubTabs } from "@/components/admin/sub-tabs";
import { useAuth } from "@/contexts/auth-context";
import RevenusPage from "@/app/admin/revenus/page";
import RetraitsPage from "@/app/admin/retraits/page";
import BonusPage from "@/app/admin/bonus/page";

type Tab = "revenus" | "retraits" | "bonus";

const TABS = [
  { key: "revenus",  label: "Revenus" },
  { key: "retraits", label: "Retraits" },
  { key: "bonus",    label: "Bonus bienvenue" },
];

export default function FinancesPage() {
  const [tab, setTab] = useState<Tab>("revenus");
  const { user, loading } = useAuth();
  const router = useRouter();
  const isSuperAdmin = ["super_admin", "root_admin"].includes(user?.role ?? "");

  useEffect(() => {
    if (!loading && !isSuperAdmin) router.replace("/admin");
  }, [loading, isSuperAdmin, router]);

  if (loading || !isSuperAdmin) return null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-medium text-cream">Finances</h1>
        <p className="mt-1 text-sm text-sage">Revenus, retraits et bonus — accès Super Admin uniquement.</p>
      </div>

      <SubTabs tabs={TABS} active={tab} onChange={(k) => setTab(k as Tab)} />

      {tab === "revenus"  && <RevenusPage />}
      {tab === "retraits" && <RetraitsPage />}
      {tab === "bonus"    && <BonusPage />}
    </div>
  );
}
