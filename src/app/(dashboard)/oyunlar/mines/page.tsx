'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useUserTheme } from '@/components/providers/user-theme-provider'
import { useAuth, useAuthActions } from '@/components/providers/auth-provider'
import { ThemedButton, ThemedInput, hexToRgba } from '@/components/ui/themed'
import PageHeader from '@/components/PageHeader'
import { Bomb, Gem, ChevronLeft, Minus, Plus, Wallet, TrendingUp } from 'lucide-react'

const GRID_SIZE = 25

type TileState = 'hidden' | 'safe' | 'mine'

interface ActiveGame {
  gamePlayId: string
  mineCount: number
  betAmount: number
}

export default function MinesPage() {
  const { theme } = useUserTheme()
  const { user, setShowLoginModal } = useAuth()
  const { refreshUser } = useAuthActions()

  const [betAmount, setBetAmount] = useState(50)
  const [mineCount, setMineCount] = useState(3)
  const [game, setGame] = useState<ActiveGame | null>(null)
  const [tiles, setTiles] = useState<TileState[]>(Array(GRID_SIZE).fill('hidden'))
  const [minePositions, setMinePositions] = useState<number[]>([])
  const [multiplier, setMultiplier] = useState(1)
  const [busy, setBusy] = useState(false)
  const [lastResult, setLastResult] = useState<{ type: 'win' | 'lose'; payout?: number } | null>(null)

  const potentialPayout = Math.floor(betAmount * multiplier)

  const resetBoard = () => {
    setTiles(Array(GRID_SIZE).fill('hidden'))
    setMinePositions([])
    setMultiplier(1)
    setGame(null)
    setLastResult(null)
  }

  const startGame = useCallback(async () => {
    if (!user) {
      setShowLoginModal(true)
      return
    }
    if (betAmount <= 0) {
      toast.error('Geçerli bir bahis miktarı gir')
      return
    }
    if (betAmount > user.points) {
      toast.error('Yetersiz puan bakiyesi')
      return
    }

    setBusy(true)
    setLastResult(null)
    try {
      const res = await fetch('/api/games/mines/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ betAmount, mineCount, clientSeed: crypto.randomUUID() }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Oyun başlatılamadı')
        return
      }
      setGame({ gamePlayId: data.gamePlayId, mineCount, betAmount })
      setTiles(Array(GRID_SIZE).fill('hidden'))
      setMultiplier(1)
      await refreshUser()
    } catch {
      toast.error('Bağlantı hatası')
    } finally {
      setBusy(false)
    }
  }, [user, betAmount, mineCount, setShowLoginModal, refreshUser])

  const revealTile = useCallback(
    async (index: number) => {
      if (!game || busy || tiles[index] !== 'hidden') return
      setBusy(true)
      try {
        const res = await fetch('/api/games/mines/reveal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gamePlayId: game.gamePlayId, tileIndex: index }),
        })
        const data = await res.json()
        if (!res.ok) {
          toast.error(data.error || 'İşlem başarısız')
          return
        }

        if (data.hitMine) {
          const newTiles = [...tiles]
          newTiles[index] = 'mine'
          for (const pos of data.minePositions) {
            if (newTiles[pos] === 'hidden') newTiles[pos] = 'mine'
          }
          setTiles(newTiles)
          setMinePositions(data.minePositions)
          setLastResult({ type: 'lose' })
          setGame(null)
          await refreshUser()
          return
        }

        const newTiles = [...tiles]
        newTiles[index] = 'safe'
        setTiles(newTiles)
        setMultiplier(data.multiplier)

        if (data.boardCleared) {
          setLastResult({ type: 'win', payout: data.payout })
          setGame(null)
          await refreshUser()
        }
      } catch {
        toast.error('Bağlantı hatası')
      } finally {
        setBusy(false)
      }
    },
    [game, busy, tiles, refreshUser]
  )

  const cashout = useCallback(async () => {
    if (!game) return
    setBusy(true)
    try {
      const res = await fetch('/api/games/mines/cashout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gamePlayId: game.gamePlayId }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'İşlem başarısız')
        return
      }
      setMinePositions(data.minePositions)
      setLastResult({ type: 'win', payout: data.payout })
      setGame(null)
      await refreshUser()
      toast.success(`+${data.payout} puan kazandın!`)
    } catch {
      toast.error('Bağlantı hatası')
    } finally {
      setBusy(false)
    }
  }, [game, refreshUser])

  const revealedCount = tiles.filter((t) => t === 'safe').length

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        icon={Bomb}
        title="Mines"
        subtitle="Güvenli hücreleri aç, mayınlardan kaçın"
        action={
          <Link href="/oyunlar" className="text-sm font-medium flex items-center gap-1" style={{ color: theme.colors.textMuted }}>
            <ChevronLeft className="w-4 h-4" /> Oyunlar
          </Link>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
        {/* Kontrol Paneli */}
        <div
          className="rounded-2xl border p-5 h-fit space-y-5"
          style={{ backgroundColor: hexToRgba(theme.colors.card, 0.85), borderColor: hexToRgba(theme.colors.border, 0.5) }}
        >
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide mb-2 block" style={{ color: theme.colors.textMuted }}>
              Bahis Miktarı
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setBetAmount((v) => Math.max(10, v - 10))}
                disabled={!!game}
                className="w-9 h-9 rounded-lg border flex items-center justify-center disabled:opacity-40"
                style={{ borderColor: hexToRgba(theme.colors.border, 0.6) }}
              >
                <Minus className="w-4 h-4" style={{ color: theme.colors.text }} />
              </button>
              <ThemedInput
                type="number"
                value={betAmount}
                disabled={!!game}
                onChange={(e) => setBetAmount(Math.max(0, Number(e.target.value)))}
                className="text-center font-bold"
              />
              <button
                onClick={() => setBetAmount((v) => v + 10)}
                disabled={!!game}
                className="w-9 h-9 rounded-lg border flex items-center justify-center disabled:opacity-40"
                style={{ borderColor: hexToRgba(theme.colors.border, 0.6) }}
              >
                <Plus className="w-4 h-4" style={{ color: theme.colors.text }} />
              </button>
            </div>
            <div className="flex gap-1.5 mt-2">
              {[0.5, 2].map((mult) => (
                <button
                  key={mult}
                  disabled={!!game}
                  onClick={() => setBetAmount((v) => Math.max(10, Math.floor(v * mult)))}
                  className="flex-1 text-xs font-semibold py-1.5 rounded-lg border disabled:opacity-40"
                  style={{ borderColor: hexToRgba(theme.colors.border, 0.6), color: theme.colors.textSecondary }}
                >
                  {mult === 0.5 ? '½' : '2×'}
                </button>
              ))}
              <button
                disabled={!!game || !user}
                onClick={() => user && setBetAmount(user.points)}
                className="flex-1 text-xs font-semibold py-1.5 rounded-lg border disabled:opacity-40"
                style={{ borderColor: hexToRgba(theme.colors.border, 0.6), color: theme.colors.textSecondary }}
              >
                Max
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide mb-2 block" style={{ color: theme.colors.textMuted }}>
              Mayın Sayısı: {mineCount}
            </label>
            <input
              type="range"
              min={1}
              max={24}
              value={mineCount}
              disabled={!!game}
              onChange={(e) => setMineCount(Number(e.target.value))}
              className="w-full accent-current"
              style={{ accentColor: theme.colors.gradientFrom }}
            />
          </div>

          {user && (
            <div className="flex items-center justify-between text-sm px-3 py-2 rounded-lg" style={{ backgroundColor: hexToRgba(theme.colors.backgroundSecondary, 0.6) }}>
              <span className="flex items-center gap-1.5" style={{ color: theme.colors.textMuted }}>
                <Wallet className="w-3.5 h-3.5" /> Bakiye
              </span>
              <span className="font-bold" style={{ color: theme.colors.text }}>
                {user.points.toLocaleString('tr-TR')}
              </span>
            </div>
          )}

          {!game ? (
            <ThemedButton className="w-full" size="lg" disabled={busy} onClick={startGame}>
              {busy ? 'Başlatılıyor...' : 'Oyunu Başlat'}
            </ThemedButton>
          ) : (
            <ThemedButton
              className="w-full"
              size="lg"
              disabled={busy || revealedCount === 0}
              onClick={cashout}
            >
              <TrendingUp className="w-4 h-4 mr-1.5" />
              {revealedCount === 0 ? 'Bir hücre aç' : `Al: ${potentialPayout.toLocaleString('tr-TR')} puan`}
            </ThemedButton>
          )}

          {game && (
            <div className="text-center text-sm" style={{ color: theme.colors.textSecondary }}>
              Çarpan: <strong style={{ color: theme.colors.text }}>{multiplier.toFixed(2)}×</strong>
            </div>
          )}
        </div>

        {/* Oyun Alanı */}
        <div
          className="rounded-2xl border p-5"
          style={{ backgroundColor: hexToRgba(theme.colors.card, 0.85), borderColor: hexToRgba(theme.colors.border, 0.5) }}
        >
          {lastResult && (
            <div
              className="mb-4 rounded-xl p-3 text-center font-bold text-sm animate-in fade-in slide-in-from-top-2"
              style={{
                background: lastResult.type === 'win'
                  ? 'linear-gradient(135deg, rgba(34,197,94,0.2), rgba(16,185,129,0.15))'
                  : 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(220,38,38,0.15))',
                color: lastResult.type === 'win' ? '#22c55e' : '#ef4444',
              }}
            >
              {lastResult.type === 'win'
                ? `🎉 Kazandın! +${lastResult.payout?.toLocaleString('tr-TR')} puan`
                : '💥 Mayına bastın, bahis kaybedildi'}
            </div>
          )}

          <div className="grid grid-cols-5 gap-2 sm:gap-3">
            {tiles.map((tile, i) => (
              <button
                key={i}
                onClick={() => revealTile(i)}
                disabled={!game || busy || tile !== 'hidden'}
                className="aspect-square rounded-xl border-2 flex items-center justify-center text-lg sm:text-2xl font-bold transition-all duration-200 disabled:cursor-default"
                style={{
                  backgroundColor:
                    tile === 'safe'
                      ? hexToRgba('#22c55e', 0.15)
                      : tile === 'mine'
                      ? hexToRgba('#ef4444', 0.2)
                      : hexToRgba(theme.colors.backgroundSecondary, 0.8),
                  borderColor:
                    tile === 'safe' ? '#22c55e' : tile === 'mine' ? '#ef4444' : hexToRgba(theme.colors.border, 0.5),
                  transform: tile !== 'hidden' ? 'scale(1)' : undefined,
                  cursor: game && tile === 'hidden' && !busy ? 'pointer' : undefined,
                }}
              >
                {tile === 'safe' && <Gem className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: '#22c55e' }} />}
                {tile === 'mine' && <Bomb className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: '#ef4444' }} />}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
