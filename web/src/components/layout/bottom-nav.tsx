"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Layers, MessageSquare, Wallet, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/locale-context";

const ITEMS = [
  { href: "/",            key: "nav.discover",      icon: Compass },
  { href: "/abonnements", key: "nav.subscriptions", icon: Layers },
  { href: "/messages",    key: "nav.messages",      icon: MessageSquare },
  { href: "/wallet",      key: "nav.wallet",        icon: Wallet },
  { href: "/profil",      key: "nav.profile",       icon: User },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const t = useT();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-line bg-ink/95 backdrop-blur-md md:hidden">
      <div className="flex h-16 items-center">
        {ITEMS.map(({ href, key, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 py-1 text-xs",
                active ? "text-gold" : "text-sage-muted"
              )}
            >
              <Icon className="h-5 w-5" />
              {t(key)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
