'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ThemedButton } from '@/components/ui/themed'
import { useUserTheme } from '@/components/providers/user-theme-provider'
import { useVerification } from '@/lib/hooks/useVerification'
import VerificationRequiredModal from '@/components/VerificationRequiredModal'
import {
  Calendar,
  Users,
  Award,
  Trophy,
  ArrowLeft,
  Clock,
  Loader2,
  Gift,
  Sparkles,
  Ticket
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/components/providers/auth-provider'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import HighlightedText from '@/components/HighlightedText'
import Image from 'next/image'
import { optimizeCloudinaryImage } from '@/lib/utils'

interface TicketEvent {
  id: string
  title: string
  description: string
  status: string
  imageUrl?: string | null
  sponsor: {
    id: string
    name: string
    logoUrl?: string
    description?: string
    identifierType?: string
  }
  totalTickets: number | null
  ticketPrice: number
  soldTickets: number
  endDate: string | null
  prizes: Array<{
    id?: string
    prizeAmount: number
    winnerCount: number
    winners?: Array<{
      ticketNumber: {
        ticketNumber: number
        user?: {
          siteUsername?: string
          email?: string
        }
      }
    }>
  }>
  _count?: {
    ticketNumbers: number
    requests: number
  }
  uniqueParticipants?: number
  userJoined?: boolean
}

export default function TicketDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user, setShowLoginModal, refreshUser } = useAuth()
  const { theme, card, button, badge } = useUserTheme()
  const {
    isFullyVerified,
    showVerificationModal,
    actionName,
    closeVerificationModal,
    requireVerification
  } = useVerification()
  const [loading, setLoading] = useState(true)
  const [event, setEvent] = useState<TicketEvent | null>(null)
  const [joining, setJoining] = useState(false)
  const [showSponsorForm, setShowSponsorForm] = useState(false)
  const [sponsorInfo, setSponsorInfo] = useState('')
  const [savingSponsorInfo, setSavingSponsorInfo] = useState(false)

  const formatDateTR = (date: string | Date) => {
    const d = new Date(date)
    return d.toLocaleString('tr-TR', {
      timeZone: 'Europe/Istanbul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatAmount = (amount: number) => {
    return amount.toLocaleString('tr-TR')
  }

  useEffect(() => {
    loadEvent()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.slug])

  async function loadEvent() {
    try {
      setLoading(true)
      const res = await fetch(`/api/tickets?eventId=${params.slug}`, { credentials: 'include' })
      const data = await res.json()

      if (data.events && data.events.length > 0) {
        setEvent(data.events[0])
      } else {
        toast.error('Etkinlik bulunamadi')
        router.push('/biletler')
      }
    } catch (error) {
      console.error('Error loading event:', error)
      toast.error('Etkinlik yüklenirken hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  async function handleJoinEvent() {
    if (!user) {
      toast.error('Bilet almak icin giris yapmalisiniz')
      setShowLoginModal(true)
      return
    }

    if (!event) return

    // Telegram ve email doğrulaması kontrolü
    if (!requireVerification(() => {
      handleJoinEventAfterVerification()
    }, 'bilet talep etmek')) {
      return
    }

    await handleJoinEventAfterVerification()
  }

  async function handleJoinEventAfterVerification() {
    if (!event) return

    try {
      const res = await fetch('/api/user/sponsor-info', { credentials: 'include' })
      const data = await res.json()
      const sponsorInfoData = data.sponsorInfos?.find((info: any) => info.sponsorId === event.sponsor.id)

      if (!sponsorInfoData) {
        setShowSponsorForm(true)
        toast.info(`Lütfen ${event.sponsor.name} bilginizi girin`)
        return
      }

      if (sponsorInfoData.status === 'pending') {
        toast.info('Sponsor bilginiz henüz onaylanmadı, onaylandıktan sonra katılabilirsiniz')
        return
      }
      if (sponsorInfoData.status && sponsorInfoData.status !== 'approved') {
        setSponsorInfo(sponsorInfoData.identifier || '')
        setShowSponsorForm(true)
        toast.error('Sponsor bilginiz onaylanmadı, lütfen kontrol edip tekrar gönderin')
        return
      }

      // Onaylı sponsor bilgisi var - direkt katıl, form yok
      await joinTicket()
    } catch (error) {
      console.error('Error checking sponsor info:', error)
      toast.error('Sponsor bilgisi kontrolü başarısız')
    }
  }

  async function joinTicket() {
    if (!event) return
    try {
      setJoining(true)
      const res = await fetch('/api/tickets/request', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: event.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Bilete katılınamadı')
        return
      }
      toast.success('🎟️ Bilete katıldınız!')
      setEvent((prev) => (prev ? { ...prev, userJoined: true } : prev))
      loadEvent()
    } catch (error) {
      console.error('Error joining ticket:', error)
      toast.error('Bilete katılırken hata oluştu')
    } finally {
      setJoining(false)
    }
  }

  async function saveSponsorInfo() {
    if (!sponsorInfo.trim()) {
      toast.error('Bilgi gerekli')
      return
    }

    try {
      setSavingSponsorInfo(true)
      const res = await fetch('/api/user/sponsor-info', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sponsorId: event?.sponsor.id,
          identifier: sponsorInfo.trim()
        })
      })

      if (!res.ok) throw new Error('Kaydedilemedi')

      toast.success('Bilginiz kaydedildi, onaylandıktan sonra bilete katılabilirsiniz')
      setShowSponsorForm(false)
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setSavingSponsorInfo(false)
    }
  }

  // Kalan süreyi hesapla
  const getTimeRemaining = () => {
    if (!event) return ''
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

  if (loading) {
    return (
      <LoadingSpinner fullscreen={false} className="min-h-[60vh]" />
    )
  }

  if (!event) {
    return null
  }

  const totalPrizePool = event.prizes.reduce((sum, p) => sum + (p.prizeAmount * p.winnerCount), 0)
  const fillPercentage = event.totalTickets && event.totalTickets > 0 ? (event.soldTickets / event.totalTickets) * 100 : 0
  const isPastEvent = event.status === 'completed' || event.status === 'waiting_draw'

  // Tüm kazananları düz liste haline getir
  const allWinners: Array<{
    ticketNumber: number
    username: string
    prizeAmount: number
    prizeOrder: number
  }> = []

  event.prizes.forEach((prize, prizeIdx) => {
    if (prize.winners) {
      prize.winners.forEach((winner) => {
        allWinners.push({
          ticketNumber: winner.ticketNumber.ticketNumber,
          username: winner.ticketNumber.user?.siteUsername || winner.ticketNumber.user?.email || 'Kullanıcı',
          prizeAmount: prize.prizeAmount,
          prizeOrder: prizeIdx + 1
        })
      })
    }
  })

  return (
    <>
      <div className="user-page-container">
        <div className="user-page-inner space-y-4 max-w-3xl mx-auto">
          {/* Back Button */}
          <ThemedButton
            onClick={() => router.push('/biletler')}
            variant="secondary"
            size="md"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Geri Don
          </ThemedButton>

          {/* Main Event Card */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: theme.colors.card,
              border: `1px solid ${theme.colors.border}`,
              boxShadow: `0 8px 32px ${theme.colors.gradientFrom}08, 0 2px 8px rgba(15,30,61,0.08)`
            }}
          >
            {/* Top accent line */}
            <div
              className="h-1.5"
              style={{
                background: `linear-gradient(90deg, ${theme.colors.gradientFrom}, ${theme.colors.gradientVia || theme.colors.gradientTo}, ${theme.colors.gradientTo})`
              }}
            />

            {/* Bilet görseli - 2:1 yatay oranda */}
            {(event.imageUrl || event.sponsor.logoUrl) && (
              <div className="relative w-full aspect-[2/1]" style={{ background: theme.colors.backgroundSecondary }}>
                <Image
                  src={optimizeCloudinaryImage((event.imageUrl || event.sponsor.logoUrl) as string, 1000, 500)}
                  unoptimized
                  alt={event.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 600px"
                  priority
                  className={event.imageUrl ? 'object-cover' : 'object-contain p-8'}
                />
              </div>
            )}

            <div className="p-6 space-y-5">
              {/* Header: Logo + Title */}
              <div className="flex items-start gap-4">
                <div
                  className="flex-shrink-0 w-24 h-14 relative rounded-2xl overflow-hidden"
                  style={{
                    background: `linear-gradient(145deg, ${theme.colors.backgroundSecondary}, ${theme.colors.background})`,
                  }}
                >
                  {event.sponsor.logoUrl ? (
                    <Image
                      src={optimizeCloudinaryImage(event.sponsor.logoUrl, 192, 112)}
                      unoptimized
                      alt={event.sponsor.name}
                      fill
                      sizes="64px"
                      priority
                      loading="eager"
                      className="object-contain p-2"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Ticket className="w-8 h-8" style={{ color: theme.colors.textMuted }} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="font-display text-xl font-bold mb-2" style={{ color: theme.colors.text }}>
                    {event.title}
                  </h1>
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                    style={{
                      background: `linear-gradient(135deg, ${theme.colors.accent}15, ${theme.colors.primary}10)`,
                      color: theme.colors.accent,
                      border: `1px solid ${theme.colors.accent}25`
                    }}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Çekiliş
                  </span>
                </div>
              </div>

              {/* Toplam Ödül */}
              {totalPrizePool > 0 && (
                <div
                  className="py-4 px-5 rounded-xl text-center"
                  style={{
                    background: `linear-gradient(145deg, ${theme.colors.success}10, ${theme.colors.success}05)`,
                    border: `1px solid ${theme.colors.success}20`
                  }}
                >
                  <div
                    className="text-xs font-semibold uppercase tracking-wider mb-2"
                    style={{ color: theme.colors.text }}
                  >
                    Toplam Ödül Havuzu
                  </div>
                  <div
                    className="text-4xl leading-none font-black"
                    style={{ color: theme.colors.success }}
                  >
                    {formatAmount(totalPrizePool)}TL
                  </div>
                </div>
              )}

              {/* Stats Grid - 3 columns */}
              <div className="grid grid-cols-3 gap-3">
                <div
                  className="p-4 rounded-xl text-center"
                  style={{
                    background: `linear-gradient(145deg, ${theme.colors.backgroundSecondary}, ${theme.colors.card})`,
                    border: `1px solid ${theme.colors.border}60`
                  }}
                >
                  <div className="flex items-center justify-center gap-1.5 mb-2">
                    <Trophy className="w-4 h-4" style={{ color: theme.colors.primary }} />
                    <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: theme.colors.text }}>Bilet</span>
                  </div>
                  <div className="text-2xl font-black" style={{ color: theme.colors.text }}>
                    {event.totalTickets ?? 'Sınırsız'}
                  </div>
                </div>
                <div
                  className="p-4 rounded-xl text-center"
                  style={{
                    background: `linear-gradient(145deg, ${theme.colors.backgroundSecondary}, ${theme.colors.card})`,
                    border: `1px solid ${theme.colors.border}60`
                  }}
                >
                  <div className="flex items-center justify-center gap-1.5 mb-2">
                    <Users className="w-4 h-4" style={{ color: theme.colors.primary }} />
                    <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: theme.colors.text }}>Katılımcı</span>
                  </div>
                  <div className="text-2xl font-black" style={{ color: theme.colors.text }}>
                    {event._count?.requests ?? 0}
                  </div>
                </div>
                <div
                  className="p-4 rounded-xl text-center"
                  style={{
                    background: `linear-gradient(145deg, ${theme.colors.backgroundSecondary}, ${theme.colors.card})`,
                    border: `1px solid ${theme.colors.border}60`
                  }}
                >
                  <div className="flex items-center justify-center gap-1.5 mb-2">
                    <Ticket className="w-4 h-4" style={{ color: theme.colors.textMuted }} />
                    <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: theme.colors.text }}>Fiyat</span>
                  </div>
                  <div className="text-xl font-black" style={{ color: theme.colors.text }}>
                    {formatAmount(event.ticketPrice)}TL
                  </div>
                </div>
              </div>

              {/* Time Remaining for active events */}
              {!isPastEvent && (
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

              {/* Progress - sadece sabit bilet sayısı varsa */}
              {!isPastEvent && event.totalTickets && (
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

              {/* Bitis Tarihi */}
              {!isPastEvent && event.endDate && (
                <div
                  className="flex items-center justify-between py-3 px-4 rounded-xl"
                  style={{
                    background: `linear-gradient(145deg, ${theme.colors.backgroundSecondary}, ${theme.colors.card})`,
                    border: `1px solid ${theme.colors.border}60`
                  }}
                >
                  <span className="text-sm font-medium" style={{ color: theme.colors.text }}>Bitiş Tarihi</span>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" style={{ color: theme.colors.textMuted }} />
                    <span className="text-sm font-bold" style={{ color: theme.colors.text }}>{formatDateTR(event.endDate)}</span>
                  </div>
                </div>
              )}

              {/* Açıklama */}
              {event.description && (
                <div
                  className="pt-4"
                  style={{ borderTop: `1px solid ${theme.colors.border}40` }}
                >
                  <h4 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: theme.colors.text }}>
                    <Gift className="w-4 h-4" style={{ color: theme.colors.gradientFrom }} />
                    Etkinlik Açıklaması
                  </h4>
                  <HighlightedText text={event.description} className="text-sm leading-relaxed" style={{ color: theme.colors.textSecondary }} />
                </div>
              )}

              {/* Ödül Havuzu */}
              <div
                className="pt-4"
                style={{ borderTop: `1px solid ${theme.colors.border}40` }}
              >
                <h4 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: theme.colors.text }}>
                  <Trophy className="w-4 h-4" style={{ color: theme.colors.primary }} />
                  Ödül Detayları
                </h4>
                <div className="space-y-2">
                  {event.prizes.map((prize, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-xl"
                      style={{
                        background: `linear-gradient(145deg, ${theme.colors.backgroundSecondary}, ${theme.colors.card})`,
                        border: `1px solid ${theme.colors.border}40`,
                        borderLeft: `3px solid ${theme.colors.primary}`
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                          style={{
                            background: `linear-gradient(135deg, ${theme.colors.gradientFrom}30, ${theme.colors.gradientTo}20)`,
                            color: theme.colors.text
                          }}
                        >
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-sm" style={{ color: theme.colors.text }}>
                          {formatAmount(prize.prizeAmount)} TL
                        </span>
                      </div>
                      <span className="text-xs px-2 py-1 rounded-lg" style={{
                        background: `${theme.colors.primary}15`,
                        color: theme.colors.primary
                      }}>
                        {prize.winnerCount} kisiye
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Katıl Butonu */}
              {!isPastEvent && (
                <ThemedButton
                  onClick={handleJoinEvent}
                  variant={event.userJoined ? 'secondary' : 'primary'}
                  size="lg"
                  className="w-full py-4"
                  disabled={joining || event.userJoined}
                >
                  <Ticket className="w-5 h-5 mr-2" />
                  {joining ? 'Katılınıyor...' : event.userJoined ? '✓ Katıldınız' : 'Katıl'}
                </ThemedButton>
              )}

              {/* Kazananlar - Kart içinde */}
              {event.status === 'completed' && (
                <div
                  className="pt-4"
                  style={{ borderTop: `1px solid ${theme.colors.border}40` }}
                >
                  <h4 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: theme.colors.text }}>
                    <Trophy className="w-4 h-4" style={{ color: theme.colors.primary }} />
                    Kazananlar ({allWinners.length})
                  </h4>

                  {allWinners.length > 0 ? (
                    <div className="space-y-2">
                      {allWinners.map((winner, idx) => {
                        const isCurrentUser = winner.username === user?.siteUsername || winner.username === user?.email

                        return (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-3 rounded-xl"
                            style={{
                              background: isCurrentUser
                                ? `linear-gradient(135deg, ${theme.colors.primary}15, ${theme.colors.primary}08)`
                                : `${theme.colors.backgroundSecondary}60`,
                              border: `1px solid ${isCurrentUser ? theme.colors.primary : theme.colors.border}30`
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <span
                                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                                style={{
                                  background: `linear-gradient(135deg, ${theme.colors.gradientFrom}30, ${theme.colors.gradientTo}20)`,
                                  color: theme.colors.text
                                }}
                              >
                                {idx + 1}
                              </span>
                              <div>
                                <p className="font-semibold text-sm" style={{ color: theme.colors.text }}>
                                  {winner.username}
                                </p>
                                <p className="text-xs font-mono" style={{ color: theme.colors.primary }}>
                                  Bilet #{winner.ticketNumber}
                                </p>
                              </div>
                            </div>
                            <span
                              className="px-2.5 py-1 rounded-full text-xs font-semibold"
                              style={{
                                background: `${theme.colors.primary}20`,
                                color: theme.colors.primary
                              }}
                            >
                              {formatAmount(winner.prizeAmount)} TL
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-sm" style={{ color: theme.colors.textMuted }}>
                      Kazanan belirlenmedi
                    </div>
                  )}
                </div>
              )}

              {/* Bekliyor durumu */}
              {event.status === 'waiting_draw' && (
                <div
                  className="pt-4 text-center"
                  style={{ borderTop: `1px solid ${theme.colors.border}40` }}
                >
                  <div
                    className="w-16 h-16 mx-auto mb-3 rounded-2xl flex items-center justify-center"
                    style={{
                      background: `linear-gradient(135deg, ${theme.colors.primary}15, ${theme.colors.primary}08)`,
                      border: `1px solid ${theme.colors.primary}20`
                    }}
                  >
                    <Sparkles className="w-8 h-8" style={{ color: theme.colors.primary }} />
                  </div>
                  <p className="text-sm font-medium" style={{ color: theme.colors.primary }}>
                    Çekiliş bekleniyor...
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sponsor Info Dialog */}
      <AlertDialog open={showSponsorForm} onOpenChange={(open) => {
        if (!open) {
          setShowSponsorForm(false)
          setSponsorInfo('')
        }
      }}>
        <AlertDialogContent
          className="rounded-2xl border"
          style={{
            background: theme.colors.card,
            borderColor: theme.colors.border
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold" style={{ color: theme.colors.text }}>Sponsor Bilgisi Gerekli</AlertDialogTitle>
            <AlertDialogDescription style={{ color: theme.colors.textSecondary }}>
              <span className="space-y-4 block">
                <span className="flex items-center gap-4">
                  {event?.sponsor.logoUrl && (
                    <span
                      className="w-14 h-14 rounded-full overflow-hidden relative inline-block"
                      style={{
                        background: `linear-gradient(145deg, ${theme.colors.backgroundSecondary}, ${theme.colors.background})`,
                        border: `1px solid ${theme.colors.border}`
                      }}
                    >
                      <Image
                        src={optimizeCloudinaryImage(event.sponsor.logoUrl, 112, 112)}
                        unoptimized
                        alt={event.sponsor.name}
                        fill
                        className="object-contain p-2"
                      />
                    </span>
                  )}
                  <span className="block">
                    <span className="font-bold block" style={{ color: theme.colors.text }}>{event?.sponsor.name}</span>
                    <span className="text-sm block" style={{ color: theme.colors.textMuted }}>{event?.title}</span>
                  </span>
                </span>

                <span className="space-y-3 py-2 block">
                  <span className="text-sm block" style={{ color: theme.colors.textSecondary }}>Bu etkinlige katilabilmek icin sponsor bilginizi eklemeniz gerekmektedir.</span>
                  <span className="space-y-2 block">
                    <Label className="text-sm font-semibold" style={{ color: theme.colors.text }}>
                      {event?.sponsor.identifierType === 'username' ? 'Kullanıcı Adı' :
                       event?.sponsor.identifierType === 'phone' ? 'Telefon Numarasi' :
                       event?.sponsor.identifierType === 'email' ? 'E-posta' : 'ID'}
                    </Label>
                    <Input
                      value={sponsorInfo}
                      onChange={(e) => setSponsorInfo(e.target.value)}
                      placeholder={
                        event?.sponsor.identifierType === 'username' ? 'Kullanıcı adinizi girin' :
                        event?.sponsor.identifierType === 'phone' ? 'Telefon numaranizi girin' :
                        event?.sponsor.identifierType === 'email' ? 'E-posta adresinizi girin' : 'ID girin'
                      }
                      className="rounded-xl"
                      style={{
                        background: theme.colors.backgroundSecondary,
                        borderColor: theme.colors.border,
                        color: theme.colors.text
                      }}
                      disabled={savingSponsorInfo}
                    />
                  </span>
                </span>
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <ThemedButton
              onClick={() => setShowSponsorForm(false)}
              variant="secondary"
              size="md"
              disabled={savingSponsorInfo}
            >
              İptal
            </ThemedButton>
            <ThemedButton
              onClick={saveSponsorInfo}
              disabled={savingSponsorInfo || !sponsorInfo.trim()}
              variant="primary"
              size="md"
            >
              {savingSponsorInfo ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Kaydediliyor...
                </>
              ) : (
                'Kaydet ve Devam Et'
              )}
            </ThemedButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Verification Required Modal */}
      <VerificationRequiredModal
        isOpen={showVerificationModal}
        onClose={closeVerificationModal}
        onSuccess={() => {
          closeVerificationModal()
          refreshUser()
          // Doğrulama tamamlandıktan sonra işlemi devam ettir
          handleJoinEventAfterVerification()
        }}
        actionName={actionName}
      />
    </>
  )
}
