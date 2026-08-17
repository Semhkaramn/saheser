'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useUserTheme } from '@/components/providers/user-theme-provider'
import { useAuth, useAuthActions } from '@/components/providers/auth-provider'
import { ThemedButton, ThemedInput, hexToRgba } from '@/components/ui/themed'
import PageHeader from '@/components/PageHeader'
import { Spade, ChevronLeft, Wallet, Plus, Hand, Copy } from 'lucide-react'
import GameGate from '@/components/games/GameGate'

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

function CardView({ card, hidden, index = 0, justRevealed = false }: { card?: Card; hidden?: boolean; index?: number; justRevealed?: boolean }) {
  const isRed = card && (card.suit === '♥' || card.suit === '♦')
  const delay = `${index * 140}ms`
  // Gerçek dağıtılmış kartlar gibi hafif, deterministik bir eğiklik (hydration uyumlu - Math.random yok)
  const tilt = ((index % 3) - 1) * 2.2

  if (hidden || !card) {
    return (
      <div
        className="relative w-14 h-20 sm:w-[4.5rem] sm:h-28 rounded-lg border-2 flex items-center justify-center flex-shrink-0 overflow-hidden animate-in fade-in slide-in-from-top-8 zoom-in-95 duration-400"
        style={{
          background: 'repeating-linear-gradient(135deg, #7f1d1d 0px, #7f1d1d 5px, #991b1b 5px, #991b1b 10px)',
          borderColor: '#d4af37',
          boxShadow: '0 4px 10px rgba(0,0,0,0.4)',
          animationDelay: delay,
          animationFillMode: 'backwards',
          transform: `rotate(${tilt}deg)`,
        }}
      >
        <div className="absolute inset-1 rounded border border-white/25" />
        <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full border-2 border-white/50 flex items-center justify-center">
          <span className="text-white/70 text-xs sm:text-sm font-black">♠</span>
        </div>
      </div>
    )
  }

  const suitColor = isRed ? '#dc2626' : '#18181b'

  return (
    <div
      key={justRevealed ? 'revealed' : undefined}
      className="relative w-14 h-20 sm:w-[4.5rem] sm:h-28 rounded-lg border flex-shrink-0 shadow-2xl animate-in zoom-in-90 fade-in slide-in-from-top-8 duration-400"
      style={{
        background: 'linear-gradient(160deg, #ffffff, #f1f5f9)',
        borderColor: 'rgba(0,0,0,0.15)',
        animationDelay: delay,
        animationFillMode: 'backwards',
        transform: `rotate(${tilt}deg)`,
        boxShadow: '0 6px 14px rgba(0,0,0,0.35)',
      }}
    >
      {/* Sol üst köşe indeksi (gerçek iskambil kartı gibi) */}
      <div className="absolute top-1 left-1.5 flex flex-col items-center leading-none" style={{ color: suitColor }}>
        <span className="text-xs sm:text-sm font-black">{card.rank}</span>
        <span className="text-xs sm:text-sm -mt-0.5">{card.suit}</span>
      </div>
      {/* Sağ alt köşe indeksi (180° döndürülmüş) */}
      <div
        className="absolute bottom-1 right-1.5 flex flex-col items-center leading-none rotate-180"
        style={{ color: suitColor }}
      >
        <span className="text-xs sm:text-sm font-black">{card.rank}</span>
        <span className="text-xs sm:text-sm -mt-0.5">{card.suit}</span>
      </div>
      {/* Ortadaki büyük sembol */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl sm:text-3xl" style={{ color: suitColor }}>
          {card.suit}
        </span>
      </div>
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

  // Sayfa açıldığında yarım kalmış bir el var mı kontrol et (yenileme/çıkış koruması)
  useEffect(() => {
    if (!user) return
    let cancelled = false
    fetch('/api/games/blackjack/active')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || !data.active) return
        const a = data.active
        setGamePlayId(a.gamePlayId)
        setBetAmount(a.betAmount)
        setPlayerHand(a.playerHand)
        setDealerHand([a.dealerUpcard])
        setDealerHidden(true)
        setPlayerValue(a.playerValue)
        setCanDouble(a.canDouble)
        setStatus('playing')
        toast.info('Yarım kalan elin kaldığı yerden devam ediyor')
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [user])


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
    <GameGate gameType="blackjack">
    <div className="max-w-3xl mx-auto">
      <PageHeader
        icon={Spade}
        title="Blackjack"
        action={
          <Link href="/oyunlar" className="text-sm font-medium flex items-center gap-1" style={{ color: theme.colors.textMuted }}>
            <ChevronLeft className="w-4 h-4" /> Oyunlar
          </Link>
        }
      />

      {/* Ahşap kasa çerçevesi */}
      <div
        className="rounded-[2rem] p-2.5"
        style={{
          background: 'linear-gradient(160deg, #7c4a24, #4a2c14)',
          boxShadow: '0 12px 30px rgba(0,0,0,0.5), inset 0 2px 4px rgba(255,255,255,0.15)',
        }}
      >
        <div
          className="rounded-[1.6rem] border-2 p-6 relative overflow-hidden"
          style={{
            background: 'radial-gradient(ellipse at top, #15803d 0%, #14532d 55%, #052e16 100%)',
            borderColor: 'rgba(212,175,55,0.4)',
            boxShadow: 'inset 0 0 70px rgba(0,0,0,0.55)',
          }}
        >
          {/* Masa üstü ince nokta dokusu (felt hissi) */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.07]"
            style={{ background: 'repeating-radial-gradient(circle at center, #fff 0px, transparent 2px, transparent 40px)' }}
          />

          {/* Kart destesi (shoe) - sağ üst köşe */}
          <div className="absolute top-4 right-4 sm:top-5 sm:right-5 flex flex-col items-center gap-0.5 opacity-80">
            <div className="relative w-8 h-11 sm:w-9 sm:h-12">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="absolute inset-0 rounded border"
                  style={{
                    background: 'repeating-linear-gradient(135deg, #7f1d1d 0px, #7f1d1d 4px, #991b1b 4px, #991b1b 8px)',
                    borderColor: '#d4af37',
                    transform: `translate(${i * 1.5}px, ${-i * 1.5}px)`,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Yarım daire bahis çizgisi - gerçek masalardaki oyuncu alanı çizgisi */}
          <div
            className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
            style={{
              bottom: '3.2rem',
              width: '92%',
              height: '140px',
              borderTop: '2px dashed rgba(212,175,55,0.25)',
              borderRadius: '50%',
            }}
          />

          {/* Masa yazısı - gerçek blackjack masalarındaki gibi */}
          <div className="relative text-center mb-4">
            <span
              className="text-[10px] sm:text-xs font-bold tracking-[0.2em] uppercase"
              style={{ color: 'rgba(212,175,55,0.55)' }}
            >
              Blackjack Öder 3:2 · Dealer 17'de Durur
            </span>
          </div>

          {betAmount > 0 && status !== 'idle' && (
            <div className="relative flex justify-center mb-5">
              <div className="relative w-12 h-12">
                {[0, 1].map((i) => (
                  <div
                    key={i}
                    className="absolute inset-0 rounded-full border-2"
                    style={{
                      borderColor: 'rgba(255,255,255,0.3)',
                      background: 'radial-gradient(circle at 35% 30%, #fbbf24, #b45309)',
                      transform: `translateY(${-i * 3}px)`,
                      boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                    }}
                  />
                ))}
                <div
                  className="absolute inset-0 rounded-full border-2 border-white/40 flex items-center justify-center text-xs font-black text-white"
                  style={{ background: 'radial-gradient(circle at 35% 30%, #fbbf24, #b45309)' }}
                  title="Masadaki bahis"
                >
                  {betAmount >= 1000 ? `${Math.round(betAmount / 1000)}k` : betAmount}
                </div>
              </div>
            </div>
          )}

          {/* Dealer eli */}
          <div className="relative mb-7">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold uppercase tracking-widest text-white/60">Dealer</span>
              {dealerValue && !dealerHidden && (
                <span
                  className="text-sm font-black text-white px-2.5 py-1 rounded-full border"
                  style={{ backgroundColor: 'rgba(0,0,0,0.35)', borderColor: 'rgba(212,175,55,0.4)' }}
                >
                  {dealerValue.total}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-3 min-h-[5.5rem] sm:min-h-[7.5rem] items-center">
              {status === 'idle' ? (
                <div className="text-white/30 text-sm">Eli başlatmak için bahis koy</div>
              ) : (
                dealerHand.map((c, i) => (
                  <CardView
                    key={`dealer-${i}-${i === 1 ? dealerHidden : 'x'}`}
                    card={c}
                    hidden={dealerHidden && i === 1}
                    index={i}
                  />
                ))
              )}
            </div>
          </div>

          {/* Sonuç banner */}
          {outcome && (
            <div
              className="relative text-center font-bold py-3 rounded-xl mb-5 animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-300 border"
              style={{
                backgroundColor: hexToRgba(OUTCOME_LABELS[outcome]?.color || '#fff', 0.15),
                borderColor: hexToRgba(OUTCOME_LABELS[outcome]?.color || '#fff', 0.4),
                color: OUTCOME_LABELS[outcome]?.color || '#fff',
                boxShadow: `0 4px 20px ${hexToRgba(OUTCOME_LABELS[outcome]?.color || '#fff', 0.25)}`,
              }}
            >
              {OUTCOME_LABELS[outcome]?.text}
              {payout > 0 && ` (+${payout} puan)`}
            </div>
          )}

          {/* Oyuncu eli */}
          <div className="relative mb-2">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold uppercase tracking-widest text-white/60">Sen</span>
              {playerValue && (
                <span
                  className="text-sm font-black text-white px-2.5 py-1 rounded-full border"
                  style={{ backgroundColor: 'rgba(0,0,0,0.35)', borderColor: 'rgba(212,175,55,0.4)' }}
                >
                  {playerValue.total}{playerValue.isSoft ? ' (soft)' : ''}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-3 min-h-[5.5rem] sm:min-h-[7.5rem] items-center">
              {playerHand.map((c, i) => (
                <CardView key={`player-${i}`} card={c} index={i} />
              ))}
            </div>
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
              <Plus className="w-4 h-4 mr-1" /> Kart Çek
            </ThemedButton>
            <ThemedButton variant="outline" disabled={busy} onClick={() => handleAction('stand')}>
              <Hand className="w-4 h-4 mr-1" /> Dur
            </ThemedButton>
            <ThemedButton
              variant="secondary"
              disabled={busy || !canDouble || !user || user.points < betAmount}
              onClick={() => handleAction('double')}
            >
              <Copy className="w-4 h-4 mr-1" /> Double
            </ThemedButton>
          </div>
        )}
      </div>
    </div>
    </GameGate>
  )
}
