"use client";

import { useT } from "@/i18n/locale-context";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard, UserCheck, Flag, Banknote, Users, SlidersHorizontal,
  Cpu, ShieldAlert, Settings, TrendingUp, Crown, ClipboardList, MessageSquare,
} from "lucide-react";
import { DashboardShell, type NavItem } from "@/components/dashboard/dashboard-shell";
import { useAuth } from "@/contexts/auth-context";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const t = useT();
  const { user, loading } = useAuth();
  const router = useRouter();
  const isSuperAdmin = ["super_admin","root_admin"].includes(user?.role);

  /* ── Onglets communs ADMIN + SUPERADMIN ── */
  const NAV_COMMON: NavItem[] = [
    { href: "/admin",              label: "📊 " + t("admin.dashboard"),    icon: LayoutDashboard },
    { href: "/admin/candidatures", label: "✅ " + t("admin.applications"), icon: UserCheck },
    { href: "/admin/signalements", label: "🚩 " + t("admin.reports"),      icon: Flag },
    { href: "/admin/fraude",       label: "🛡️ " + t("admin.fraud"),        icon: ShieldAlert },
    { href: "/admin/retraits",     label: "💸 " + t("admin.payouts"),      icon: Banknote },
    { href: "/admin/utilisateurs", label: "👥 " + t("admin.users"),        icon: Users },
    { href: "/admin/ia",           label: "🤖 IA",                         icon: Cpu },
    { href: "/admin/maintenance",  label: "🔧 Maintenances",               icon: Settings },
  ];

  /* ── Onglets exclusifs SUPERADMIN ── */
  const NAV_SUPER: NavItem[] = isSuperAdmin ? [
    { href: "/admin/revenus",       label: "💰 Finances",          icon: TrendingUp,        superAdminOnly: true },
    { href: "/admin/support",       label: "💬 Support",           icon: MessageSquare,     superAdminOnly: true },
    { href: "/admin/admins",        label: "👮 " + t("admin.admins"),  icon: Crown,         superAdminOnly: true },
    { href: "/admin/configuration", label: "⚙️ Config",            icon: SlidersHorizontal, superAdminOnly: true },
    { href: "/admin/audit",         label: "📋 " + t("admin.audit"), icon: ClipboardList,   superAdminOnly: true },
  ] : [];

  const NAV: NavItem[] = [...NAV_COMMON, ...NAV_SUPER];

  useEffect(() => {
    if (loading) return;
    if (!user) { router.push("/connexion"); return; }
    if (!["admin","super_admin","root_admin"].includes(user.role)) router.push("/");
  }, [loading, user, router]);

  if (loading || !user || (!["admin","super_admin","root_admin"].includes(user.role))) return null;

  return <DashboardShell navItems={NAV} isSuperAdmin={isSuperAdmin}>{children}</DashboardShell>;
}
