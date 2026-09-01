import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "bg-ink-raised text-sage border border-ink-line",
        gold: "bg-gold/15 text-gold-bright border border-gold/30",
        coral: "bg-coral/15 text-coral border border-coral/30",
        emerald: "bg-emerald/15 text-emerald-bright border border-emerald/30",
        outline: "border border-ink-line text-cream",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
