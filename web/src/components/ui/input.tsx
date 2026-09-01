import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id || props.name;
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-cream">
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={cn(
            "h-11 rounded-xl border border-ink-line bg-ink-surface px-3.5 text-sm text-cream placeholder:text-sage-muted",
            "focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold",
            error && "border-brick focus:border-brick focus:ring-brick",
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-brick">{error}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };
