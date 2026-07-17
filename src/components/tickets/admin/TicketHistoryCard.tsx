'use client'

import { useState } from 'react'
import { Trophy, Copy, Eye, Award, Users, Calendar, Banknote, ChevronRight, Infinity } from 'lucide-react'

// Mavi tema renkleri
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

interface Prize {
  id?: string
  prizeAmount: number
  winnerCount: number
}

interface Sponsor {
  id: string
  name: string
  category: string
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

interface TicketHistoryCardProps {
  event: TicketEvent
  onCopyWinners: (event: TicketEvent) => void
  onViewDetails: (eventId: string) => void
  formatAmount: (amount: number) => string
  formatDateTR: (date: string | Date) => string
}

export function TicketHistoryCard({
  event,
  onCopyWinners,
  onViewDetails,
  formatAmount,
  formatDateTR
}: TicketHistoryCardProps) {
  const [detailHovered, setDetailHovered] = useState(false)
  const [copyHovered, setCopyHovered] = useState(false)
  const totalPrize = event.prizes.reduce((sum, p) => sum + (p.prizeAmount * p.winnerCount), 0)
  const hasEndDate = event.endDate !== null

  return (
    <div
      onClick={() => onViewDetails(event.id)}
      className="relative cursor-pointer rounded-2xl overflow-hidden transition-all duration-300"
      style={{
        background: theme.card,
        border: `1px solid ${theme.border}`,
        boxShadow: `0 4px 16px rgba(0,0,0,0.1)`
      }}
    >
      {/* Status Indicator Bar */}
      <div className="h-1" style={{ background: theme.textMuted }} />

      <div className="p-4">
        {/* Header Section */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="font-semibold text-sm leading-tight line-clamp-2" style={{ color: theme.text }}>
                {event.title}
              </h3>
              <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: theme.textMuted }} />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium"
                style={{
                  background: `${theme.textMuted}20`,
                  color: theme.textSecondary
                }}
              >
                <span className="w-1 h-1 rounded-full" style={{ background: theme.textSecondary }} />
                Tamamlandı
              </span>
              <span className="text-[10px]" style={{ color: theme.textMuted }}>{event.sponsor.name}</span>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div
            className="p-2 rounded-lg text-center"
            style={{
              background: `${theme.backgroundSecondary}50`,
              border: `1px solid ${theme.border}`
            }}
          >
            <Banknote className="w-3.5 h-3.5 mx-auto mb-0.5" style={{ color: theme.primary }} />
            <div className="text-sm font-semibold" style={{ color: theme.primaryLight }}>{formatAmount(event.ticketPrice)}</div>
            <div className="text-[9px] uppercase tracking-wide" style={{ color: theme.textMuted }}>Fiyat</div>
          </div>
          <div
            className="p-2 rounded-lg text-center"
            style={{
              background: `${theme.backgroundSecondary}50`,
              border: `1px solid ${theme.border}`
            }}
          >
            <Users className="w-3.5 h-3.5 mx-auto mb-0.5" style={{ color: theme.primary }} />
            <div className="text-sm font-semibold" style={{ color: theme.text }}>{event.totalTickets ?? 'Sınırsız'}</div>
            <div className="text-[9px] uppercase tracking-wide" style={{ color: theme.textMuted }}>Toplam</div>
          </div>
          <div
            className="p-2 rounded-lg text-center"
            style={{
              background: `${theme.backgroundSecondary}50`,
              border: `1px solid ${theme.border}`
            }}
          >
            {hasEndDate ? (
              <>
                <Calendar className="w-3.5 h-3.5 mx-auto mb-0.5" style={{ color: theme.primary }} />
                <div className="text-[10px] font-semibold" style={{ color: theme.text }}>{formatDateTR(event.endDate!)}</div>
                <div className="text-[9px] uppercase tracking-wide" style={{ color: theme.textMuted }}>Bitiş</div>
              </>
            ) : (
              <>
                <Infinity className="w-3.5 h-3.5 mx-auto mb-0.5" style={{ color: theme.primary }} />
                <div className="text-[10px] font-semibold" style={{ color: theme.primaryLight }}>Süresiz</div>
                <div className="text-[9px] uppercase tracking-wide" style={{ color: theme.textMuted }}>Süre</div>
              </>
            )}
          </div>
        </div>

        {/* Prizes Section */}
        <div
          className="p-2.5 rounded-lg mb-3"
          style={{
            background: `${theme.backgroundSecondary}30`,
            border: `1px solid ${theme.border}`
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Trophy className="w-3 h-3" style={{ color: '#f59e0b' }} />
              <span className="text-[10px]" style={{ color: theme.textMuted }}>Ödüller</span>
            </div>
            <span className="text-xs font-semibold" style={{ color: '#fbbf24' }}>{formatAmount(totalPrize)} TL</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {event.prizes.map((prize, idx) => (
              <div
                key={prize.id || idx}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded"
                style={{
                  background: `${theme.warning}10`,
                  border: `1px solid ${theme.warning}20`
                }}
              >
                <Award className="w-2.5 h-2.5" style={{ color: '#fbbf24' }} />
                <span className="font-medium text-[10px]" style={{ color: '#fbbf24' }}>{formatAmount(prize.prizeAmount)}</span>
                <span className="text-[9px]" style={{ color: theme.textMuted }}>x{prize.winnerCount}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onViewDetails(event.id)}
            onMouseEnter={() => setDetailHovered(true)}
            onMouseLeave={() => setDetailHovered(false)}
            className="flex-1 h-8 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors duration-200"
            style={{
              background: detailHovered ? theme.backgroundSecondary : `${theme.backgroundSecondary}80`,
              color: detailHovered ? theme.text : theme.textSecondary,
              border: `1px solid ${theme.border}`
            }}
          >
            <Eye className="w-3.5 h-3.5" />
            Detay
          </button>
          <button
            onClick={() => onCopyWinners(event)}
            onMouseEnter={() => setCopyHovered(true)}
            onMouseLeave={() => setCopyHovered(false)}
            className="h-8 px-4 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors duration-200"
            style={{
              background: copyHovered ? `${theme.primaryDark}30` : `${theme.primary}15`,
              color: theme.primaryLight,
              border: `1px solid ${theme.primary}30`
            }}
          >
            <Copy className="w-3.5 h-3.5" />
            Kopyala
          </button>
        </div>
      </div>
    </div>
  )
}
