"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard, Images, Users, Wallet, Film, Cast, Video,
  Crown, Camera, Zap, TrendingUp, MessageSquarePlus, Sparkles,
  MonitorPlay, Layers,
} from "lucide-react";
import { DashboardShell, type NavItem } from "@/components/dashboard/dashboard-shell";
import { useAuth } from "@/contexts/auth-context";
import { useT } from "@/i18n/locale-context";

export default function CreateurLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const t = useT();

  const NAV: NavItem[] = [
    { href: "/createur",                  label: "Tableau de bord",    icon: LayoutDashboard },
    { href: "/createur/posts",            label: "Publications",        icon: Images },
    { href: "/createur/editeur",          label: "Studio vidéo",        icon: Film },
    { href: "/createur/snapshots",        label: "Snapshots",           icon: Camera },
    { href: "/createur/live",             label: "Streamcast",          icon: Cast },
    { href: "/createur/private-chat",     label: "Private Chat",        icon: Video },
    { href: "/createur/private-shows",    label: "Private Shows",       icon: MonitorPlay },
    { href: "/createur/vip-shows",        label: "VIP Shows",           icon: Crown },
    { href: "/createur/custom-requests",  label: "Custom requests",     icon: MessageSquarePlus },
    { href: "/createur/jouets",           label: "Jouets interactifs",  icon: Zap },
    { href: "/abonnements",               label: "Abonnements",         icon: Layers },
    { href: "/createur/abonnes",          label: "Abonnés",             icon: Users },
    { href: "/createur/gains",            label: "Mes gains",           icon: TrendingUp },
    { href: "/wallet",                    label: t("nav.wallet"),       icon: Wallet },
    { href: "/createur/onboarding",       label: "Guide démarrage",     icon: Sparkles },
  ];

  useEffect(() => {
    if (loading) return;
    if (!user) { router.push("/connexion"); return; }
    if (!["influencer","admin","super_admin","root_admin"].includes(user.role)) {
      router.push("/devenir-createur");
    }
  }, [loading, user, router]);

  if (loading || !user) return null;

  return (
    <DashboardShell
      navItems={NAV}
      defaultCollapsed={true}
      storageKey="kl_creator_collapsed"
    >
      {children}
    </DashboardShell>
  );
}
