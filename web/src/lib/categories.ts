import {
  Dumbbell, Music, GraduationCap, Palette, ChefHat, Shirt, Gamepad2, Briefcase,
  type LucideIcon,
} from "lucide-react";

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  fitness: Dumbbell,
  musique: Music,
  coaching: GraduationCap,
  art: Palette,
  cuisine: ChefHat,
  mode: Shirt,
  gaming: Gamepad2,
  business: Briefcase,
};

export function getCategoryIcon(slug: string): LucideIcon {
  return CATEGORY_ICONS[slug] || Palette;
}
