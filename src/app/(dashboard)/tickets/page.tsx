'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { TicketCard } from '@/components/tickets/TicketCard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Ticket, Clock, CheckCircle, XCircle, Gift, Calendar } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import { toast } from 'sonner'
import { useAuth } from '@/components/providers/auth-provider'
import { useUserTheme } from '@/components/providers/user-theme-provider'
import { useVerification } from '@/lib/hooks/useVerification'
import VerificationRequiredModal from '@/components/VerificationRequiredModal'
import {
  ThemedEmptyState,
} from '@/components/ui/themed'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ThemedButton } from '@/components/ui/themed'
import { Loader2 } from 'lucide-react'
import Image from 'next/image'
import { optimizeCloudinaryImage } from '@/lib/utils'

interface TicketEvent {
  id: string
  title: string
  description: string
  status?: string
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
  }>
  _count?: {
    ticketNumbers: number
    requests: number
  }
  uniqueParticipants?: number
  userJoined?: boolean
}

interface TicketRequest {
  id: string
  status: 'pending' | 'approved' | 'rejected'
  investmentAmount: number
  ticketCount: number
  note?: string
  createdAt: string
  event: TicketEvent
  ticketNumbers: Array<{ ticketNumber: number }>
}

export default function TicketsPage() {
  const router = useRouter()
  const { user, setShowLoginModal, refreshUser } = useAuth()
  const { theme, button } = useUserTheme()
  const {
    isFullyVerified,
    showVerificationModal,
    actionName,
    closeVerificationModal,
    requireVerification
  } = useVerification()
  const [activeFilter, setActiveFilter] = useState('active')

  // Join modal states
  const [selectedEvent, setSelectedEvent] = useState<TicketEvent | null>(null)
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

  // ✅ FIX: Artık React Query kullanıyor - aynı oturumda bu sayfaya tekrar
  // gelince (üç istek de) önbellekten anında geliyor, yeniden çekilmiyor.
  const { data: ticketsQueryData, isLoading: loading, refetch: refetchTickets } = useQuery({
    queryKey: ['tickets-all'],
    queryFn: async () => {
      const [activeRes, pendingRes, historyRes] = await Promise.all([
        fetch('/api/tickets'),
        fetch('/api/tickets?status=waiting_draw'),
        fetch('/api/tickets/history'),
      ])
      const [activeData, pendingData, historyData] = await Promise.all([
        activeRes.json(),
        pendingRes.json(),
        historyRes.json(),
      ])
      return {
        active: activeData.events || [],
        pending: pendingData.events || [],
        history: historyData.events || [],
      }
    },
    staleTime: 30 * 1000,
  })
  const activeEventsData: TicketEvent[] = ticketsQueryData?.active || []
  const pendingEventsData: TicketEvent[] = ticketsQueryData?.pending || []
  const historyEventsData: TicketEvent[] = ticketsQueryData?.history || []

  // ✅ FIX: Etkinlikler sayfasındaki gibi, üç veri seti de BİR KERE ve
  // paralel çekiliyor. Eskiden her sekme değişiminde (activeFilter değişince)
  // yeniden fetch tetikleniyordu - bu da "loading" durumuna geçip TÜM
  // sayfanın (sekme çubuğu dahil) yanıp sönmesine sebep oluyordu. Artık
  // sekmeler arası geçiş sadece hafızadaki veriyi gösteriyor, anında oluyor.
  const events =
    activeFilter === 'pending' ? pendingEventsData :
    activeFilter === 'history' ? historyEventsData :
    activeEventsData

  async function handleJoinClick(event: TicketEvent) {
    if (!user) {
      toast.error('Bilet almak icin giris yapmalisiniz')
      setShowLoginModal(true)
      return
    }

    // Telegram ve email doğrulaması kontrolü
    if (!requireVerification(() => {
      handleJoinClickAfterVerification(event)
    }, 'bilet talep etmek')) {
      setSelectedEvent(event)
      return
    }

    await handleJoinClickAfterVerification(event)
  }

  async function handleJoinClickAfterVerification(event: TicketEvent) {
    setSelectedEvent(event)

    try {
      const res = await fetch('/api/user/sponsor-info')
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
      await joinTicket(event)
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  async function joinTicket(event: TicketEvent) {
    try {
      setJoining(true)
      const res = await fetch('/api/tickets/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: event.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Bilete katılınamadı')
        return
      }
      toast.success('🎟️ Bilete katıldınız!')
      refetchTickets()
    } catch (error) {
      console.error('Error joining ticket:', error)
      toast.error('Bilete katılırken hata oluştu')
    } finally {
      setJoining(false)
    }
  }

  async function saveSponsorInfoAndContinue() {
    if (!sponsorInfo.trim()) {
      toast.error('Bilgi gerekli')
      return
    }

    try {
      setSavingSponsorInfo(true)
      const res = await fetch('/api/user/sponsor-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sponsorId: selectedEvent?.sponsor.id,
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

  const filters = [
    { value: 'active', label: 'Aktif' },
    { value: 'pending', label: 'Bekleyen' },
    { value: 'history', label: 'Geçmiş' }
  ]

  return (
    <>
      {loading ? (
        <LoadingSpinner />
      ) : (
      <div className="user-page-container">
        <div className="user-page-inner space-y-4">

        <PageHeader icon={Ticket} title="Biletler" subtitle="Bilet çekilişlerine katıl, numaranı takip et" />

        <Tabs value={activeFilter} onValueChange={setActiveFilter} className="w-full">
          {/* Tabs styled like events page */}
          <div
            className="flex gap-1.5 p-1.5 rounded-xl"
            style={{
              background: `linear-gradient(135deg, ${theme.colors.backgroundSecondary}90, ${theme.colors.card}90)`,
              border: `1px solid ${theme.colors.border}`,
              backdropFilter: 'blur(8px)'
            }}
          >
            {filters.map((filter) => (
              <TabsTrigger
                key={filter.value}
                value={filter.value}
                className="flex-1 transition-all rounded-lg px-4 py-2.5 text-sm font-semibold data-[state=active]:shadow-lg data-[state=inactive]:opacity-70"
                style={{
                  color: theme.colors.text,
                }}
              >
                {filter.value === 'active' && <Gift className="w-4 h-4 mr-2" />}
                {filter.value === 'pending' && <Clock className="w-4 h-4 mr-2" />}
                {filter.value === 'history' && <Calendar className="w-4 h-4 mr-2" />}
                {filter.label}
              </TabsTrigger>
            ))}
          </div>

          <TabsContent value={activeFilter} className="space-y-3 mt-4">
            {events.length === 0 ? (
              <ThemedEmptyState
                icon={<Ticket className="w-12 h-12" />}
                title={
                  activeFilter === 'active' ? 'Aktif bilet etkinliği yok' :
                  activeFilter === 'pending' ? 'Çekilişi bekleyen etkinlik yok' :
                  'Geçmiş etkinlik yok'
                }
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
                {events.map(event => (
                  <TicketCard
                    key={event.id}
                    event={event}
                    type="user"
                    formatAmount={formatAmount}
                    formatDateTR={formatDateTR}
                    onJoinClick={handleJoinClick}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
        </div>
      </div>
      )}

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
            <AlertDialogDescription asChild>
              <div className="space-y-4" style={{ color: theme.colors.textSecondary }}>
                <div className="flex items-center gap-4">
                  {selectedEvent?.sponsor.logoUrl && (
                    <div
                      className="w-14 h-14 rounded-full overflow-hidden relative"
                      style={{
                        background: `linear-gradient(145deg, ${theme.colors.backgroundSecondary}, ${theme.colors.background})`,
                        border: `1px solid ${theme.colors.border}`
                      }}
                    >
                      <Image
                        src={optimizeCloudinaryImage(selectedEvent.sponsor.logoUrl, 112, 112)}
                        unoptimized
                        alt={selectedEvent.sponsor.name}
                        fill
                        sizes="56px"
                        className="object-contain p-2"
                      />
                    </div>
                  )}
                  <div>
                    <p className="font-bold" style={{ color: theme.colors.text }}>{selectedEvent?.sponsor.name}</p>
                    <p className="text-sm" style={{ color: theme.colors.textMuted }}>{selectedEvent?.title}</p>
                  </div>
                </div>

                <div className="space-y-3 py-2">
                  <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                    Bu etkinlige katilabilmek icin sponsor bilginizi eklemeniz gerekmektedir.
                  </p>
                  <div className="space-y-2">
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
                      className="rounded-xl"
                      style={{
                        background: theme.colors.backgroundSecondary,
                        borderColor: theme.colors.border,
                        color: theme.colors.text
                      }}
                      disabled={savingSponsorInfo}
                    />
                  </div>
                </div>
              </div>
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
              onClick={saveSponsorInfoAndContinue}
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
          // Doğrulama tamamlandıktan sonra seçili etkinlik varsa işlemi devam ettir
          if (selectedEvent) {
            handleJoinClickAfterVerification(selectedEvent)
          }
        }}
        actionName={actionName}
      />
    </>
  )
}
