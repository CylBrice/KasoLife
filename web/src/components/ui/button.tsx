import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-150 shadow hover:shadow-md hover:-translate-y-0.5 active:shadow-sm active:translate-y-0 dark:shadow-[0_2px_10px_rgba(0,0,0,0.45),0_1px_3px_rgba(0,0,0,0.28)] dark:hover:shadow-[0_6px_20px_rgba(0,0,0,0.60),0_2px_6px_rgba(0,0,0,0.35)] dark:active:shadow-[0_1px_4px_rgba(0,0,0,0.35)] disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none disabled:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-ink",
  {
    variants: {
      variant: {
        primary: "bg-gold text-white dark:text-[#0B2545] hover:bg-gold-bright active:bg-gold-dim",
        secondary: "bg-ink-raised text-cream hover:bg-ink-line border border-ink-line",
        outline: "border border-gold text-gold hover:bg-gold/10",
        ghost: "text-cream hover:bg-ink-raised",
        danger: "bg-brick text-cream hover:bg-brick/90",
        success: "bg-emerald text-[#0B2545] hover:bg-emerald-bright",
        link: "text-gold underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-11 px-5 text-sm",
        lg: "h-14 px-7 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
