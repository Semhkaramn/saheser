'use client'

import { useState, useEffect } from 'react'
import { SITE_CONFIG } from '@/lib/site-config'
import { useUserTheme } from '@/components/providers/user-theme-provider'
import { useVisitStats } from '@/lib/hooks/useVisitStats'
import { Eye, Users } from 'lucide-react'

// Ziyaret İstatistikleri - iki ayrı bloktan tek bir rozet şeridine indirgendi
function VisitStatsBar() {
  const { theme } = useUserTheme()
  const { data: visitStats } = useVisitStats()

  const stats = [
    { icon: Eye, label: 'Toplam Ziyaret', value: visitStats?.totalVisits },
    { icon: Users, label: 'Benzersiz Ziyaretçi', value: visitStats?.totalUniqueVisitors },
  ]

  return (
    <div className="w-full py-4 px-4" style={{ borderTop: `1px solid ${theme.colors.border}` }}>
      <div className="container mx-auto grid grid-cols-2 gap-2.5 sm:flex sm:items-center sm:justify-center sm:gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex items-center gap-2 sm:gap-2.5 px-3 sm:px-4 py-2 rounded-full min-w-0"
            style={{ background: theme.colors.card, border: `1px solid ${theme.colors.border}` }}
          >
            <span
              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: `${theme.colors.primary}20` }}
            >
              <stat.icon className="w-3.5 h-3.5" style={{ color: theme.colors.primary }} />
            </span>
            <span className="text-sm font-bold font-data flex-shrink-0" style={{ color: theme.colors.text }}>
              {stat.value?.toLocaleString('tr-TR') ?? '—'}
            </span>
            <span className="text-xs truncate" style={{ color: theme.colors.textMuted }}>{stat.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Footer() {
  const [year, setYear] = useState<number>(2025)
  const { theme } = useUserTheme()

  useEffect(() => {
    setYear(new Date().getFullYear())
  }, [])

  return (
    <>
      <VisitStatsBar />

      <footer
        className="w-full py-6"
        style={{
          borderTop: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.backgroundSecondary,
        }}
      >
        <div className="container mx-auto px-4">
          <p className="text-center" style={{ color: theme.colors.textMuted }}>
            © {year} <span style={{ color: theme.colors.text }}>{SITE_CONFIG.siteName}</span>. Tüm hakları saklıdır.
          </p>
        </div>
      </footer>
    </>
  )
}
