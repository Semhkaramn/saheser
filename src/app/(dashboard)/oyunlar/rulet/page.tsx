'use client'

import { useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useUserTheme } from '@/components/providers/user-theme-provider'
import { useAuth, useAuthActions } from '@/components/providers/auth-provider'
import { ThemedButton, ThemedInput, hexToRgba } from '@/components/ui/themed'
import PageHeader from '@/components/PageHeader'
import { CircleDot, ChevronLeft, Wallet, Trash2 } from 'lucide-react'

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36])
type BetType = 'straight' | 'red' | 'black' | 'even' | 'odd' | 'low' | 'high' | 'dozen1' | 'dozen2' | 'dozen3'

interface PlacedBet {
  key: string
  type: BetType
  value?: number
  amount: number
  label: string
}

const OUTSIDE_BETS: { type: BetType; label: string; color?: string }[] = [
  { type: 'low', label: '1-18' },
  { type: 'even', label: 'Çift' },
  { type: 'red', label: 'Kırmızı', color: '#dc2626' },
  { type: 'black', label: 'Siyah', color: '#18181b' },
  { type: 'odd', label: 'Tek' },
  { type: 'high', label: '19-36' },
]

const DOZEN_BETS: { type: BetType; label: string }[] = [
  { type: 'dozen1', label: '1. Düzine (1-12)' },
  { type: 'dozen2', label: '2. Düzine (13-24)' },
  { type: 'dozen3', label: '3. Düzine (25-36)' },
]

export default function RoulettePage() {
  const { theme } = useUserTheme()
  const { user, setShowLoginModal } = useAuth()
  const { refreshUser } = useAuthActions()

  const [chipValue, setChipValue] = useState(25)
  const [bets, setBets] = useState<PlacedBet[]>([])
  const [busy, setBusy] = useState(false)
  const [spinResult, setSpinResult] = useState<number | null>(null)
  const [rotation, setRotation] = useState(0)
  const [betResults, setBetResults] = useState<Record<string, { won: boolean; payout: number }>>({})

  const totalBet = bets.reduce((sum, b) => sum + b.amount, 0)

  const addBet = (type: BetType, value: number | undefined, label: string) => {
    const key = `${type}-${value ?? ''}`
    setBets((prev) => {
      const existing = prev.find((b) => b.key === key)
      if (existing) {
        return prev.map((b) => (b.key === key ? { ...b, amount: b.amount + chipValue } : b))
      }
      return [...prev, { key, type, value, amount: chipValue, label }]
    })
  }

  const clearBets = () => setBets([])

  const spin = useCallback(async () => {
    if (!user) {
      setShowLoginModal(true)
      return
    }
    if (bets.length === 0) {
      toast.error('En az bir bahis koy')
      return
    }
    if (totalBet > user.points) {
      toast.error('Yetersiz puan bakiyesi')
      return
    }

    setBusy(true)
    setBetResults({})
    try {
      const res = await fetch('/api/games/roulette/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bets: bets.map((b) => ({ type: b.type, amount: b.amount, value: b.value })),
          clientSeed: crypto.randomUUID(),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'İşlem başarısız')
        return
      }

      // Çark animasyonu: sonuç açısına + birkaç tam tur ekle
      const targetAngle = (data.spinResult / 37) * 360
      setRotation((prev) => prev + 360 * 4 + targetAngle)
      setTimeout(() => {
        setSpinResult(data.spinResult)
        const resultMap: Record<string, { won: boolean; payout: number }> = {}
        for (const br of data.betResults) {
          const key = `${br.type}-${br.value ?? ''}`
          resultMap[key] = { won: br.won, payout: br.payout }
        }
        setBetResults(resultMap)
        if (data.won) toast.success(`Kazandın! +${data.totalPayout} puan`)
        else toast.error('Bu el kaybettin')
      }, 2200)

      await refreshUser()
      setTimeout(() => setBets([]), 2300)
    } catch {
      toast.error('Bağlantı hatası')
    } finally {
      setTimeout(() => setBusy(false), 2300)
    }
  }, [user, bets, totalBet, setShowLoginModal, refreshUser])

  const numberGrid = useMemo(() => {
    const rows: number[][] = [[], [], []]
    for (let n = 1; n <= 36; n++) {
      rows[(n - 1) % 3].unshift(n)
    }
    return rows
  }, [])

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        icon={CircleDot}
        title="Rulet"
        subtitle="Bahsini koy, çarkı çevir"
        action={
          <Link href="/oyunlar" className="text-sm font-medium flex items-center gap-1" style={{ color: theme.colors.textMuted }}>
            <ChevronLeft className="w-4 h-4" /> Oyunlar
          </Link>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-5">
        {/* Çark */}
        <div
          className="rounded-2xl border p-5 flex flex-col items-center justify-center gap-4"
          style={{ backgroundColor: hexToRgba(theme.colors.card, 0.85), borderColor: hexToRgba(theme.colors.border, 0.5) }}
        >
          <div className="relative w-40 h-40">
            <div
              className="w-40 h-40 rounded-full border-4 flex items-center justify-center"
              style={{
                borderColor: hexToRgba(theme.colors.gradientFrom, 0.5),
                background: 'conic-gradient(#18181b 0deg 9.7deg, #dc2626 9.7deg 19.4deg, #18181b 19.4deg 29.1deg, #22c55e 29.1deg 38.8deg, #dc2626 38.8deg 48.5deg, #18181b 48.5deg 58.2deg, #dc2626 58.2deg 67.9deg, #18181b 67.9deg 77.6deg, #dc2626 77.6deg 87.3deg, #18181b 87.3deg 97deg, #dc2626 97deg 106.7deg, #18181b 106.7deg 116.4deg, #dc2626 116.4deg 126.1deg, #18181b 126.1deg 135.8deg, #dc2626 135.8deg 145.5deg, #18181b 145.5deg 155.2deg, #dc2626 155.2deg 164.9deg, #18181b 164.9deg 174.6deg, #dc2626 174.6deg 184.3deg, #18181b 184.3deg 194deg, #dc2626 194deg 203.7deg, #18181b 203.7deg 213.4deg, #dc2626 213.4deg 223.1deg, #18181b 223.1deg 232.8deg, #dc2626 232.8deg 242.5deg, #18181b 242.5deg 252.2deg, #dc2626 252.2deg 261.9deg, #18181b 261.9deg 271.6deg, #dc2626 271.6deg 281.3deg, #18181b 281.3deg 291deg, #dc2626 291deg 300.7deg, #18181b 300.7deg 310.4deg, #dc2626 310.4deg 320.1deg, #18181b 320.1deg 329.8deg, #dc2626 329.8deg 339.5deg, #18181b 339.5deg 349.2deg, #dc2626 349.2deg 360deg)',
                transform: `rotate(${rotation}deg)`,
                transition: busy ? 'transform 2.2s cubic-bezier(0.2, 0.8, 0.2, 1)' : undefined,
              }}
            />
            <div
              className="absolute inset-0 m-auto w-16 h-16 rounded-full flex items-center justify-center font-bold text-lg border-2"
              style={{
                backgroundColor: theme.colors.card,
                borderColor: hexToRgba(theme.colors.border, 0.6),
                color: theme.colors.text,
              }}
            >
              {spinResult !== null ? spinResult : '?'}
            </div>
          </div>
          {spinResult !== null && (
            <div
              className="text-sm font-bold px-3 py-1 rounded-full"
              style={{
                backgroundColor: spinResult === 0 ? hexToRgba('#22c55e', 0.2) : RED_NUMBERS.has(spinResult) ? hexToRgba('#dc2626', 0.2) : hexToRgba('#18181b', 0.3),
                color: spinResult === 0 ? '#22c55e' : RED_NUMBERS.has(spinResult) ? '#dc2626' : theme.colors.text,
              }}
            >
              {spinResult}
            </div>
          )}

          <div className="w-full">
            <label className="text-xs font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: theme.colors.textMuted }}>
              Fiş Değeri
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {[10, 25, 50, 100].map((v) => (
                <button
                  key={v}
                  onClick={() => setChipValue(v)}
                  className="text-xs font-bold py-1.5 rounded-lg border"
                  style={{
                    borderColor: chipValue === v ? theme.colors.gradientFrom : hexToRgba(theme.colors.border, 0.5),
                    backgroundColor: chipValue === v ? hexToRgba(theme.colors.gradientFrom, 0.15) : 'transparent',
                    color: theme.colors.text,
                  }}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {user && (
            <div className="w-full flex items-center justify-between text-xs px-2 py-1.5 rounded-lg" style={{ backgroundColor: hexToRgba(theme.colors.backgroundSecondary, 0.6) }}>
              <span className="flex items-center gap-1" style={{ color: theme.colors.textMuted }}>
                <Wallet className="w-3 h-3" /> Bakiye
              </span>
              <span className="font-bold" style={{ color: theme.colors.text }}>
                {user.points.toLocaleString('tr-TR')}
              </span>
            </div>
          )}
        </div>

        {/* Bahis masası */}
        <div
          className="rounded-2xl border p-5 space-y-4"
          style={{ backgroundColor: hexToRgba(theme.colors.card, 0.85), borderColor: hexToRgba(theme.colors.border, 0.5) }}
        >
          <div className="overflow-x-auto pb-1 -mx-1 px-1">
            <div className="flex items-stretch gap-2 mb-1 min-w-[520px] sm:min-w-0">
              <button
                onClick={() => addBet('straight', 0, '0')}
                className="w-10 rounded-lg border-2 font-bold flex-shrink-0 relative"
                style={{
                  borderColor: bets.find((b) => b.key === 'straight-0') ? theme.colors.gradientFrom : hexToRgba(theme.colors.border, 0.5),
                  backgroundColor: hexToRgba('#22c55e', 0.15),
                  color: '#22c55e',
                }}
              >
                0
                {bets.find((b) => b.key === 'straight-0') && (
                  <ChipBadge amount={bets.find((b) => b.key === 'straight-0')!.amount} theme={theme} />
                )}
              </button>
              <div className="grid grid-cols-12 gap-1 flex-1">
                {numberGrid.flat().map((n) => {
                  const key = `straight-${n}`
                  const placed = bets.find((b) => b.key === key)
                  const result = betResults[key]
                  return (
                    <button
                      key={n}
                      onClick={() => addBet('straight', n, String(n))}
                      className="relative aspect-square min-w-[30px] rounded-md text-[11px] sm:text-xs font-bold border"
                      style={{
                        backgroundColor: RED_NUMBERS.has(n) ? hexToRgba('#dc2626', 0.2) : hexToRgba('#18181b', 0.3),
                        borderColor: placed ? theme.colors.gradientFrom : 'transparent',
                        color: RED_NUMBERS.has(n) ? '#f87171' : theme.colors.text,
                        outline: result?.won ? '2px solid #22c55e' : undefined,
                      }}
                    >
                      {n}
                      {placed && <ChipBadge amount={placed.amount} theme={theme} />}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
          <p className="text-[10px] -mt-2 sm:hidden" style={{ color: theme.colors.textMuted }}>
            ← Sayı tablosunu kaydırarak tüm sayıları görebilirsin
          </p>

          <div className="grid grid-cols-3 gap-2">
            {DOZEN_BETS.map((d) => {
              const key = `${d.type}-`
              const placed = bets.find((b) => b.key === key)
              return (
                <button
                  key={d.type}
                  onClick={() => addBet(d.type, undefined, d.label)}
                  className="relative py-2 rounded-lg border text-xs font-semibold"
                  style={{
                    borderColor: placed ? theme.colors.gradientFrom : hexToRgba(theme.colors.border, 0.5),
                    color: theme.colors.textSecondary,
                  }}
                >
                  {d.label}
                  {placed && <ChipBadge amount={placed.amount} theme={theme} />}
                </button>
              )
            })}
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {OUTSIDE_BETS.map((b) => {
              const key = `${b.type}-`
              const placed = bets.find((x) => x.key === key)
              return (
                <button
                  key={b.type}
                  onClick={() => addBet(b.type, undefined, b.label)}
                  className="relative py-2.5 rounded-lg border text-xs font-bold"
                  style={{
                    borderColor: placed ? theme.colors.gradientFrom : hexToRgba(theme.colors.border, 0.5),
                    backgroundColor: b.color ? hexToRgba(b.color, 0.2) : 'transparent',
                    color: b.color === '#18181b' ? theme.colors.text : b.color || theme.colors.textSecondary,
                  }}
                >
                  {b.label}
                  {placed && <ChipBadge amount={placed.amount} theme={theme} />}
                </button>
              )
            })}
          </div>

          <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: hexToRgba(theme.colors.border, 0.4) }}>
            <div className="text-sm" style={{ color: theme.colors.textMuted }}>
              Toplam bahis: <strong style={{ color: theme.colors.text }}>{totalBet.toLocaleString('tr-TR')}</strong>
            </div>
            <div className="flex gap-2">
              <button
                onClick={clearBets}
                disabled={busy || bets.length === 0}
                className="w-9 h-9 rounded-lg border flex items-center justify-center disabled:opacity-40"
                style={{ borderColor: hexToRgba(theme.colors.border, 0.6) }}
              >
                <Trash2 className="w-4 h-4" style={{ color: theme.colors.textMuted }} />
              </button>
              <ThemedButton size="lg" disabled={busy || bets.length === 0} onClick={spin}>
                {busy ? 'Çevriliyor...' : 'Çevir'}
              </ThemedButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ChipBadge({ amount, theme }: { amount: number; theme: any }) {
  return (
    <span
      className="absolute -top-1.5 -right-1.5 text-[9px] font-bold w-5 h-5 rounded-full flex items-center justify-center border"
      style={{
        background: `linear-gradient(135deg, ${theme.colors.gradientFrom}, ${theme.colors.gradientTo})`,
        color: '#fff',
        borderColor: theme.colors.card,
      }}
    >
      {amount >= 1000 ? `${Math.round(amount / 1000)}k` : amount}
    </span>
  )
}
