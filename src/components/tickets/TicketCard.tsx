'use client'

import { useUserTheme } from '@/components/providers/user-theme-provider'
import { Badge } from '@/components/ui/badge'
import { ThemedButton } from '@/components/ui/themed'
import { Users, Calendar, Trophy, Clock, Eye, Sparkles, Ticket, CheckCircle } from 'lucide-react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { optimizeCloudinaryImage } from '@/lib/utils'

interface TicketEvent {
  id: string
  slug?: string | null
  title: string
  description: string
  status?: string
  imageUrl?: string | null
  sponsor: {
    id: string
    name: string
    logoUrl?: string
    description?: string
  }
  totalTickets: number | null
  ticketPrice: number
  soldTickets: number
  requireApprovedSponsor?: boolean
  endDate: string | null
  prizes: Array<{
    id?: string
    prizeAmount: number
    winnerCount: number
  }>
  _count?: {
    ticketNumbers: number
    requests: number
  }
  uniqueParticipants?: number
  userJoined?: boolean
}

interface TicketCardProps {
  event: TicketEvent
  type?: 'user' | 'admin'
  formatAmount: (amount: number) => string
  formatDateTR: (date: string | Date) => string
  onJoinClick?: (event: TicketEvent) => void
}

export function TicketCard({ event, type = 'user', formatAmount, formatDateTR, onJoinClick }: TicketCardProps) {
  const router = useRouter()
  const { theme, card } = useUserTheme()
  const totalPrizePool = event.prizes.reduce((sum, p) => sum + (p.prizeAmount * p.winnerCount), 0)
  const basePath = type === 'admin' ? '/admin/tickets' : '/tickets'
  const detailSlug = type === 'admin' ? event.id : (event.slug || event.id)

  const handleDetailClick = () => {
    router.push(`${basePath}/${detailSlug}`)
  }

  const handleJoinClick = () => {
    if (onJoinClick) {
      onJoinClick(event)
    } else {
      router.push(`${basePath}/${detailSlug}`)
    }
  }

  // Kalan süreyi hesapla
  const getTimeRemaining = () => {
    if (!event.endDate) return 'Süresiz'
    const now = new Date().getTime()
    const end = new Date(event.endDate).getTime()
    const diff = end - now

    if (diff <= 0) return 'Sona erdi'

    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    if (days > 0) return `${days} gun ${hours} saat`
    if (hours > 0) return `${hours} saat ${minutes} dk`
    return `${minutes} dakika`
  }

  // Doluluk oranı
  const fillPercentage = event.totalTickets && event.totalTickets > 0 ? (event.soldTickets / event.totalTickets) * 100 : 0

  return (
    <div
      className="relative rounded-2xl overflow-hidden transition-all duration-200 hover:-translate-y-1 h-full flex flex-col"
      style={{
        background: theme.colors.card,
        border: `1px solid ${theme.colors.border}`,
        boxShadow: `0 8px 32px ${theme.colors.gradientFrom}08, 0 2px 8px rgba(15,30,61,0.08)`
      }}
    >
      {/* Top accent line */}
      <div
        className="h-1"
        style={{
          background: `linear-gradient(90deg, ${theme.colors.gradientFrom}, ${theme.colors.gradientVia || theme.colors.gradientTo}, ${theme.colors.gradientTo})`
        }}
      />

      {/* Bilet görseli - 2:1 yatay oranda. Kendi görseli yoksa sponsor
          logosunu gösterir, o da yoksa alan hiç açılmaz. */}
      {(event.imageUrl || event.sponsor.logoUrl) && (
        <div className="relative w-full aspect-[2/1]" style={{ background: theme.colors.backgroundSecondary }}>
          <Image
            src={optimizeCloudinaryImage((event.imageUrl || event.sponsor.logoUrl) as string, 600, 300)}
            unoptimized
            alt={event.title}
            fill
            sizes="(max-width: 768px) 100vw, 400px"
            loading="lazy"
            placeholder="blur"
            blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNjAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iI0U0RUVGRiIvPjwvc3ZnPg=="
            className={event.imageUrl ? 'object-cover' : 'object-contain p-6'}
          />
        </div>
      )}

      <div className="p-3 sm:p-5 space-y-2.5 sm:space-y-4 flex-1 flex flex-col">
        {/* Header: Logo + Title + Type Badge */}
        <div className="flex items-start gap-4">
          <div
            className="flex-shrink-0 w-14 h-9 sm:w-20 sm:h-14 relative rounded-xl sm:rounded-2xl overflow-hidden"
            style={{
              background: `linear-gradient(145deg, ${theme.colors.backgroundSecondary}, ${theme.colors.background})`,
            }}
          >
            {event.sponsor.logoUrl ? (
              <Image
                src={optimizeCloudinaryImage(event.sponsor.logoUrl, 128, 128)}
                unoptimized
                alt={event.sponsor.name}
                fill
                sizes="64px"
                loading="lazy"
                placeholder="blur"
                blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgZmlsbD0iI0U0RUVGRiIvPjwvc3ZnPg=="
                className="object-contain p-2.5"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Ticket className="w-6 h-6" style={{ color: theme.colors.textMuted }} />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-display text-sm sm:text-base font-bold line-clamp-2 leading-snug mb-2" style={{ color: theme.colors.text }}>
              {event.title}
            </h3>
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                style={{
                  background: `linear-gradient(135deg, ${theme.colors.accent}15, ${theme.colors.primary}10)`,
                  color: theme.colors.accent,
                  border: `1px solid ${theme.colors.accent}25`
                }}
              >
                <Sparkles className="w-3 h-3" />
                Çekiliş
              </span>
              {event.requireApprovedSponsor && (
                <span
                  className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
                  style={{ background: theme.colors.warning, color: '#fff' }}
                >
                  ✅ Onay Gerekli
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Toplam Ödül - Büyük Yeşil */}
        {totalPrizePool > 0 && (
          <div
            className="py-3 px-4 rounded-xl text-center"
            style={{
              background: `linear-gradient(145deg, ${theme.colors.success}10, ${theme.colors.success}05)`,
              border: `1px solid ${theme.colors.success}20`
            }}
          >
            <div
              className="text-[10px] font-semibold uppercase tracking-wider mb-1"
              style={{ color: theme.colors.text }}
            >
              Toplam Ödül
            </div>
            <div
              className="text-3xl leading-none font-black"
              style={{ color: theme.colors.success }}
            >
              {formatAmount(totalPrizePool)}TL
            </div>
          </div>
        )}

        {/* Stats Grid - 3 columns like events */}
        <div className="grid grid-cols-3 gap-3">
          <div
            className="p-3.5 rounded-xl text-center"
            style={{
              background: `linear-gradient(145deg, ${theme.colors.backgroundSecondary}, ${theme.colors.card})`,
              border: `1px solid ${theme.colors.border}60`
            }}
          >
            <div className="flex items-center justify-center gap-1.5 mb-1.5">
              <Trophy className="w-4 h-4" style={{ color: theme.colors.primary }} />
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: theme.colors.text }}>Bilet</span>
            </div>
            <div className="text-lg sm:text-2xl font-black" style={{ color: theme.colors.text }}>
              {event.totalTickets ?? 'Sınırsız'}
            </div>
          </div>
          <div
            className="p-3.5 rounded-xl text-center"
            style={{
              background: `linear-gradient(145deg, ${theme.colors.backgroundSecondary}, ${theme.colors.card})`,
              border: `1px solid ${theme.colors.border}60`
            }}
          >
            <div className="flex items-center justify-center gap-1.5 mb-1.5">
              <Users className="w-4 h-4" style={{ color: theme.colors.primary }} />
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: theme.colors.text }}>Katılımcı</span>
            </div>
            <div className="text-lg sm:text-2xl font-black" style={{ color: theme.colors.text }}>
              {event._count?.requests ?? 0}
            </div>
          </div>
          <div
            className="p-3.5 rounded-xl text-center"
            style={{
              background: `linear-gradient(145deg, ${theme.colors.backgroundSecondary}, ${theme.colors.card})`,
              border: `1px solid ${theme.colors.border}60`
            }}
          >
            <div className="flex items-center justify-center gap-1.5 mb-1.5">
              <Ticket className="w-4 h-4" style={{ color: theme.colors.textMuted }} />
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: theme.colors.text }}>Fiyat</span>
            </div>
            <div className="text-lg font-black" style={{ color: theme.colors.text }}>
              {formatAmount(event.ticketPrice)}TL
            </div>
          </div>
        </div>

        {/* Doluluk Oranı - Aktif durumda, sadece sabit bilet sayısı varsa (sınırsızda anlamsız) */}
        {event.status === 'active' && event.totalTickets && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium" style={{ color: theme.colors.text }}>Doluluk Orani</span>
              <span className="font-bold" style={{ color: theme.colors.text }}>{Math.round(fillPercentage)}%</span>
            </div>
            <div
              className="w-full h-3 rounded-full overflow-hidden"
              style={{ background: `${theme.colors.border}40` }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${fillPercentage}%`,
                  background: `linear-gradient(90deg, ${theme.colors.gradientFrom}, ${theme.colors.gradientTo})`
                }}
              />
            </div>
          </div>
        )}

        {/* Time Remaining - styled like events */}
        {event.status === 'active' && (
          <div
            className="flex items-center justify-between py-3 px-4 rounded-xl"
            style={{
              background: `linear-gradient(135deg, ${theme.colors.primary}08, ${theme.colors.primary}04)`,
              border: `1px solid ${theme.colors.primary}20`
            }}
          >
            <span className="text-sm font-medium" style={{ color: theme.colors.text }}>Kalan Sure</span>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" style={{ color: theme.colors.primary }} />
              <span className="text-base font-bold" style={{ color: theme.colors.primary }}>{getTimeRemaining()}</span>
            </div>
          </div>
        )}

        {/* Butonlar - her zaman kartın en altında (mt-auto) */}
        <div className="mt-auto pt-1">
        {event.status === 'active' ? (
          <div className="grid grid-cols-2 gap-1.5 sm:gap-3">
            <ThemedButton
              onClick={handleDetailClick}
              variant="secondary"
              size="sm"
              className="text-xs sm:text-sm px-2 sm:px-4"
            >
              <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-1.5" />
              Detay
            </ThemedButton>
            {event.userJoined ? (
              <ThemedButton
                disabled
                variant="primary"
                size="sm"
                className="text-xs sm:text-sm px-2 sm:px-4"
                style={{
                  background: `linear-gradient(135deg, ${theme.colors.success}, ${theme.colors.success}cc)`,
                  boxShadow: `0 4px 16px ${theme.colors.success}30`,
                }}
              >
                <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-1.5" />
                Katıldınız
              </ThemedButton>
            ) : (
              <ThemedButton
                onClick={handleJoinClick}
                variant="primary"
                size="sm"
                className="text-xs sm:text-sm px-2 sm:px-4"
              >
                <Ticket className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-1.5" />
                Katıl
              </ThemedButton>
            )}
          </div>
        ) : (
          event.status === 'waiting_draw' ? (
            <ThemedButton
              onClick={handleDetailClick}
              variant="primary"
              size="lg"
              className="w-full"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Çekiliş Bekliyor
            </ThemedButton>
          ) : (
            <ThemedButton
              onClick={handleDetailClick}
              variant="secondary"
              size="lg"
              className="w-full"
            >
              <Eye className="w-4 h-4 mr-2" />
              Detaylari Gor
            </ThemedButton>
          )
        )}
        </div>
      </div>
    </div>
  )
}
