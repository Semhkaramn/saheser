'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useUserTheme } from '@/components/providers/user-theme-provider'
import { useAuth, useAuthActions } from '@/components/providers/auth-provider'
import { ThemedButton, hexToRgba } from '@/components/ui/themed'
import PageHeader from '@/components/PageHeader'
import { Dices, ChevronLeft, ArrowUpDown } from 'lucide-react'
import GameGate from '@/components/games/GameGate'
import ChipSelector from '@/components/games/ChipSelector'

export default function DicePage() {
  const { theme } = useUserTheme()
  const { user, setShowLoginModal } = useAuth()
  const { refreshUser } = useAuthActions()

  const [betAmount, setBetAmount] = useState(50)
  const [target, setTarget] = useState(50)
  const [direction, setDirection] = useState<'over' | 'under'>('under')
  const [busy, setBusy] = useState(false)
  const [rolling, setRolling] = useState(false)
  const [markerPos, setMarkerPos] = useState<number | null>(null)
  const [transitionMs, setTransitionMs] = useState(700)
  const [lastResult, setLastResult] = useState<{ won: boolean; payout: number; roll: number } | null>(null)

  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    return () => {
      timers.current.forEach(clearTimeout)
    }
  }, [])

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

    timers.current.forEach(clearTimeout)
    timers.current = []

    setBusy(true)
    setRolling(true)
    setLastResult(null)

    // Gerçek zar atışı hissi: sunucu cevabı gelene kadar işaretçi hızlıca sekip duruyor
    const shuffleStops = [22, 78, 35, 65, 45]
    shuffleStops.forEach((pos, i) => {
      const t = setTimeout(() => {
        setTransitionMs(150)
        setMarkerPos(pos)
      }, i * 160)
      timers.current.push(t)
    })

    try {
      const [res] = await Promise.all([
        fetch('/api/games/dice/play', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ betAmount, target, direction, clientSeed: crypto.randomUUID() }),
        }),
        new Promise((resolve) => setTimeout(resolve, shuffleStops.length * 160)), // sekme animasyonunun bitmesini bekle
      ])
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'İşlem başarısız')
        setRolling(false)
        setBusy(false)
        return
      }

      // Son yerleşim: yavaşlayarak gerçek sonuca iniyor
      timers.current.forEach(clearTimeout)
      setTransitionMs(650)
      setMarkerPos(data.roll)

      const settleTimer = setTimeout(() => {
        setRolling(false)
        setBusy(false)
        setLastResult({ won: data.won, payout: data.payout, roll: data.roll })
        refreshUser()
        if (data.won) toast.success(`Kazandın! +${data.payout} puan`)
        else toast.error('Kaybettin')
      }, 680)
      timers.current.push(settleTimer)
    } catch {
      toast.error('Bağlantı hatası')
      setRolling(false)
      setBusy(false)
    }
  }, [user, betAmount, target, direction, setShowLoginModal, refreshUser])

  return (
    <GameGate gameType="dice">
    <div className="max-w-3xl mx-auto">
      <PageHeader
        icon={Dices}
        title="Zar"
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
          {markerPos !== null && (
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center"
              style={{
                left: `${markerPos}%`,
                transition: `left ${transitionMs}ms cubic-bezier(0.22, 0.61, 0.36, 1)`,
              }}
            >
              <div
                className={`px-3 py-1.5 rounded-lg font-bold text-sm shadow-lg ${rolling ? 'animate-pulse' : ''}`}
                style={{
                  backgroundColor: rolling ? theme.colors.gradientFrom : lastResult?.won ? '#22c55e' : '#ef4444',
                  color: '#fff',
                }}
              >
                {rolling ? (
                  <Dices className="w-4 h-4 animate-spin" style={{ animationDuration: '0.5s' }} />
                ) : (
                  lastResult?.roll.toFixed(2)
                )}
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
            disabled={busy}
            onChange={(e) => setTarget(Number(e.target.value))}
            className="w-full"
            style={{ accentColor: theme.colors.gradientFrom }}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setDirection('under')}
            disabled={busy}
            className="py-3 rounded-xl border-2 font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
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
            disabled={busy}
            className="py-3 rounded-xl border-2 font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            style={{
              borderColor: direction === 'over' ? theme.colors.gradientFrom : hexToRgba(theme.colors.border, 0.5),
              backgroundColor: direction === 'over' ? hexToRgba(theme.colors.gradientFrom, 0.15) : 'transparent',
              color: theme.colors.text,
            }}
          >
            <ArrowUpDown className="w-4 h-4" /> Üstünde
          </button>
        </div>

        <div className="text-center">
          <div className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: theme.colors.textMuted }}>
            Kazanırsan
          </div>
          <div className="text-lg font-bold" style={{ color: theme.colors.text }}>
            {potentialPayout.toLocaleString('tr-TR')} <span className="text-sm font-normal" style={{ color: theme.colors.textMuted }}>({multiplier.toFixed(2)}×)</span>
          </div>
        </div>

        <div className="flex flex-col items-center gap-4">
          <ChipSelector value={betAmount} onChange={setBetAmount} max={user?.points} disabled={busy} />
          <ThemedButton className="w-full" size="lg" disabled={busy || betAmount <= 0} onClick={play}>
            {busy ? 'Atılıyor...' : 'Zarı At'}
          </ThemedButton>
        </div>
      </div>
    </div>
    </GameGate>
  )
}
