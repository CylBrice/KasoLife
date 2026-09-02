import { cn } from "@/lib/utils";

interface UserAvatarProps {
  src?: string | null;
  pseudo?: string | null;
  name?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

const SIZE_MAP = {
  xs: "h-7  w-7  text-xs",
  sm: "h-8  w-8  text-sm",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-16 w-16 text-xl",
};

/**
 * Affiche l'avatar R2 d'un utilisateur.
 * Fallback : initiale de son pseudo/nom sur fond gold.
 */
export function UserAvatar({ src, pseudo, name, size = "md", className }: UserAvatarProps) {
  const initial = ((pseudo || name || "?")[0] || "?").toUpperCase();
  const cls = cn("shrink-0 rounded-full overflow-hidden object-cover", SIZE_MAP[size], className);

  if (src) {
    return (
      <img
        src={src}
        alt={pseudo || name || "avatar"}
        className={cls}
        onError={(e) => {
          // Si l'image échoue, on affiche l'initiale
          const target = e.currentTarget as HTMLImageElement;
          target.style.display = "none";
          target.nextElementSibling?.removeAttribute("hidden");
        }}
      />
    );
  }

  return (
    <div className={cn(
      "shrink-0 rounded-full flex items-center justify-center bg-gold/20 font-bold text-gold-bright",
      SIZE_MAP[size], className,
    )}>
      {initial}
    </div>
  );
}
