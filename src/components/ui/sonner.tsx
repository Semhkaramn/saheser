"use client"

import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      position="top-right"
      offset="70px"
      gap={8}
      duration={3000}
      visibleToasts={4}
      expand={false}
      richColors={false}
      closeButton={false}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-[var(--user-card,#141D33)]/95 group-[.toaster]:backdrop-blur-xl group-[.toaster]:text-[var(--user-text,#F1F5F9)] group-[.toaster]:border-[var(--user-card-border,#232E4A)] group-[.toaster]:shadow-2xl group-[.toaster]:text-sm group-[.toaster]:rounded-2xl",
          description: "group-[.toast]:text-[var(--user-text-muted,#64748B)] group-[.toast]:text-xs",
          actionButton:
            "group-[.toast]:bg-[var(--user-primary,#3B82F6)] group-[.toast]:text-[var(--user-primary-foreground,#ffffff)] group-[.toast]:text-xs group-[.toast]:px-3 group-[.toast]:py-1.5 group-[.toast]:rounded-lg",
          cancelButton:
            "group-[.toast]:bg-[var(--user-background-secondary,#111A2E)] group-[.toast]:text-[var(--user-text-secondary,#94A3B8)] group-[.toast]:text-xs group-[.toast]:px-3 group-[.toast]:py-1.5 group-[.toast]:rounded-lg",
          closeButton:
            "group-[.toast]:bg-[var(--user-background-secondary,#111A2E)]/80 group-[.toast]:border-[var(--user-card-border,#232E4A)] group-[.toast]:hover:bg-[var(--user-card,#141D33)]",
          success: "group-[.toaster]:border-emerald-500/40 group-[.toaster]:bg-emerald-900/90",
          error: "group-[.toaster]:border-red-500/40 group-[.toaster]:bg-red-900/90",
          warning: "group-[.toaster]:border-amber-500/40 group-[.toaster]:bg-amber-900/90",
          info: "group-[.toaster]:border-[var(--user-primary,#3B82F6)]/40 group-[.toaster]:bg-[var(--user-background-secondary,#111A2E)]/90",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
