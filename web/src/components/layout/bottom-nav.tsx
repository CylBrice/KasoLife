"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Layers, MessageSquare, Wallet, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/locale-context";
import { useUnreadMessages } from "@/contexts/unread-messages-context";

const ITEMS = [
  { href: "/",            key: "nav.discover",      icon: Compass },
  { href: "/abonnements", key: "nav.subscriptions", icon: Layers },
  { href: "/messages",    key: "nav.messages",      icon: MessageSquare },
  { href: "/wallet",      key: "nav.wallet",        icon: Wallet },
  { href: "/profil",      key: "nav.profile",       icon: User },
] as const;

const HIDDEN_ROUTES = ["/connexion", "/inscription", "/admin", "/createur"];

export function BottomNav() {
  const pathname = usePathname();
  const t = useT();
  const { unreadCount } = useUnreadMessages();

  const hidden = HIDDEN_ROUTES.some((r) => pathname.startsWith(r));
  if (hidden) return null;

  return (
    <nav className="border-t border-ink-line bg-ink/95 backdrop-blur-md md:hidden">
      <div className="flex h-16 items-center">
        {ITEMS.map(({ href, key, icon: Icon }) => {
          const active = pathname === href;
          const isMessages = href === "/messages";
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex flex-1 flex-col items-center justify-center gap-1 py-1 text-xs",
                active ? "text-gold" : "text-sage-muted"
              )}
            >
              <div className="relative">
                <Icon className="h-5 w-5" />
                {isMessages && unreadCount > 0 && (
                  <span className="absolute -right-2 -top-2 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-brick px-1 text-[10px] font-bold text-white border-2 border-ink">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </div>
              {t(key)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
