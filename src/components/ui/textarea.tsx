import * as React from "react";
import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = "", ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-lg border border-[var(--user-card-border,#232E4A)] bg-[var(--user-background-secondary,#111A2E)] px-3 py-2 text-sm text-[var(--user-text,#F1F5F9)] placeholder:text-[var(--user-text-muted,#64748B)] focus:outline-none focus:ring-2 focus:ring-[var(--user-primary,#3B82F6)] disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Textarea.displayName = "Textarea";

export { Textarea };
