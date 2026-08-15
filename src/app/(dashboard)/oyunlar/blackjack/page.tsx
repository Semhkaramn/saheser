'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useUserTheme } from '@/components/providers/user-theme-provider'
import { useAuth, useAuthActions } from '@/components/providers/auth-provider'
import { ThemedButton, ThemedInput, hexToRgba } from '@/components/ui/themed'
import PageHeader from '@/components/PageHeader'
import { Spade, ChevronLeft, Wallet } from 'lucide-react'

interface Card {
  rank: string
  suit: '♠' | '♥' | '♦' | '♣'
}

interface HandValue {
  total: number
  isSoft: boolean
}

const OUTCOME_LABELS: Record<string, { text: string; color: string }> = {
  player_blackjack: { text: '🂡 Blackjack! Kazandın', color: '#22c55e' },
  dealer_blackjack: { text: 'Dealer Blackjack yaptı', color: '#ef4444' },
  push: { text: 'Berabere - bahis iade edildi', color: '#f59e0b' },
  player_bust: { text: '21\'i geçtin, kaybettin', color: '#ef4444' },
  dealer_bust: { text: 'Dealer 21\'i geçti, kazandın!', color: '#22c55e' },
  player_win: { text: 'Kazandın!', color: '#22c55e' },
  dealer_win: { text: 'Dealer kazandı', color: '#ef4444' },
}

function CardView({ card, hidden }: { card?: Card; hidden?: boolean }) {
  const { theme } = useUserTheme()
  const isRed = card && (card.suit === '♥' || card.suit === '♦')

  if (hidden || !card) {
    return (
      <div
        className="w-12 h-[4.5rem] sm:w-16 sm:h-24 rounded-lg border-2 flex items-center justify-center flex-shrink-0"
        style={{
          background: `linear-gradient(135deg, ${theme.colors.gradientFrom}, ${theme.colors.gradientTo})`,
          borderColor: hexToRgba(theme.colors.border, 0.6),
        }}
      >
        <div className="w-8 h-12 rounded border border-white/30" />
      </div>
    )
  }

  return (
    <div
      className="w-12 h-[4.5rem] sm:w-16 sm:h-24 rounded-lg border-2 bg-white flex flex-col items-center justify-center flex-shrink-0 shadow-lg animate-in zoom-in-75 fade-in duration-200"
      style={{ borderColor: 'rgba(0,0,0,0.1)' }}
    >
      <span className="text-lg sm:text-xl font-black" style={{ color: isRed ? '#dc2626' : '#18181b' }}>
        {card.rank}
      </span>
      <span className="text-lg sm:text-xl" style={{ color: isRed ? '#dc2626' : '#18181b' }}>
        {card.suit}
      </span>
    </div>
  )
}

export default function BlackjackPage() {
  const { theme } = useUserTheme()
  const { user, setShowLoginModal } = useAuth()
  const { refreshUser } = useAuthActions()

  const [betAmount, setBetAmount] = useState(50)
  const [gamePlayId, setGamePlayId] = useState<string | null>(null)
  const [playerHand, setPlayerHand] = useState<Card[]>([])
  const [dealerHand, setDealerHand] = useState<Card[]>([])
  const [dealerHidden, setDealerHidden] = useState(true)
  const [playerValue, setPlayerValue] = useState<HandValue | null>(null)
  const [dealerValue, setDealerValue] = useState<HandValue | null>(null)
  const [status, setStatus] = useState<'idle' | 'playing' | 'done'>('idle')
  const [canDouble, setCanDouble] = useState(false)
  const [outcome, setOutcome] = useState<string | null>(null)
  const [payout, setPayout] = useState(0)
  const [busy, setBusy] = useState(false)

  const deal = useCallback(async () => {
    if (!user) {
      setShowLoginModal(true)
      return
    }
    if (betAmount <= 0 || betAmount > user.points) {
      toast.error('Geçersiz bahis miktarı')
      return
    }
    setBusy(true)
    setOutcome(null)
    try {
      const res = await fetch('/api/games/blackjack/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ betAmount, clientSeed: crypto.randomUUID() }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Oyun başlatılamadı')
        return
      }
      setGamePlayId(data.gamePlayId)
      setPlayerHand(data.playerHand)

      if (data.status === 'done') {
        setDealerHand(data.dealerHand)
        setDealerHidden(false)
        setPlayerValue(data.playerValue)
        setDealerValue(data.dealerValue)
        setOutcome(data.outcome)
        setPayout(data.payout)
        setStatus('done')
      } else {
        setDealerHand([data.dealerUpcard])
        setDealerHidden(true)
        setPlayerValue(data.playerValue)
        setDealerValue(null)
        setCanDouble(data.canDouble)
        setStatus('playing')
      }
      await refreshUser()
    } catch {
      toast.error('Bağlantı hatası')
    } finally {
      setBusy(false)
    }
  }, [user, betAmount, setShowLoginModal, refreshUser])

  const handleAction = useCallback(
    async (action: 'hit' | 'stand' | 'double') => {
      if (!gamePlayId) return
      setBusy(true)
      try {
        const res = await fetch(`/api/games/blackjack/${action}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gamePlayId }),
        })
        const data = await res.json()
        if (!res.ok) {
          toast.error(data.error || 'İşlem başarısız')
          return
        }

        setPlayerHand(data.playerHand)
        setPlayerValue(data.playerValue)
        setCanDouble(false)

        if (data.status === 'done') {
          setDealerHand(data.dealerHand)
          setDealerHidden(false)
          setDealerValue(data.dealerValue)
          setOutcome(data.outcome)
          setPayout(data.payout)
          setStatus('done')
          await refreshUser()
        }
      } catch {
        toast.error('Bağlantı hatası')
      } finally {
        setBusy(false)
      }
    },
    [gamePlayId, refreshUser]
  )

  const newRound = () => {
    setGamePlayId(null)
    setPlayerHand([])
    setDealerHand([])
    setDealerHidden(true)
    setPlayerValue(null)
    setDealerValue(null)
    setStatus('idle')
    setOutcome(null)
  }

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        icon={Spade}
        title="Blackjack"
        subtitle="21'i geç, dealer'ı yen"
        action={
          <Link href="/oyunlar" className="text-sm font-medium flex items-center gap-1" style={{ color: theme.colors.textMuted }}>
            <ChevronLeft className="w-4 h-4" /> Oyunlar
          </Link>
        }
      />

      <div
        className="rounded-2xl border p-6"
        style={{
          background: 'radial-gradient(ellipse at center, #14532d 0%, #052e16 100%)',
          borderColor: hexToRgba(theme.colors.border, 0.5),
        }}
      >
        {/* Dealer eli */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wide text-white/70">Dealer</span>
            {dealerValue && !dealerHidden && (
              <span className="text-sm font-bold text-white">{dealerValue.total}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 sm:gap-2 min-h-[6rem] sm:min-h-[7rem] items-center">
            {status === 'idle' ? (
              <div className="text-white/40 text-sm">Eli başlatmak için bahis koy</div>
            ) : (
              dealerHand.map((c, i) => (
                <CardView key={i} card={c} hidden={dealerHidden && i === 1} />
              ))
            )}
          </div>
        </div>

        {/* Sonuç banner */}
        {outcome && (
          <div
            className="text-center font-bold py-2.5 rounded-xl mb-4 animate-in fade-in slide-in-from-top-2"
            style={{
              backgroundColor: hexToRgba(OUTCOME_LABELS[outcome]?.color || '#fff', 0.2),
              color: OUTCOME_LABELS[outcome]?.color || '#fff',
            }}
          >
            {OUTCOME_LABELS[outcome]?.text}
            {payout > 0 && ` (+${payout} puan)`}
          </div>
        )}

        {/* Oyuncu eli */}
        <div className="mb-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wide text-white/70">Sen</span>
            {playerValue && <span className="text-sm font-bold text-white">{playerValue.total}{playerValue.isSoft ? ' (soft)' : ''}</span>}
          </div>
          <div className="flex flex-wrap gap-1.5 sm:gap-2 min-h-[6rem] sm:min-h-[7rem] items-center">
            {playerHand.map((c, i) => (
              <CardView key={i} card={c} />
            ))}
          </div>
        </div>
      </div>

      {/* Kontroller */}
      <div
        className="rounded-2xl border p-5 mt-5 space-y-4"
        style={{ backgroundColor: hexToRgba(theme.colors.card, 0.85), borderColor: hexToRgba(theme.colors.border, 0.5) }}
      >
        {status === 'idle' || status === 'done' ? (
          <>
            <div className="flex items-end gap-4">
              <div className="flex-1">
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
              {user && (
                <div className="text-right pb-2">
                  <div className="text-xs flex items-center gap-1 justify-end" style={{ color: theme.colors.textMuted }}>
                    <Wallet className="w-3 h-3" /> Bakiye
                  </div>
                  <div className="font-bold" style={{ color: theme.colors.text }}>
                    {user.points.toLocaleString('tr-TR')}
                  </div>
                </div>
              )}
            </div>
            <ThemedButton className="w-full" size="lg" disabled={busy} onClick={status === 'done' ? () => { newRound(); deal(); } : deal}>
              {busy ? 'Dağıtılıyor...' : status === 'done' ? 'Yeni El' : 'Dağıt'}
            </ThemedButton>
          </>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <ThemedButton variant="secondary" disabled={busy} onClick={() => handleAction('hit')}>
              Kart Çek
            </ThemedButton>
            <ThemedButton variant="outline" disabled={busy} onClick={() => handleAction('stand')}>
              Dur
            </ThemedButton>
            <ThemedButton
              variant="secondary"
              disabled={busy || !canDouble || !user || user.points < betAmount}
              onClick={() => handleAction('double')}
            >
              Double
            </ThemedButton>
          </div>
        )}
      </div>
    </div>
  )
}
