import * as React from "react";
import { cn } from "@/lib/utils";

export type BadgeProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "outline" | "secondary" | "destructive";
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className = "", variant = "default", ...props }, ref) => {
    const variants = {
      default: "bg-[var(--user-primary,#3B82F6)]/20 text-[var(--user-primary,#3B82F6)] border-[var(--user-primary,#3B82F6)]/30",
      outline: "border text-[var(--user-text,#F1F5F9)]",
      secondary: "bg-[var(--user-text-muted,#64748B)]/20 text-[var(--user-text-secondary,#94A3B8)] border-[var(--user-text-muted,#64748B)]/30",
      destructive: "bg-red-500/20 text-red-300 border-red-500/30",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2",
          variants[variant],
          className
        )}
        {...props}
      />
    );
  }
);

Badge.displayName = "Badge";

export { Badge };
