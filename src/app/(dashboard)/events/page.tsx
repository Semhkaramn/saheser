'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Users, Calendar, Gift, Trophy, Loader2, Eye, CheckCircle, Sparkles, Clock, Crown } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import { useAuth } from '@/components/providers/auth-provider'
import { useUserTheme } from '@/components/providers/user-theme-provider'
import { optimizeCloudinaryImage } from '@/lib/utils'
import { useVerification } from '@/lib/hooks/useVerification'
import VerificationRequiredModal from '@/components/VerificationRequiredModal'
import {
  ThemedCard,
  ThemedBadge,
  ThemedButton,
  ThemedEmptyState,
  ThemedProgress,
} from '@/components/ui/themed'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { toast } from 'sonner'
import Image from 'next/image'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface Event {
  id: string
  title: string
  slug?: string | null
  imageUrl?: string
  sponsor: { id: string; name: string; logoUrl?: string; identifierType?: string }
  participantLimit: number
  participationType: 'limited' | 'raffle' | 'everyone'
  requireApprovedSponsor?: boolean
  participantCount: number
  endDate: string | null
  createdAt: string
  status: 'active' | 'pending' | 'completed'
  participants?: Array<{ userId?: string }>
  winners?: Array<{
    user: {
      id: string
      siteUsername?: string
      email?: string
      telegramUsername?: string
      firstName?: string
    }
  }>
  _count?: { participants: number; winners: number }
}

export default function EventsPage() {
  const router = useRouter()
  const { user, setShowLoginModal, refreshUser } = useAuth()
  const { theme, card, button, badge, tab } = useUserTheme()
  const {
    isFullyVerified,
    showVerificationModal,
    actionName,
    closeVerificationModal,
    requireVerification
  } = useVerification()
  // ✅ FIX: Eskiden useState+useEffect+fetch kullanıyordu - hiç önbellek
  // yoktu, her ziyarette yeniden yükleniyordu. React Query ile artık aynı
  // oturumda tekrar bu sayfaya gelince anında (önbellekten) gösteriliyor.
  const { data: eventsQueryData, isLoading: loading, refetch: refetchEvents } = useQuery({
    queryKey: ['events', user?.id],
    queryFn: async () => {
      const res = await fetch('/api/events')
      return res.json()
    },
    staleTime: 30 * 1000,
  })
  const events: Event[] = eventsQueryData?.events || []
  const [joiningEventId, setJoiningEventId] = useState<string | null>(null)
  const [joinedEvents, setJoinedEvents] = useState<Set<string>>(new Set())

  // Sponsor form popup state'leri
  const [showSponsorForm, setShowSponsorForm] = useState(false)
  const [sponsorInfo, setSponsorInfo] = useState('')
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [savingSponsor, setSavingSponsor] = useState(false)

  // joinedEvents'i sorgu verisinden türet (kullanıcının katıldığı etkinlikler)
  useEffect(() => {
    if (user && eventsQueryData?.events) {
      const joined = new Set<string>()
      eventsQueryData.events.forEach((event: Event) => {
        if (event.participants?.some(p => p.userId === user.id)) {
          joined.add(event.id)
        }
      })
      setJoinedEvents(joined)
    }
  }, [eventsQueryData, user])

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })

  const formatDateTime = (date: string) =>
    new Date(date).toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })

  async function joinEventDirectly(event: Event) {
    try {
      const res = await fetch(`/api/events/${event.id}/join`, { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error)
      }

      toast.success(data.message || 'Katıldınız!')
      setJoinedEvents(prev => new Set([...prev, event.id]))
      refetchEvents()
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  async function handleJoinEvent(event: Event) {
    if (!user) {
      setShowLoginModal(true)
      return
    }

    // Telegram ve email doğrulaması kontrolü
    if (!requireVerification(() => {
      // Doğrulama tamamlandıktan sonra tekrar dene
      handleJoinEventAfterVerification(event)
    }, 'etkinliğe katılmak')) {
      setSelectedEvent(event)
      return
    }

    await handleJoinEventAfterVerification(event)
  }

  async function handleJoinEventAfterVerification(event: Event) {
    setJoiningEventId(event.id)

    try {
      // Önce sponsor bilgisini kontrol et
      const sponsorRes = await fetch('/api/user/sponsor-info')
      const sponsorData = await sponsorRes.json()
      const sponsorInfoData = sponsorData.sponsorInfos?.find((info: any) => info.sponsorId === event.sponsor.id)

      if (!sponsorInfoData) {
        // Sponsor bilgisi yoksa popup aç
        setSelectedEvent(event)
        setShowSponsorForm(true)
        setJoiningEventId(null)
        return
      }

      // Sponsor bilgisi varsa direkt katıl
      await joinEventDirectly(event)
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setJoiningEventId(null)
    }
  }

  async function saveSponsorInfo() {
    if (!sponsorInfo.trim() || !selectedEvent) return toast.error('Bilgi gerekli')

    try {
      setSavingSponsor(true)
      const res = await fetch('/api/user/sponsor-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sponsorId: selectedEvent.sponsor.id,
          identifier: sponsorInfo.trim()
        })
      })

      if (!res.ok) throw new Error('Kaydedilemedi')

      toast.success('Sponsor bilgisi kaydedildi!')

      // Kaydettikten sonra otomatik katıl
      await joinEventDirectly(selectedEvent)

      // Formu kapat ve temizle
      setShowSponsorForm(false)
      setSponsorInfo('')
      setSelectedEvent(null)
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setSavingSponsor(false)
    }
  }

  const activeEvents = events.filter(e => e.status === 'active')
  const pastEvents = events
    .filter(e => e.status === 'completed' || e.status === 'pending')
    .sort((a, b) => {
      // Beklemede olanlar her zaman en üstte
      if (a.status === 'pending' && b.status !== 'pending') return -1
      if (a.status !== 'pending' && b.status === 'pending') return 1
      // Aynı durumdaysa yeniden eskiye sırala (endDate'e göre, süresizler en sona)
      if (!a.endDate) return 1
      if (!b.endDate) return -1
      return new Date(b.endDate).getTime() - new Date(a.endDate).getTime()
    })

  const EventCard = ({ event }: { event: Event }) => {
    const participated = user && (event.participants?.some(p => p.userId === user.id) || joinedEvents.has(event.id))
    const won = user && event.winners?.some(w => w.user.id === user.id)
    const progress = (event.participantCount / event.participantLimit) * 100
    const isRaffle = event.participationType === 'raffle'
    const isEveryone = event.participationType === 'everyone'
    const winnersCount = event._count?.winners || 0
    const isCompleted = event.status === 'completed' || event.status === 'pending'
    const isJoining = joiningEventId === event.id
    // Çekiliş tipinde limit kontrolü yok - participantLimit sadece kazanan sayısını belirtir
    // Sadece "limited" (ilk gelen alır) tipinde doluluk kontrolü yapılır
    const isFull = !isRaffle && event.participantCount >= event.participantLimit
    const isExpired = event.endDate ? new Date(event.endDate) < new Date() : false
    const canJoin = event.status === 'active' && !isFull && !isExpired && !participated

    const handleDetailClick = () => {
      router.push(`/events/${event.slug || event.id}`)
    }

    const handleJoinClick = () => {
      handleJoinEvent(event)
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
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      if (days > 0) return `${days}g ${hours}s ${minutes}dk`
      if (hours > 0) return `${hours}s ${minutes}dk ${seconds}sn`
      return `${minutes}dk ${seconds}sn`
    }

    return (
      <div
        className="relative rounded-2xl overflow-hidden transition-all duration-200 hover:-translate-y-1 h-full flex flex-col"
        style={{
          background: theme.colors.card,
          border: `1px solid ${theme.colors.border}`,
          boxShadow: `0 8px 32px ${theme.colors.gradientFrom}08, 0 2px 8px rgba(15,30,61,0.08)`
        }}
      >
        {/* Elegant top accent line */}
        <div
          className="h-1"
          style={{
            background: `linear-gradient(90deg, ${theme.colors.gradientFrom}, ${theme.colors.gradientVia || theme.colors.gradientTo}, ${theme.colors.gradientTo})`
          }}
        />

        <div className="p-3 sm:p-5 space-y-2.5 sm:space-y-4 flex-1 flex flex-col">
          {/* Header: Logo + Title + Type Badge */}
          <div className="flex items-start gap-4">
            <div
              className="flex-shrink-0 w-14 h-9 sm:w-20 sm:h-14 relative rounded-xl sm:rounded-2xl overflow-hidden"
              style={{
                background: event.imageUrl ? undefined : `linear-gradient(145deg, ${theme.colors.backgroundSecondary}, ${theme.colors.background})`,
              }}
            >
              <Image
                src={optimizeCloudinaryImage(event.imageUrl || event.sponsor.logoUrl || '/logo.webp', 128, 128)}
                unoptimized
                alt={event.title}
                fill
                sizes="64px"
                placeholder="blur"
                blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgZmlsbD0iI0U0RUVGRiIvPjwvc3ZnPg=="
                className={event.imageUrl ? 'object-cover' : 'object-contain p-2'}
              />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-display text-sm sm:text-base font-bold line-clamp-2 leading-snug mb-2" style={{ color: theme.colors.text }}>
                {event.title}
              </h3>
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                style={{
                  background: isEveryone
                    ? `linear-gradient(135deg, ${theme.colors.warning}15, ${theme.colors.warning}08)`
                    : isRaffle
                    ? `linear-gradient(135deg, ${theme.colors.accent}15, ${theme.colors.primary}10)`
                    : `linear-gradient(135deg, ${theme.colors.success}15, ${theme.colors.success}08)`,
                  color: isEveryone ? theme.colors.warning : isRaffle ? theme.colors.accent : theme.colors.success,
                  border: `1px solid ${(isEveryone ? theme.colors.warning : isRaffle ? theme.colors.accent : theme.colors.success)}25`
                }}
              >
                {isEveryone ? <Users className="w-3 h-3" /> : isRaffle ? <Sparkles className="w-3 h-3" /> : <Crown className="w-3 h-3" />}
                {isEveryone ? 'Herkes Kazanır' : isRaffle ? 'Çekiliş' : 'İlk Gelen'}
              </span>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div
              className="p-3.5 rounded-xl text-center"
              style={{
                background: `linear-gradient(145deg, ${theme.colors.backgroundSecondary}, ${theme.colors.card})`,
                border: `1px solid ${theme.colors.border}60`
              }}
            >
              <div className="flex items-center justify-center gap-1.5 mb-1.5">
                <Trophy className="w-4 h-4" style={{ color: theme.colors.primary }} />
                <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: theme.colors.text }}>Kazanacak</span>
              </div>
              <div className="text-lg sm:text-2xl font-black" style={{ color: theme.colors.text }}>
                {isEveryone ? 'Herkes' : event.participantLimit}
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
                <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: theme.colors.text }}>Katılımcı</span>
              </div>
              <div className="text-lg sm:text-2xl font-black" style={{ color: theme.colors.text }}>
                {event.participantCount}
              </div>
            </div>
          </div>

          {/* Progress Bar (limited) ya da eşdeğer yükseklikte bilgi satırı (raffle/everyone) -
              tüm kart tiplerinde AYNI yükseklik korunsun diye, hiç gizlenmiyor */}
          {!isCompleted && (
            isRaffle || isEveryone ? (
              <div
                className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold"
                style={{ background: `${theme.colors.textMuted}10`, color: theme.colors.textMuted }}
              >
                <Users className="w-3.5 h-3.5" />
                Sınırsız Katılım
              </div>
            ) : (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium" style={{ color: theme.colors.text }}>Doluluk</span>
                <span className="font-bold" style={{ color: theme.colors.text }}>{Math.round(progress)}%</span>
              </div>
              <div
                className="h-2.5 rounded-full overflow-hidden"
                style={{ background: `${theme.colors.border}40` }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${progress}%`,
                    background: `linear-gradient(90deg, ${theme.colors.gradientFrom}, ${theme.colors.gradientTo})`
                  }}
                />
              </div>
            </div>
            )
          )}

          {/* Time Remaining */}
          {!isCompleted && (
            <div
              className="flex items-center justify-between py-2.5 px-3.5 rounded-xl"
              style={{
                background: `${theme.colors.backgroundSecondary}60`,
                border: `1px solid ${theme.colors.border}40`
              }}
            >
              <span className="text-xs font-medium" style={{ color: theme.colors.text }}>Kalan Sure</span>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" style={{ color: theme.colors.primary }} />
                <span className="text-sm font-bold" style={{ color: theme.colors.text }}>{getTimeRemaining()}</span>
              </div>
            </div>
          )}

          {/* Action Buttons - her zaman kartın en altında (mt-auto) */}
          <div className="mt-auto pt-1">
          {isCompleted ? (
            <ThemedButton
              onClick={handleDetailClick}
              variant="secondary"
              size="lg"
              className="w-full"
            >
              <Eye className="w-4 h-4 mr-2" />
              Detaylari Gor
            </ThemedButton>
          ) : (
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
              {participated ? (
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
                  disabled={!canJoin || isJoining}
                  variant="primary"
                  size="sm"
                  className="text-xs sm:text-sm px-2 sm:px-4"
                >
                  {isJoining ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isFull ? (
                    'Doldu'
                  ) : isExpired ? (
                    'Bitti'
                  ) : (
                    'Katıl'
                  )}
                </ThemedButton>
              )}
            </div>
          )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {loading ? (
        <LoadingSpinner />
      ) : (
      <div className="user-page-container">
        <div className="user-page-inner space-y-4">

        <PageHeader icon={Calendar} title="Etkinlikler" subtitle="Aktif ve geçmiş etkinliklere göz at" />

        <Tabs defaultValue="active" className="w-full">
            <div
              className="flex gap-1.5 p-1.5 rounded-xl"
              style={{
                background: `linear-gradient(135deg, ${theme.colors.backgroundSecondary}90, ${theme.colors.card}90)`,
                border: `1px solid ${theme.colors.border}`,
                backdropFilter: 'blur(8px)'
              }}
            >
              <TabsTrigger
                value="active"
                className="flex-1 transition-all rounded-lg px-4 py-2.5 text-sm font-semibold data-[state=active]:shadow-lg data-[state=inactive]:opacity-70"
                style={{
                  color: theme.colors.text,
                }}
              >
                <Gift className="w-4 h-4 mr-2" />
                Aktif
              </TabsTrigger>
              <TabsTrigger
                value="past"
                className="flex-1 transition-all rounded-lg px-4 py-2.5 text-sm font-semibold data-[state=active]:shadow-lg data-[state=inactive]:opacity-70"
                style={{
                  color: theme.colors.text,
                }}
              >
                <Calendar className="w-4 h-4 mr-2" />
                Geçmiş
              </TabsTrigger>
            </div>

            <TabsContent value="active" className="space-y-3 mt-4">
              {activeEvents.length === 0 ? (
                <ThemedEmptyState
                  icon={<Gift className="w-12 h-12" />}
                  title="Aktif etkinlik yok"
                  description="Yakinda yeni etkinlikler eklenecek!"
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
                  {activeEvents.map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="past" className="space-y-3 mt-4">
              {pastEvents.length === 0 ? (
                <ThemedEmptyState
                  icon={<Calendar className="w-12 h-12" />}
                  title="Geçmiş etkinlik yok"
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
                  {pastEvents.map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
      )}

      {/* Sponsor Info Dialog - Popup */}
      <AlertDialog open={showSponsorForm} onOpenChange={(open) => {
        if (!open) {
          setShowSponsorForm(false)
          setSponsorInfo('')
          setSelectedEvent(null)
        }
      }}>
        <AlertDialogContent
          className="rounded-2xl border-2"
          style={{
            background: `linear-gradient(145deg, ${theme.colors.card}, ${theme.colors.background})`,
            borderColor: `${theme.colors.gradientFrom}30`
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold" style={{ color: theme.colors.text }}>
              Sponsor Bilgisi Gerekli
            </AlertDialogTitle>
            <AlertDialogDescription style={{ color: theme.colors.textSecondary }}>
              <span className="space-y-4 block">
                <span className="flex items-center gap-4">
                  {selectedEvent?.sponsor.logoUrl && (
                    <span
                      className="w-32 h-16 rounded-xl overflow-hidden relative inline-block ring-2"
                      style={{
                        background: `linear-gradient(135deg, ${theme.colors.gradientFrom}20, ${theme.colors.gradientTo}20)`,
                        '--tw-ring-color': `${theme.colors.gradientFrom}40`
                      } as React.CSSProperties}
                    >
                      <Image
                        src={optimizeCloudinaryImage(selectedEvent.sponsor.logoUrl, 128, 64)}
                        unoptimized
                        alt={selectedEvent.sponsor.name}
                        fill
                        className="object-contain p-2"
                      />
                    </span>
                  )}
                  <span className="block">
                    <span className="font-bold text-lg block" style={{ color: theme.colors.text }}>{selectedEvent?.sponsor.name}</span>
                    <span className="text-sm block" style={{ color: theme.colors.textMuted }}>{selectedEvent?.title}</span>
                  </span>
                </span>

                <span className="space-y-3 py-2 block">
                  <span className="text-sm block" style={{ color: theme.colors.textSecondary }}>
                    Bu etkinlige katilabilmek icin sponsor bilginizi eklemeniz gerekmektedir.
                  </span>
                  <span className="space-y-2 block">
                    <Label className="text-sm font-semibold" style={{ color: theme.colors.text }}>
                      {selectedEvent?.sponsor.identifierType === 'username' ? 'Kullanıcı Adı' :
                       selectedEvent?.sponsor.identifierType === 'phone' ? 'Telefon Numarasi' :
                       selectedEvent?.sponsor.identifierType === 'email' ? 'E-posta' : 'ID'}
                    </Label>
                    <Input
                      value={sponsorInfo}
                      onChange={(e) => setSponsorInfo(e.target.value)}
                      placeholder={
                        selectedEvent?.sponsor.identifierType === 'username' ? 'Kullanıcı adinizi girin' :
                        selectedEvent?.sponsor.identifierType === 'phone' ? 'Telefon numaranizi girin' :
                        selectedEvent?.sponsor.identifierType === 'email' ? 'E-posta adresinizi girin' : 'ID girin'
                      }
                      className="rounded-xl border-2"
                      style={{
                        background: theme.colors.backgroundSecondary,
                        borderColor: theme.colors.border,
                        color: theme.colors.text
                      }}
                      disabled={savingSponsor}
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
              disabled={savingSponsor}
            >
              İptal
            </ThemedButton>
            <ThemedButton
              onClick={saveSponsorInfo}
              disabled={savingSponsor || !sponsorInfo.trim()}
              variant="primary"
              size="md"
            >
              {savingSponsor ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Kaydediliyor...
                </>
              ) : (
                'Kaydet ve Katil'
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
          // Doğrulama tamamlandıktan sonra seçili etkinlik varsa katılım işlemini başlat
          if (selectedEvent) {
            handleJoinEventAfterVerification(selectedEvent)
          }
        }}
        actionName={actionName}
      />
    </>
  )
}
