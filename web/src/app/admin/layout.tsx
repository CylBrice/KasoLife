"use client";

import { useT } from "@/i18n/locale-context";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard, Users, Flag, TrendingUp, Settings,
} from "lucide-react";
import { DashboardShell, type NavItem } from "@/components/dashboard/dashboard-shell";
import { useAuth } from "@/contexts/auth-context";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const t = useT();
  const { user, loading } = useAuth();
  const router = useRouter();
  const isSuperAdmin = ["super_admin","root_admin"].includes(user?.role ?? '');

  const NAV_COMMON: NavItem[] = [
    { href: "/admin",             label: t("admin.dashboard"), icon: LayoutDashboard },
    { href: "/admin/communaute",  label: "Communauté",         icon: Users },
    { href: "/admin/moderation",  label: "Modération",         icon: Flag },
  ];

  const NAV_SUPER: NavItem[] = isSuperAdmin ? [
    { href: "/admin/finances",   label: "Finances",   icon: TrendingUp, superAdminOnly: true },
    { href: "/admin/plateforme", label: "Plateforme", icon: Settings,   superAdminOnly: true },
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
