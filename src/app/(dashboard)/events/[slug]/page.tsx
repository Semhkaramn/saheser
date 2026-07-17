'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Users, Award, ArrowLeft, Calendar, Gift, Trophy, Loader2, CheckCircle, Sparkles, Crown, Clock
} from 'lucide-react'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import HighlightedText from '@/components/HighlightedText'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ThemedButton } from '@/components/ui/themed'
import { toast } from 'sonner'
import { useAuth } from '@/components/providers/auth-provider'
import { useUserTheme } from '@/components/providers/user-theme-provider'
import { useVerification } from '@/lib/hooks/useVerification'
import VerificationRequiredModal from '@/components/VerificationRequiredModal'
import Image from 'next/image'
import { optimizeCloudinaryImage } from '@/lib/utils'

interface Event {
  id: string
  title: string
  description: string
  imageUrl?: string
  status: string
  sponsor: {
    id: string
    name: string
    logoUrl?: string
    identifierType: string
  }
  participantLimit: number
  participationType: string
  participantCount: number
  endDate: string | null
  participants?: Array<{ userId: string; createdAt: string }>
  winners?: Array<{
    user: {
      id: string
      siteUsername?: string
      email?: string
      telegramUsername?: string
      firstName?: string
    }
    statusMessage?: string
  }>
}

export default function EventDetailPage() {
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
  const [joining, setJoining] = useState(false)
  const [event, setEvent] = useState<Event | null>(null)
  const [sponsorInfo, setSponsorInfo] = useState('')
  const [showSponsorForm, setShowSponsorForm] = useState(false)

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('tr-TR', {
      timeZone: 'Europe/Istanbul',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  useEffect(() => {
    if (params.slug) {
      loadEvent()
    }
  }, [params.slug])

  async function loadEvent() {
    try {
      setLoading(true)
      const eventId = Array.isArray(params.slug) ? params.slug[0] : params.slug
      const res = await fetch(`/api/events?eventId=${eventId}`, { credentials: 'include' })
      const data = await res.json()
      if (data.events && data.events.length > 0) {
        setEvent(data.events[0])
      } else {
        toast.error('Etkinlik bulunamadi')
        router.push('/events')
      }
    } catch (error) {
      toast.error('Hata oluştu')
      router.push('/events')
    } finally {
      setLoading(false)
    }
  }

  async function handleJoin() {
    if (!user) {
      setShowLoginModal(true)
      return
    }

    if (!event) return

    // Telegram ve email doğrulaması kontrolü
    if (!requireVerification(async () => {
      // Doğrulama tamamlandıktan sonra katılım işlemini tekrar başlat
      await checkSponsorAndJoin()
    }, 'etkinliğe katılmak')) {
      return
    }

    await checkSponsorAndJoin()
  }

  async function checkSponsorAndJoin() {
    if (!event) return

    // Önce sponsor bilgisini kontrol et
    try {
      const res = await fetch('/api/user/sponsor-info', { credentials: 'include' })
      const data = await res.json()
      const sponsorInfoData = data.sponsorInfos?.find((info: any) => info.sponsorId === event.sponsor.id)

      if (!sponsorInfoData) {
        setShowSponsorForm(true)
        toast.info(`Lütfen ${event.sponsor.name} bilginizi girin`)
        return
      }

      // Sponsor bilgisi varsa direkt katıl
      await joinEvent()
    } catch (error) {
      console.error('Error checking sponsor info:', error)
      toast.error('Sponsor bilgisi kontrolu başarısız')
    }
  }

  async function joinEvent() {
    try {
      setJoining(true)
      const eventId = Array.isArray(params.slug) ? params.slug[0] : params.slug
      const res = await fetch(`/api/events/${eventId}/join`, { method: 'POST', credentials: 'include' })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error)
      }

      toast.success(data.message || 'Katildiniz!')
      setShowSponsorForm(false)
      loadEvent()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setJoining(false)
    }
  }

  async function saveSponsorInfo() {
    if (!sponsorInfo.trim()) return toast.error('Bilgi gerekli')

    try {
      setJoining(true)
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

      toast.success('Kaydedildi!')
      setSponsorInfo('')

      // Kaydettikten sonra otomatik katıl
      await joinEvent()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setJoining(false)
    }
  }

  if (loading) {
    return (
      <LoadingSpinner fullscreen={false} className="min-h-[60vh]" />
    )
  }

  if (!event) return null

  const userParticipated = Boolean(user && event.participants?.some(p => p.userId === user.id))
  const userWon = Boolean(user && event.winners?.some(w => w.user.id === user.id))
  const isRaffle = event.participationType === 'raffle'
  const isEveryone = event.participationType === 'everyone'
  // Çekiliş tipinde limit kontrolü yok - participantLimit sadece kazanan sayısını belirtir
  // Sadece "limited" (ilk gelen alır) tipinde doluluk kontrolü yapılır
  const isFull = !isRaffle && event.participantCount >= event.participantLimit
  const isExpired = event.endDate ? new Date(event.endDate) < new Date() : false
  const isPastEvent = event.status === 'completed' || event.status === 'pending'
  const canJoin = event.status === 'active' && !isFull && !isExpired && !userParticipated
  const progress = (event.participantCount / event.participantLimit) * 100

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

  return (
    <>
      <div className="user-page-container">
        <div className="user-page-inner space-y-4 max-w-3xl mx-auto">
          {/* Back Button */}
          <ThemedButton
            onClick={() => router.push('/events')}
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

            <div className="p-6 space-y-5">
              {/* Header: Logo + Title */}
              <div className="flex items-start gap-4">
                {(event.imageUrl || event.sponsor?.logoUrl) && (
                  <div
                    className="flex-shrink-0 w-24 h-14 relative rounded-2xl overflow-hidden"
                    style={{
                      background: event.imageUrl ? undefined : `linear-gradient(145deg, ${theme.colors.backgroundSecondary}, ${theme.colors.background})`,
                    }}
                  >
                    <Image
                      src={optimizeCloudinaryImage((event.imageUrl || event.sponsor!.logoUrl) as string, 200, 120)}
                      unoptimized
                      alt={event.title}
                      fill
                      sizes="80px"
                      className={event.imageUrl ? 'object-cover' : 'object-contain p-2.5'}
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h1 className="font-display text-xl font-bold mb-2" style={{ color: theme.colors.text }}>
                    {event.title}
                  </h1>
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                    style={{
                      background: isRaffle
                        ? `linear-gradient(135deg, ${theme.colors.accent}15, ${theme.colors.primary}10)`
                        : `linear-gradient(135deg, ${theme.colors.success}15, ${theme.colors.success}08)`,
                      color: isRaffle ? theme.colors.accent : theme.colors.success,
                      border: `1px solid ${isRaffle ? theme.colors.accent : theme.colors.success}25`
                    }}
                  >
                    {isRaffle ? <Sparkles className="w-3.5 h-3.5" /> : <Crown className="w-3.5 h-3.5" />}
                    {isRaffle ? 'Çekiliş' : 'İlk Gelen Alır'}
                  </span>
                </div>
              </div>

              {/* Kazandınız Durumu */}
              {userWon && (
                <div
                  className="neon-frame p-4 rounded-xl flex items-center gap-3"
                  style={{
                    background: `linear-gradient(135deg, ${theme.colors.primary}18, ${theme.colors.warning}10)`,
                    border: `1px solid ${theme.colors.primary}30`
                  }}
                >
                  <Trophy className="w-6 h-6 flex-shrink-0" style={{ color: theme.colors.warning }} />
                  <p className="font-bold" style={{ color: theme.colors.primary }}>🎉 Tebrikler! Kazandınız!</p>
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
                    <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: theme.colors.text }}>Kazanacak</span>
                  </div>
                  <div className="text-2xl font-black" style={{ color: theme.colors.text }}>
                    {isEveryone ? 'Herkes' : event.participantLimit}
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
                    {event.participantCount}
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
                    <Calendar className="w-4 h-4" style={{ color: theme.colors.textMuted }} />
                    <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: theme.colors.text }}>Bitiş</span>
                  </div>
                  <div className="text-sm font-bold" style={{ color: theme.colors.text }}>{event.endDate ? formatDate(event.endDate) : 'Süresiz'}</div>
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
                  <span className="text-sm font-medium" style={{ color: theme.colors.text }}>Kalan Süre</span>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" style={{ color: theme.colors.primary }} />
                    <span className="text-base font-bold" style={{ color: theme.colors.primary }}>{getTimeRemaining()}</span>
                  </div>
                </div>
              )}

              {/* Progress (sadece limited için - raffle ve everyone'da katılımcı sayısı sınırsız, doluluk anlamsız) */}
              {!isRaffle && !isEveryone && !isPastEvent && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium" style={{ color: theme.colors.text }}>Doluluk Orani</span>
                    <span className="font-bold" style={{ color: theme.colors.text }}>{Math.round(progress)}%</span>
                  </div>
                  <div
                    className="w-full h-3 rounded-full overflow-hidden"
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

              {/* Katıl Butonu */}
              {!isPastEvent && (
                userParticipated ? (
                  <ThemedButton
                    disabled
                    variant="primary"
                    size="lg"
                    className="w-full py-4"
                    style={{
                      background: `linear-gradient(135deg, ${theme.colors.success}, ${theme.colors.success}cc)`,
                      boxShadow: `0 4px 20px ${theme.colors.success}30`
                    }}
                  >
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Katildiniz
                  </ThemedButton>
                ) : (
                  <ThemedButton
                    onClick={handleJoin}
                    disabled={!canJoin || joining}
                    variant={canJoin ? "primary" : "secondary"}
                    size="lg"
                    className="w-full py-4"
                  >
                    {joining && <Loader2 className="w-5 h-5 mr-2 animate-spin" />}
                    {!user ? (
                      'Giris Yapin'
                    ) : isExpired ? (
                      'Süresi Doldu'
                    ) : isFull ? (
                      'Doldu'
                    ) : event.status !== 'active' ? (
                      'Kapali'
                    ) : (
                      'Katil'
                    )}
                  </ThemedButton>
                )
              )}

              {/* Kazananlar - Kart içinde */}
              {isPastEvent && event.winners && event.winners.length > 0 && (
                <div
                  className="pt-4"
                  style={{ borderTop: `1px solid ${theme.colors.border}40` }}
                >
                  <h4 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: theme.colors.text }}>
                    <Trophy className="w-4 h-4" style={{ color: theme.colors.primary }} />
                    Kazananlar ({event.winners.length})
                  </h4>
                  <div className="space-y-2">
                    {(() => {
                      const sortedWinners = [...event.winners].sort((a, b) => {
                        if (user) {
                          if (a.user.id === user.id) return -1
                          if (b.user.id === user.id) return 1
                        }
                        return 0
                      })

                      return sortedWinners.map((w, idx) => {
                        const isCurrentUser = w.user.id === user?.id
                        const displayName = w.user.siteUsername

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
                              <p className="font-semibold text-sm" style={{ color: theme.colors.text }}>
                                {displayName}
                              </p>
                            </div>
                            {isCurrentUser && (
                              <span
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                                style={{
                                  background: `${theme.colors.primary}20`,
                                  color: theme.colors.primary
                                }}
                              >
                                {event.status === 'pending' ? 'Kontrol ediliyor' : (w.statusMessage || 'Odulunuz eklendi')}
                              </span>
                            )}
                          </div>
                        )
                      })
                    })()}
                  </div>
                </div>
              )}

              {isPastEvent && (!event.winners || event.winners.length === 0) && (
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
                    <Trophy className="w-8 h-8" style={{ color: `${theme.colors.primary}60` }} />
                  </div>
                  <p className="text-sm font-medium" style={{ color: theme.colors.text }}>
                    {event.status === 'pending' ? 'Kazananlar belirleniyor...' : 'Henüz kazanan belirlenmedi'}
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
                      className="w-28 h-14 rounded-xl overflow-hidden relative inline-block"
                      style={{
                        background: `linear-gradient(145deg, ${theme.colors.backgroundSecondary}, ${theme.colors.background})`,
                        border: `1px solid ${theme.colors.border}`
                      }}
                    >
                      <Image
                        src={event.sponsor.logoUrl}
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
                      disabled={joining}
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
              disabled={joining}
            >
              İptal
            </ThemedButton>
            <ThemedButton
              onClick={saveSponsorInfo}
              disabled={joining || !sponsorInfo.trim()}
              variant="primary"
              size="md"
            >
              {joining ? (
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
          // Doğrulama tamamlandıktan sonra katılım işlemini tekrar başlat
          checkSponsorAndJoin()
        }}
        actionName={actionName}
      />
    </>
  )
}
