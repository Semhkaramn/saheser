'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useUserTheme } from '@/components/providers/user-theme-provider'
import { useAuthState } from '@/components/providers/auth-provider'
import PageHeader from '@/components/PageHeader'
import { hexToRgba } from '@/components/ui/themed'
import { Gamepad2, Bomb, Dices, CircleDot, Spade, Sparkles, Loader2 } from 'lucide-react'

interface GameCardDef {
  href: string
  title: string
  gameType: 'mines' | 'dice' | 'roulette' | 'blackjack'
  icon: React.ElementType
  accentFrom: string
  accentTo: string
  tag?: string
}

const GAMES: GameCardDef[] = [
  {
    href: '/oyunlar/mines',
    title: 'Mines',
    gameType: 'mines',
    icon: Bomb,
    accentFrom: '#22c55e',
    accentTo: '#0ea5e9',
    tag: 'Popüler',
  },
  {
    href: '/oyunlar/zar',
    title: 'Zar',
    gameType: 'dice',
    icon: Dices,
    accentFrom: '#f59e0b',
    accentTo: '#ef4444',
  },
  {
    href: '/oyunlar/rulet',
    title: 'Rulet',
    gameType: 'roulette',
    icon: CircleDot,
    accentFrom: '#dc2626',
    accentTo: '#7c3aed',
  },
  {
    href: '/oyunlar/blackjack',
    title: 'Blackjack',
    gameType: 'blackjack',
    icon: Spade,
    accentFrom: '#0f172a',
    accentTo: '#334155',
    tag: 'Yeni',
  },
]

function GameCard({ game }: { game: GameCardDef }) {
  const { theme } = useUserTheme()
  const Icon = game.icon

  return (
    <Link
      href={game.href}
      className="group relative overflow-hidden rounded-2xl border p-5 transition-all duration-300 hover:-translate-y-1 block"
      style={{
        backgroundColor: hexToRgba(theme.colors.card, 0.85),
        borderColor: hexToRgba(theme.colors.border, 0.5),
      }}
    >
      <div
        className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-20 blur-3xl transition-opacity duration-300 group-hover:opacity-40"
        style={{ background: `linear-gradient(135deg, ${game.accentFrom}, ${game.accentTo})` }}
      />

      {game.tag && (
        <span
          className="absolute top-4 right-4 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide"
          style={{
            background: `linear-gradient(135deg, ${game.accentFrom}, ${game.accentTo})`,
            color: '#fff',
          }}
        >
          {game.tag}
        </span>
      )}

      <div
        className="relative w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3"
        style={{
          background: `linear-gradient(135deg, ${game.accentFrom}, ${game.accentTo})`,
          boxShadow: `0 8px 20px ${hexToRgba(game.accentFrom, 0.4)}`,
        }}
      >
        <Icon className="w-7 h-7 text-white" />
      </div>

      <h3 className="relative text-lg font-bold mb-4" style={{ color: theme.colors.text }}>
        {game.title}
      </h3>

      <div
        className="relative inline-flex items-center gap-1.5 text-sm font-semibold transition-all duration-300 group-hover:gap-2.5"
        style={{ color: game.accentFrom }}
      >
        Oyna
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </div>
    </Link>
  )
}

export default function GamesHubPage() {
  const { theme } = useUserTheme()
  const { user } = useAuthState()
  const [enabledMap, setEnabledMap] = useState<Record<string, boolean> | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/games/settings')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        setEnabledMap({
          mines: data.mines?.isEnabled ?? true,
          dice: data.dice?.isEnabled ?? true,
          roulette: data.roulette?.isEnabled ?? true,
          blackjack: data.blackjack?.isEnabled ?? true,
        })
      })
      .catch(() => {
        if (!cancelled) setEnabledMap({ mines: true, dice: true, roulette: true, blackjack: true })
      })
    return () => {
      cancelled = true
    }
  }, [])

  const visibleGames = enabledMap ? GAMES.filter((g) => enabledMap[g.gameType]) : null

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        icon={Gamepad2}
        title="Oyunlar"
        subtitle="Puanlarınla oyna, kazandıkça markette biriktir"
        action={
          user && (
            <div
              className="flex items-center gap-2 px-4 py-2 rounded-full border"
              style={{
                backgroundColor: hexToRgba(theme.colors.card, 0.8),
                borderColor: hexToRgba(theme.colors.border, 0.5),
              }}
            >
              <Sparkles className="w-4 h-4" style={{ color: theme.colors.gradientFrom }} />
              <span className="text-sm font-semibold" style={{ color: theme.colors.text }}>
                {user.points?.toLocaleString('tr-TR')} puan
              </span>
            </div>
          )
        }
      />

      {!visibleGames ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: theme.colors.textMuted }} />
        </div>
      ) : visibleGames.length === 0 ? (
        <div
          className="rounded-2xl border p-8 text-center text-sm"
          style={{ backgroundColor: hexToRgba(theme.colors.card, 0.85), borderColor: hexToRgba(theme.colors.border, 0.5), color: theme.colors.textMuted }}
        >
          Şu anda aktif oyun bulunmuyor.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {visibleGames.map((game) => (
            <GameCard key={game.href} game={game} />
          ))}
        </div>
      )}
    </div>
  )
}
