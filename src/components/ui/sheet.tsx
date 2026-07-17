"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

interface SheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

export function Sheet({ open, onOpenChange, children }: SheetProps) {
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [open])

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-[60] bg-black/80 transition-opacity duration-300 ease-out",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => onOpenChange(false)}
        style={{
          willChange: open ? 'opacity' : 'auto',
          transform: 'translate3d(0, 0, 0)'
        }}
      />

      {/* Sheet */}
      <div
        className={cn(
          "fixed right-0 top-0 z-[60] h-full w-full sm:w-96 bg-gradient-to-b from-[var(--user-background,#0B1120)] via-[var(--user-background-secondary,#111A2E)] to-[var(--user-background,#0B1120)] shadow-xl transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
        style={{
          willChange: open ? 'transform' : 'auto',
          transform: open ? 'translate3d(0, 0, 0)' : 'translate3d(100%, 0, 0)',
          backfaceVisibility: 'hidden',
          perspective: 1000
        }}
      >
        {children}
      </div>
    </>
  )
}

interface SheetContentProps {
  children: React.ReactNode
  onClose: () => void
  hideCloseButton?: boolean
}

export function SheetContent({ children, onClose, hideCloseButton = false, className, style }: SheetContentProps & { className?: string, style?: React.CSSProperties }) {
  return (
    <div className={cn("flex flex-col h-full", className)} style={style}>
      {/* Close button */}
      {!hideCloseButton && (
        <div className="flex items-center justify-end p-4 border-b border-white/10">
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors duration-150 ease-out text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      )}

      {/* Content */}
      <div
        className="flex-1 overflow-y-auto"
        style={{
          transform: 'translate3d(0, 0, 0)',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {children}
      </div>
    </div>
  )
}

interface SheetHeaderProps {
  children: React.ReactNode
  className?: string
}

export function SheetHeader({ children, className }: SheetHeaderProps) {
  return (
    <div className={cn("px-6 py-4 border-b border-white/10", className)}>
      {children}
    </div>
  )
}

interface SheetTitleProps {
  children: React.ReactNode
  className?: string
}

export function SheetTitle({ children, className }: SheetTitleProps) {
  return (
    <h2 className={cn("text-xl font-bold text-white", className)}>
      {children}
    </h2>
  )
}
