import Link from "next/link";
import Image from "next/image";
import { BadgeCheck, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatFCFA, cn } from "@/lib/utils";
import { getCategoryIcon } from "@/lib/categories";
import type { CreatorSummary } from "@/types";

export function CreatorCard({ creator }: { creator: CreatorSummary }) {
  const Icon = creator.category ? getCategoryIcon(creator.category.slug) : null;
  const banner = creator.user?.banner_url;

  return (
    <Link
      href={`/createurs/${creator.user?.pseudo}`}
      className="group block overflow-hidden rounded-2xl border border-ink-line bg-ink-surface transition-transform hover:-translate-y-1"
    >
      {/* Bannière avec voile de tissage — signature visuelle */}
      <div className="lock-overlay relative aspect-[4/3] w-full bg-ink-raised">
        {banner ? (
          <Image
            src={banner}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 768px) 50vw, 300px"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-emerald/30 to-gold/20" />
        )}
        {creator.category && Icon && (
          <div className="absolute left-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-ink/70 backdrop-blur-sm">
            <Icon className="h-4 w-4 text-gold" />
          </div>
        )}
        {creator.is_verified_badge && (
          <div className="absolute right-3 top-3 z-10">
            <BadgeCheck className="h-5 w-5 text-gold drop-shadow" />
          </div>
        )}
      </div>

      <div className="flex items-start gap-3 p-3">
        <div className="relative -mt-8 h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 border-ink-surface bg-ink-raised">
          {creator.user?.avatar_url ? (
            <Image
              src={creator.user.avatar_url}
              alt={creator.display_name}
              fill
              className="object-cover"
              sizes="56px"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-display text-lg text-gold">
              {creator.display_name?.[0]?.toUpperCase()}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 pt-1">
          <p className="truncate font-display text-base font-medium text-cream">
            {creator.display_name}
          </p>
          <p className="truncate text-sm text-sage">@{creator.user?.pseudo}</p>
          <div className="mt-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1 text-xs text-sage-muted">
              <Users className="h-3 w-3" />
              {creator.subscribers_count}
            </span>
            <span className="font-mono text-sm tabular text-gold-bright">
              {formatFCFA(creator.subscription_price_xcon)}
              <span className="text-sage-muted">/30j</span>
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
