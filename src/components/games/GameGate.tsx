'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useUserTheme } from '@/components/providers/user-theme-provider'
import { hexToRgba } from '@/components/ui/themed'
import { Loader2, Lock, ChevronLeft } from 'lucide-react'

type GameType = 'mines' | 'dice' | 'roulette' | 'blackjack'

/**
 * Bir oyun admin panelinden kapatıldıysa, bu bileşen o oyunun sayfasını
 * hiç göstermez (doğrudan URL ile girilse bile) — sadece "kapalı" mesajı gösterir.
 */
export default function GameGate({ gameType, children }: { gameType: GameType; children: React.ReactNode }) {
  const { theme } = useUserTheme()
  const [status, setStatus] = useState<'loading' | 'enabled' | 'disabled'>('loading')

  useEffect(() => {
    let cancelled = false
    fetch('/api/games/settings')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        setStatus(data?.[gameType]?.isEnabled === false ? 'disabled' : 'enabled')
      })
      .catch(() => {
        if (!cancelled) setStatus('enabled')
      })
    return () => {
      cancelled = true
    }
  }, [gameType])

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: theme.colors.textMuted }} />
      </div>
    )
  }

  if (status === 'disabled') {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ backgroundColor: hexToRgba(theme.colors.textMuted, 0.15) }}
        >
          <Lock className="w-7 h-7" style={{ color: theme.colors.textMuted }} />
        </div>
        <h2 className="text-lg font-bold mb-1.5" style={{ color: theme.colors.text }}>
          Bu oyun şu anda kapalı
        </h2>
        <p className="text-sm mb-6" style={{ color: theme.colors.textMuted }}>
          Daha sonra tekrar dene.
        </p>
        <Link
          href="/oyunlar"
          className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg border"
          style={{ borderColor: hexToRgba(theme.colors.border, 0.6), color: theme.colors.text }}
        >
          <ChevronLeft className="w-4 h-4" /> Oyunlara Dön
        </Link>
      </div>
    )
  }

  return <>{children}</>
}
