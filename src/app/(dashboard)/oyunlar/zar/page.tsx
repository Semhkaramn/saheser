'use client'

import { useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useUserTheme } from '@/components/providers/user-theme-provider'
import { useAuth, useAuthActions } from '@/components/providers/auth-provider'
import { ThemedButton, ThemedInput, hexToRgba } from '@/components/ui/themed'
import PageHeader from '@/components/PageHeader'
import { Dices, ChevronLeft, Wallet, ArrowUpDown } from 'lucide-react'

export default function DicePage() {
  const { theme } = useUserTheme()
  const { user, setShowLoginModal } = useAuth()
  const { refreshUser } = useAuthActions()

  const [betAmount, setBetAmount] = useState(50)
  const [target, setTarget] = useState(50)
  const [direction, setDirection] = useState<'over' | 'under'>('under')
  const [busy, setBusy] = useState(false)
  const [lastRoll, setLastRoll] = useState<number | null>(null)
  const [lastResult, setLastResult] = useState<{ won: boolean; payout: number } | null>(null)

  const winChance = direction === 'over' ? 100 - target : target
  const multiplier = useMemo(() => {
    const chance = Math.max(1, Math.min(99, winChance))
    return (100 / chance) * 0.99 // ~%1 house edge tahmini gösterim (gerçek hesap backend'de)
  }, [winChance])
  const potentialPayout = Math.floor(betAmount * multiplier)

  const play = useCallback(async () => {
    if (!user) {
      setShowLoginModal(true)
      return
    }
    if (betAmount <= 0 || betAmount > user.points) {
      toast.error('Geçersiz bahis miktarı')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/games/dice/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ betAmount, target, direction, clientSeed: crypto.randomUUID() }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'İşlem başarısız')
        return
      }
      setLastRoll(data.roll)
      setLastResult({ won: data.won, payout: data.payout })
      await refreshUser()
      if (data.won) toast.success(`Kazandın! +${data.payout} puan`)
    } catch {
      toast.error('Bağlantı hatası')
    } finally {
      setBusy(false)
    }
  }, [user, betAmount, target, direction, setShowLoginModal, refreshUser])

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        icon={Dices}
        title="Zar"
        subtitle="Hedefi seç, yönü belirle, at!"
        action={
          <Link href="/oyunlar" className="text-sm font-medium flex items-center gap-1" style={{ color: theme.colors.textMuted }}>
            <ChevronLeft className="w-4 h-4" /> Oyunlar
          </Link>
        }
      />

      <div
        className="rounded-2xl border p-6 space-y-6"
        style={{ backgroundColor: hexToRgba(theme.colors.card, 0.85), borderColor: hexToRgba(theme.colors.border, 0.5) }}
      >
        {/* Sonuç göstergesi */}
        <div className="relative h-24 rounded-xl overflow-hidden flex items-center" style={{ backgroundColor: hexToRgba(theme.colors.backgroundSecondary, 0.6) }}>
          {/* Gradient bar: kırmızı (kayıp bölge) / yeşil (kazanç bölge) */}
          <div
            className="absolute inset-0"
            style={{
              background:
                direction === 'under'
                  ? `linear-gradient(to right, #22c55e 0%, #22c55e ${target}%, #ef4444 ${target}%, #ef4444 100%)`
                  : `linear-gradient(to right, #ef4444 0%, #ef4444 ${target}%, #22c55e ${target}%, #22c55e 100%)`,
              opacity: 0.25,
            }}
          />
          <div
            className="absolute top-0 bottom-0 w-0.5"
            style={{ left: `${target}%`, backgroundColor: theme.colors.text }}
          />
          {lastRoll !== null && (
            <div
              key={lastRoll}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center animate-in zoom-in-50 duration-300"
              style={{ left: `${lastRoll}%` }}
            >
              <div
                className="px-3 py-1.5 rounded-lg font-bold text-sm shadow-lg"
                style={{
                  backgroundColor: lastResult?.won ? '#22c55e' : '#ef4444',
                  color: '#fff',
                }}
              >
                {lastRoll.toFixed(2)}
              </div>
            </div>
          )}
        </div>

        {/* Hedef slider */}
        <div>
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: theme.colors.textMuted }}>
            <span>Hedef: {target}</span>
            <span>Kazanma Şansı: %{winChance.toFixed(0)}</span>
          </div>
          <input
            type="range"
            min={2}
            max={98}
            value={target}
            onChange={(e) => setTarget(Number(e.target.value))}
            className="w-full"
            style={{ accentColor: theme.colors.gradientFrom }}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setDirection('under')}
            className="py-3 rounded-xl border-2 font-bold flex items-center justify-center gap-2 transition-all"
            style={{
              borderColor: direction === 'under' ? theme.colors.gradientFrom : hexToRgba(theme.colors.border, 0.5),
              backgroundColor: direction === 'under' ? hexToRgba(theme.colors.gradientFrom, 0.15) : 'transparent',
              color: theme.colors.text,
            }}
          >
            <ArrowUpDown className="w-4 h-4 rotate-180" /> Altında
          </button>
          <button
            onClick={() => setDirection('over')}
            className="py-3 rounded-xl border-2 font-bold flex items-center justify-center gap-2 transition-all"
            style={{
              borderColor: direction === 'over' ? theme.colors.gradientFrom : hexToRgba(theme.colors.border, 0.5),
              backgroundColor: direction === 'over' ? hexToRgba(theme.colors.gradientFrom, 0.15) : 'transparent',
              color: theme.colors.text,
            }}
          >
            <ArrowUpDown className="w-4 h-4" /> Üstünde
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 items-end">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide mb-2 block" style={{ color: theme.colors.textMuted }}>
              Bahis
            </label>
            <ThemedInput
              type="number"
              value={betAmount}
              onChange={(e) => setBetAmount(Math.max(0, Number(e.target.value)))}
              className="font-bold"
            />
          </div>
          <div className="text-right">
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.colors.textMuted }}>
              Kazanırsan
            </div>
            <div className="text-lg font-bold" style={{ color: theme.colors.text }}>
              {potentialPayout.toLocaleString('tr-TR')} <span className="text-sm font-normal" style={{ color: theme.colors.textMuted }}>({multiplier.toFixed(2)}×)</span>
            </div>
          </div>
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

        <ThemedButton className="w-full" size="lg" disabled={busy} onClick={play}>
          {busy ? 'Atılıyor...' : 'Zarı At'}
        </ThemedButton>
      </div>
    </div>
  )
}
