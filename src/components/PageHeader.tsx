'use client'

import { useUserTheme } from '@/components/providers/user-theme-provider'
import type { ReactNode } from 'react'

// Her üye sayfasının en üstünde kullanılan tek, tutarlı başlık deseni:
// madalyon ikon + başlık + alt başlık + (opsiyonel) sağ taraf aksiyonu.
// Eskiden her sayfa kendi başlığını farklı şekilde yazıyordu; artık hepsi
// aynı bileşeni kullanıyor.
export default function PageHeader({
  icon: Icon,
  title,
  subtitle,
  action,
}: {
  icon: React.ElementType
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  const { theme } = useUserTheme()

  return (
    <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
      <div className="flex items-center gap-3">
        <span
          className="w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0"
          style={{
            background: `linear-gradient(135deg, ${theme.colors.gradientFrom}, ${theme.colors.gradientTo})`,
            boxShadow: `0 4px 16px ${theme.colors.primary}40`,
          }}
        >
          <Icon className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: theme.colors.primaryForeground }} />
        </span>
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold" style={{ color: theme.colors.text }}>
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs sm:text-sm" style={{ color: theme.colors.textMuted }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {action}
    </div>
  )
}
