"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LayoutDashboard, FileText, Users, Wallet, Film } from "lucide-react";
import { DashboardShell, type NavItem } from "@/components/dashboard/dashboard-shell";
import { useAuth } from "@/contexts/auth-context";

const NAV: NavItem[] = [
  { href: "/createur", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/createur/posts", label: "Publications", icon: FileText },
  { href: "/createur/abonnes", label: "Abonnés", icon: Users },
  { href: "/createur/editeur", label: "Studio vidéo", icon: Film },
  { href: "/wallet", label: "Wallet", icon: Wallet },
];

export default function CreateurLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) { router.push("/connexion"); return; }
    if (!["influencer","admin","super_admin","root_admin"].includes(user.role) && !["admin","super_admin","root_admin"].includes(user.role)) {
      router.push("/devenir-createur");
    }
  }, [loading, user, router]);

  if (loading || !user) return null;

  return <DashboardShell navItems={NAV}>{children}</DashboardShell>;
}
