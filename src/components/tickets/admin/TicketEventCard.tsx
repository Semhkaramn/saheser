'use client'

import { useState } from 'react'
import { Trophy, Award, Eye, Clock, Users, Banknote, Calendar, Sparkles, Infinity } from 'lucide-react'

interface Prize {
  id?: string
  prizeAmount: number
  winnerCount: number
}

interface Sponsor {
  id: string
  name: string
  category: string
  logoUrl?: string
}

interface TicketEvent {
  id: string
  title: string
  description: string
  status: string
  sponsor: Sponsor
  totalTickets: number | null
  ticketPrice: number
  soldTickets: number
  endDate: string | null
  createdAt: string
  prizes: Prize[]
}

interface TicketEventCardProps {
  event: TicketEvent
  onViewDetails: (eventId: string) => void
  formatAmount: (amount: number) => string
  formatDateTR: (date: string | Date) => string
}

// Mavi tema renkleri (Events sayfasıyla aynı)
const theme = {
  primary: '#3b82f6',
  primaryLight: '#60a5fa',
  primaryDark: '#2563eb',
  gradientFrom: '#3b82f6',
  gradientTo: '#1d4ed8',
  warning: '#f59e0b',
  card: 'rgba(15, 23, 42, 0.8)',
  border: 'rgba(71, 85, 105, 0.5)',
  text: '#f1f5f9',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  background: '#0f172a',
  backgroundSecondary: '#1e293b',
}

export function TicketEventCard({
  event,
  onViewDetails,
  formatAmount,
  formatDateTR
}: TicketEventCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const isWaitingDraw = event.status === 'waiting_draw'
  const totalPrizePool = event.prizes.reduce((sum, p) => sum + (p.prizeAmount * p.winnerCount), 0)
  const hasEndDate = event.endDate !== null

  const getTimeRemaining = (endDate: string | null) => {
    if (!endDate) return null
    const now = new Date().getTime()
    const end = new Date(endDate).getTime()
    const diff = end - now

    if (diff <= 0) return 'Sona erdi'

    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    if (days > 0) return `${days}g ${hours}s`
    if (hours > 0) return `${hours}s ${minutes}dk`
    return `${minutes}dk`
  }

  return (
    <div
      className="relative rounded-2xl overflow-hidden transition-all duration-300"
      style={{
        background: theme.card,
        border: `1px solid ${theme.border}`,
        boxShadow: `0 8px 32px ${theme.gradientFrom}10, 0 2px 8px rgba(0,0,0,0.15)`
      }}
    >
      {/* Top accent line */}
      <div
        className="h-1"
        style={{
          background: isWaitingDraw
            ? `linear-gradient(90deg, ${theme.warning}, #d97706)`
            : `linear-gradient(90deg, ${theme.gradientFrom}, ${theme.gradientTo})`
        }}
      />

      <div className="p-5 space-y-4">
        {/* Header: Title + Status */}
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="font-bold text-base line-clamp-2 leading-snug" style={{ color: theme.text }}>
                {event.title}
              </h3>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Status Badge */}
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                style={{
                  background: isWaitingDraw ? `${theme.warning}20` : `${theme.primary}20`,
                  color: isWaitingDraw ? theme.warning : theme.primaryLight,
                  border: `1px solid ${isWaitingDraw ? `${theme.warning}30` : `${theme.primary}30`}`
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: isWaitingDraw ? theme.warning : theme.primary }}
                />
                {isWaitingDraw ? 'Çekiliş Bekliyor' : 'Aktif'}
              </span>

              {/* Sponsor Badge */}
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                style={{
                  background: `${theme.primary}15`,
                  color: theme.textSecondary,
                  border: `1px solid ${theme.border}`
                }}
              >
                <Sparkles className="w-3 h-3" />
                {event.sponsor.name}
              </span>

              {/* No End Date Badge */}
              {!hasEndDate && (
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                  style={{
                    background: `${theme.primary}15`,
                    color: theme.primaryLight,
                    border: `1px solid ${theme.primary}25`
                  }}
                >
                  <Infinity className="w-3 h-3" />
                  Süresiz
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2">
          {/* Fiyat */}
          <div
            className="p-3 rounded-xl text-center"
            style={{
              background: `linear-gradient(145deg, ${theme.backgroundSecondary}80, ${theme.background}60)`,
              border: `1px solid ${theme.border}`
            }}
          >
            <div className="flex items-center justify-center gap-1 mb-1">
              <Banknote className="w-3.5 h-3.5" style={{ color: theme.primary }} />
            </div>
            <div className="text-sm font-bold" style={{ color: theme.primaryLight }}>{formatAmount(event.ticketPrice)}</div>
            <div className="text-[9px] font-medium uppercase tracking-wide" style={{ color: theme.textMuted }}>
              Fiyat
            </div>
          </div>

          {/* Toplam */}
          <div
            className="p-3 rounded-xl text-center"
            style={{
              background: `linear-gradient(145deg, ${theme.backgroundSecondary}80, ${theme.background}60)`,
              border: `1px solid ${theme.border}`
            }}
          >
            <div className="flex items-center justify-center gap-1 mb-1">
              <Users className="w-3.5 h-3.5" style={{ color: theme.textMuted }} />
            </div>
            <div className="text-sm font-bold" style={{ color: theme.text }}>{event.totalTickets ?? 'Sınırsız'}</div>
            <div className="text-[9px] font-medium uppercase tracking-wide" style={{ color: theme.textMuted }}>
              Toplam
            </div>
          </div>

          {/* Ödül Havuzu */}
          <div
            className="p-3 rounded-xl text-center"
            style={{
              background: `linear-gradient(145deg, ${theme.backgroundSecondary}80, ${theme.background}60)`,
              border: `1px solid ${theme.border}`
            }}
          >
            <div className="flex items-center justify-center gap-1 mb-1">
              <Trophy className="w-3.5 h-3.5" style={{ color: '#f59e0b' }} />
            </div>
            <div className="text-sm font-bold" style={{ color: '#fbbf24' }}>{formatAmount(totalPrizePool)}</div>
            <div className="text-[9px] font-medium uppercase tracking-wide" style={{ color: theme.textMuted }}>
              Ödül
            </div>
          </div>
        </div>

        {/* Progress Section */}
        <div
          className="p-3 rounded-xl"
          style={{
            background: `${theme.backgroundSecondary}50`,
            border: `1px solid ${theme.border}`
          }}
        >
          {hasEndDate ? (
            <>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" style={{ color: theme.textMuted }} />
                  <span className="text-[11px] font-medium" style={{ color: theme.textSecondary }}>Kalan Süre</span>
                </div>
                <span className="text-[11px] font-bold" style={{ color: theme.primaryLight }}>{getTimeRemaining(event.endDate)}</span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" style={{ color: theme.textMuted }} />
                  <span className="text-[11px] font-medium" style={{ color: theme.textSecondary }}>Bitiş</span>
                </div>
                <span className="text-[11px] font-bold" style={{ color: theme.text }}>{formatDateTR(event.endDate!)}</span>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Infinity className="w-3.5 h-3.5" style={{ color: theme.primary }} />
                <span className="text-[11px] font-medium" style={{ color: theme.textSecondary }}>Süre</span>
              </div>
              <span className="text-[11px] font-bold" style={{ color: theme.primaryLight }}>Süresiz</span>
            </div>
          )}
        </div>

        {/* Detaylar Butonu */}
        <button
          onClick={() => onViewDetails(event.id)}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className="w-full h-10 text-sm font-semibold rounded-xl border-0 transition-colors duration-200 flex items-center justify-center gap-2"
          style={{
            background: isHovered
              ? `linear-gradient(135deg, ${theme.primaryDark}, #1e40af)`
              : `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})`,
            color: 'white',
            boxShadow: `0 4px 16px ${theme.gradientFrom}30`
          }}
        >
          <Eye className="w-4 h-4" />
          Detaylar
        </button>
      </div>
    </div>
  )
}
