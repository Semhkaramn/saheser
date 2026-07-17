'use client'

import { getActiveTheme } from '@/config/themes'

export function LoadingSpinner({
  fullscreen = true,
  className = ''
}: {
  fullscreen?: boolean
  className?: string
}) {
  const theme = getActiveTheme()

  if (!fullscreen) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <div
          className="w-8 h-8 border-2 rounded-full animate-spin"
          style={{
            borderColor: theme.colors.border,
            borderTopColor: theme.colors.textSecondary
          }}
        />
      </div>
    )
  }

  return (
    <div
      className={`fixed inset-0 z-[100] animate-loading-fade ${className}`}
      style={{ backgroundColor: theme.colors.background }}
      role="status"
      aria-label="Yükleniyor"
    />
  )
}

// Admin spinner component - Admin için ayrı tema, değiştirilmedi
export function AdminLoadingSpinner({
  fullscreen = true
}: {
  fullscreen?: boolean
}) {
  if (!fullscreen) {
    return (
      <div className="flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-slate-600 border-t-slate-300 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div
      className="min-h-screen admin-layout-bg animate-loading-fade"
      role="status"
      aria-label="Yükleniyor"
    />
  )
}
