'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { WinnerSelector } from '@/components/tickets/admin/WinnerSelector'
import {
  TicketCheck,
  Calendar,
  Users,
  Award,
  Trophy,
  ArrowLeft,
  Clock,
  Loader2,
  Search,
  Banknote,
  Hash,
  Trash2,
  Copy,
  Check,
  Sparkles
} from 'lucide-react'
import { toast } from 'sonner'
import Image from 'next/image'

// Tema renkleri
const theme = {
  primary: '#10b981',
  primaryLight: '#34d399',
  primaryDark: '#059669',
  gradientFrom: '#10b981',
  gradientTo: '#059669',
  warning: '#f59e0b',
  danger: '#ef4444',
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
  winners?: Array<{
    ticketNumber: {
      ticketNumber: number
      user?: {
        siteUsername?: string
        email?: string
      }
    }
  }>
}

interface TicketRequestRow {
  id: string
  userId: string
  investmentAmount: number
  sponsorInfo: string
  user?: {
    siteUsername?: string
    email?: string
  }
  ticketNumbers?: Array<{ ticketNumber: number }>
}

interface TicketEvent {
  id: string
  title: string
  description: string
  status: string
  sponsor: {
    id: string
    name: string
    logoUrl?: string
    description?: string
  }
  totalTickets: number | null
  ticketPrice: number
  soldTickets: number
  endDate: string | null
  prizes: Prize[]
  requests?: TicketRequestRow[]
  _count?: {
    ticketNumbers: number
    requests: number
  }
  uniqueParticipants?: number
}

interface TicketNumber {
  id: string
  ticketNumber: number
  userId: string
  username: string
  sponsorInfo: string
}

export default function AdminTicketDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [event, setEvent] = useState<TicketEvent | null>(null)
  const [ticketNumbers, setTicketNumbers] = useState<TicketNumber[]>([])
  const [searchTerm, setSearchTerm] = useState('')

  // Çekiliş işlemleri için state
  const [selectedWinners, setSelectedWinners] = useState<{ [prizeId: string]: number[] }>({})
  const [selectedPrizeForSelection, setSelectedPrizeForSelection] = useState<(Prize & { eventId: string }) | null>(null)
  const [showPrizeSelectionModal, setShowPrizeSelectionModal] = useState(false)

  // Dialog states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false)
  const [showDistributeConfirm, setShowDistributeConfirm] = useState(false)

  const formatDateTR = (date: string | Date) => {
    const d = new Date(date)
    return d.toLocaleString('tr-TR', {
      timeZone: 'Europe/Istanbul',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatAmount = (amount: number) => {
    return amount.toLocaleString('tr-TR')
  }

  const getTimeRemaining = (endDate: string | null) => {
    if (!endDate) return 'Süresiz'
    const now = new Date().getTime()
    const end = new Date(endDate).getTime()
    const diff = end - now

    if (diff <= 0) return 'Sona erdi'

    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    if (days > 0) return `${days} gün ${hours} saat`
    if (hours > 0) return `${hours} saat ${minutes} dk`
    return `${minutes} dakika`
  }

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (!token) {
      router.push('/admin')
      return
    }
    loadEvent()
  }, [params.id])

  async function loadEvent() {
    try {
      setLoading(true)
      const token = localStorage.getItem('admin_token')
      const res = await fetch(`/api/admin/tickets/${params.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (res.ok) {
        const data = await res.json()
        setEvent(data.event)
        setTicketNumbers(data.ticketNumbers || [])

        // Eğer çekiliş bekliyor durumundaysa, mevcut seçimleri sıfırla
        if (data.event.status === 'waiting_draw') {
          const initialWinners: { [prizeId: string]: number[] } = {}
          data.event.prizes.forEach((prize: Prize) => {
            initialWinners[prize.id || ''] = []
          })
          setSelectedWinners(initialWinners)
        }
      } else {
        toast.error('Etkinlik bulunamadı')
        router.push('/admin/tickets')
      }
    } catch (error) {
      console.error('Error loading event:', error)
      toast.error('Yükleme hatası')
    } finally {
      setLoading(false)
    }
  }

  async function setReviewing() {
    if (!event) return
    try {
      setProcessing(true)
      const token = localStorage.getItem('admin_token')
      const res = await fetch(`/api/admin/tickets/${event.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'reviewing' }),
      })
      if (res.ok) {
        toast.success('Etkinlik beklemeye alındı, artık yeni katılım kabul edilmiyor')
        loadEvent()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Durum değiştirilemedi')
      }
    } catch (error) {
      console.error('Error setting reviewing:', error)
      toast.error('Durum değiştirilemedi')
    } finally {
      setProcessing(false)
    }
  }

  async function updateInvestment(requestId: string, amount: number) {
    try {
      const token = localStorage.getItem('admin_token')
      const res = await fetch(`/api/admin/tickets/requests/${requestId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ investmentAmount: amount }),
      })
      const data = await res.json()
      if (res.ok) {
        if (data.previousTicketNumbersCancelled?.length > 0) {
          toast.success(
            `Yatırım tutarı güncellendi. Eski bilet numaraları (${data.previousTicketNumbersCancelled.join(', ')}) iptal edildi - "Bilet Numaralarını Oluştur"a tekrar basarak yeni numara ver.`,
            { duration: 6000 }
          )
        } else {
          toast.success('Yatırım tutarı güncellendi')
        }
        loadEvent()
      } else {
        toast.error(data.error || 'Güncellenemedi')
      }
    } catch (error) {
      console.error('Error updating investment:', error)
      toast.error('Güncellenemedi')
    }
  }

  async function removeParticipant(requestId: string) {
    if (!confirm('Bu katılımcıyı etkinlikten çıkarmak istediğine emin misin? Varsa bilet numaraları da iptal edilecek.')) return
    try {
      const token = localStorage.getItem('admin_token')
      const res = await fetch(`/api/admin/tickets/requests/${requestId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      })
      if (res.ok) {
        toast.success('Katılımcı çıkarıldı')
        loadEvent()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Çıkarılamadı')
      }
    } catch (error) {
      console.error('Error removing participant:', error)
      toast.error('Çıkarılamadı')
    }
  }

  async function generateNumbers() {
    if (!event) return
    try {
      setProcessing(true)
      const token = localStorage.getItem('admin_token')
      const res = await fetch(`/api/admin/tickets/${event.id}/generate-numbers`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`${data.generatedCount} bilet numarası oluşturuldu!`)
        loadEvent()
      } else {
        toast.error(data.error || 'Bilet numaraları oluşturulamadı')
      }
    } catch (error) {
      console.error('Error generating numbers:', error)
      toast.error('Bilet numaraları oluşturulamadı')
    } finally {
      setProcessing(false)
    }
  }

  async function deleteEvent() {
    try {
      setProcessing(true)
      const token = localStorage.getItem('admin_token')
      const res = await fetch(`/api/admin/tickets/${params.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      })

      if (res.ok) {
        toast.success('Etkinlik silindi')
        router.push('/admin/tickets')
      } else {
        toast.error('Silinemedi')
      }
    } catch (error) {
      console.error('Error deleting event:', error)
      toast.error('Silme başarısız')
    } finally {
      setProcessing(false)
      setShowDeleteConfirm(false)
    }
  }

  async function prepareDrawEvent() {
    if (!event) return
    try {
      setProcessing(true)
      const token = localStorage.getItem('admin_token')
      const res = await fetch(`/api/admin/tickets/${event.id}/complete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'prepare_draw' }),
      })

      if (res.ok) {
        toast.success('Çekiliş hazır!')
        loadEvent()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Hazırlanamadı')
      }
    } catch (error) {
      console.error('Error preparing draw:', error)
      toast.error('Hazırlama başarısız')
    } finally {
      setProcessing(false)
      setShowCompleteConfirm(false)
    }
  }

  async function distributeRewards() {
    if (!event) return

    for (const prize of event.prizes) {
      const prizeId = prize.id || ''
      if (!selectedWinners[prizeId] || selectedWinners[prizeId].length !== prize.winnerCount) {
        toast.error(`${formatAmount(prize.prizeAmount)} TL için ${prize.winnerCount} kazanan seçin!`)
        return
      }
    }

    try {
      setProcessing(true)
      const token = localStorage.getItem('admin_token')
      const winners = Object.entries(selectedWinners)
        .filter(([_, ticketNums]) => ticketNums.length > 0)
        .map(([prizeId, ticketNums]) => ({ prizeId, ticketNumbers: ticketNums }))

      const res = await fetch(`/api/admin/tickets/${event.id}/complete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'complete_draw',
          winners,
        }),
      })

      if (res.ok) {
        toast.success('Ödüller dağıtıldı!')
        setSelectedWinners({})
        loadEvent()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Dağıtılamadı')
      }
    } catch (error) {
      console.error('Error distributing rewards:', error)
      toast.error('Dağıtım başarısız')
    } finally {
      setProcessing(false)
      setShowDistributeConfirm(false)
    }
  }

  function openPrizeSelectionModal(prize: Prize) {
    if (!event) return
    setSelectedPrizeForSelection({ ...prize, eventId: event.id })

    if (!selectedWinners[prize.id || '']) {
      setSelectedWinners(prev => ({ ...prev, [prize.id || '']: [] }))
    }

    setShowPrizeSelectionModal(true)
  }

  function toggleWinnerSelection(prizeId: string, ticketNumber: number) {
    const prize = selectedPrizeForSelection
    if (!prize) return

    setSelectedWinners(prev => {
      const current = prev[prizeId] || []
      const index = current.indexOf(ticketNumber)

      if (index >= 0) {
        return { ...prev, [prizeId]: current.filter(tn => tn !== ticketNumber) }
      } else {
        if (current.length >= prize.winnerCount) {
          toast.error(`Max ${prize.winnerCount} kazanan`)
          return prev
        }
        return { ...prev, [prizeId]: [...current, ticketNumber] }
      }
    })
  }

  async function copyWinnersToClipboard() {
    if (!event) return

    try {
      let text = ''
      const sortedPrizes = [...event.prizes].sort((a, b) => b.prizeAmount - a.prizeAmount)

      if (event.status === 'completed') {
        for (const prize of sortedPrizes) {
          if (prize.winners && prize.winners.length > 0) {
            text += `\n${formatAmount(prize.prizeAmount)} TL:\n`
            prize.winners.forEach((winner: any) => {
              const username = winner.ticketNumber?.user?.siteUsername || winner.ticketNumber?.user?.email || '-'
              text += `${username} - ${formatAmount(prize.prizeAmount)} TL\n`
            })
          }
        }
      } else {
        for (const prize of sortedPrizes) {
          const prizeId = prize.id || ''
          const winners = selectedWinners[prizeId] || []

          if (winners.length > 0) {
            text += `\n${formatAmount(prize.prizeAmount)} TL:\n`
            winners.forEach(ticketNum => {
              const ticket = ticketNumbers.find(t => t.ticketNumber === ticketNum)
              const username = ticket?.username || '-'
              text += `${username} - ${formatAmount(prize.prizeAmount)} TL\n`
            })
          }
        }
      }

      if (text.trim() === '') {
        toast.error('Kazanan yok')
        return
      }

      await navigator.clipboard.writeText(text.trim())
      toast.success('Kopyalandı!')
    } catch (error) {
      console.error('Error copying to clipboard:', error)
      toast.error('Kopyalanamadı')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: theme.background }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: theme.primary }} />
      </div>
    )
  }

  if (!event) return null

  const totalPrizePool = event.prizes.reduce((sum, p) => sum + (p.prizeAmount * p.winnerCount), 0)
  const isWaitingDraw = event.status === 'waiting_draw'
  const isCompleted = event.status === 'completed'
  const isActive = event.status === 'active'
  const isReviewing = event.status === 'reviewing'

  const allPrizesSelected = event.prizes.every(p => {
    const winners = selectedWinners[p.id || ''] || []
    return winners.length === p.winnerCount
  })
  const hasAnyWinners = Object.values(selectedWinners).some(winners => winners.length > 0)

  const displayedTickets = searchTerm.trim() === ''
    ? ticketNumbers
    : ticketNumbers.filter(t =>
        t.ticketNumber.toString().includes(searchTerm.replace('#', '').trim()) ||
        t.username?.toLowerCase().includes(searchTerm.toLowerCase())
      )

  return (
    <div className="min-h-screen" style={{ background: theme.background }}>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => router.push('/admin/tickets')}
          className="h-10 px-4 rounded-xl transition-all duration-200"
          style={{
            color: theme.textSecondary,
            background: `${theme.backgroundSecondary}50`
          }}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Geri Dön
        </Button>

        {/* Main Event Card */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: theme.card,
            border: `1px solid ${theme.border}`,
            boxShadow: `0 8px 32px ${theme.gradientFrom}08, 0 2px 8px rgba(0,0,0,0.12)`
          }}
        >
          {/* Top accent line */}
          <div
            className="h-1.5"
            style={{
              background: isCompleted
                ? '#475569'
                : isWaitingDraw
                ? `linear-gradient(90deg, ${theme.warning}, #d97706)`
                : `linear-gradient(90deg, ${theme.gradientFrom}, ${theme.gradientTo})`
            }}
          />

          <div className="p-6 space-y-5">
            {/* Header: Logo + Title */}
            <div className="flex items-start gap-4">
              {event.sponsor.logoUrl && (
                <div
                  className="flex-shrink-0 w-16 h-16 relative rounded-xl overflow-hidden"
                  style={{
                    background: `linear-gradient(145deg, ${theme.backgroundSecondary}, ${theme.background})`,
                    border: `1px solid ${theme.border}`,
                    boxShadow: `0 4px 12px ${theme.gradientFrom}12`
                  }}
                >
                  <Image
                    src={event.sponsor.logoUrl}
                    alt={event.sponsor.name}
                    fill
                    className="object-contain p-2"
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold mb-2" style={{ color: theme.text }}>
                  {event.title}
                </h1>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Status Badge */}
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                    style={{
                      background: isCompleted
                        ? 'rgba(71, 85, 105, 0.3)'
                        : isWaitingDraw
                        ? `${theme.warning}20`
                        : `${theme.primary}20`,
                      color: isCompleted ? '#94a3b8' : isWaitingDraw ? theme.warning : theme.primaryLight,
                      border: `1px solid ${isCompleted ? 'rgba(71, 85, 105, 0.4)' : isWaitingDraw ? `${theme.warning}30` : `${theme.primary}30`}`
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: isCompleted ? '#94a3b8' : isWaitingDraw ? theme.warning : theme.primary }}
                    />
                    {isCompleted ? 'Tamamlandı' : isWaitingDraw ? 'Çekiliş Bekliyor' : isReviewing ? 'Beklemede (Yatırım Girişi)' : 'Aktif'}
                  </span>

                  {/* Sponsor Badge */}
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                    style={{
                      background: `${theme.primary}15`,
                      color: theme.textSecondary,
                      border: `1px solid ${theme.border}`
                    }}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {event.sponsor.name}
                  </span>
                </div>
              </div>

              {/* Delete Button */}
              {!isCompleted && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="h-10 w-10 rounded-xl"
                  style={{
                    background: `${theme.danger}15`,
                    color: theme.danger,
                    border: `1px solid ${theme.danger}30`
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>

            {/* Description */}
            {event.description && (
              <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: theme.textSecondary }}>
                {event.description}
              </p>
            )}

            {/* Stats Grid - 3 columns */}
            <div className="grid grid-cols-3 gap-3">
              {/* Fiyat */}
              <div
                className="p-4 rounded-xl text-center"
                style={{
                  background: `linear-gradient(145deg, ${theme.backgroundSecondary}80, ${theme.background}60)`,
                  border: `1px solid ${theme.border}`
                }}
              >
                <div className="flex items-center justify-center gap-1.5 mb-2">
                  <Banknote className="w-4 h-4" style={{ color: theme.primary }} />
                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: theme.textSecondary }}>Fiyat</span>
                </div>
                <div className="text-xl font-black" style={{ color: theme.primaryLight }}>
                  {formatAmount(event.ticketPrice)} TL
                </div>
              </div>

              {/* Toplam */}
              <div
                className="p-4 rounded-xl text-center"
                style={{
                  background: `linear-gradient(145deg, ${theme.backgroundSecondary}80, ${theme.background}60)`,
                  border: `1px solid ${theme.border}`
                }}
              >
                <div className="flex items-center justify-center gap-1.5 mb-2">
                  <Users className="w-4 h-4" style={{ color: theme.textMuted }} />
                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: theme.textSecondary }}>Toplam</span>
                </div>
                <div className="text-xl font-black" style={{ color: theme.text }}>
                  {event.totalTickets ?? 'Sınırsız'}
                </div>
              </div>

              {/* Bitiş */}
              <div
                className="p-4 rounded-xl text-center"
                style={{
                  background: `linear-gradient(145deg, ${theme.backgroundSecondary}80, ${theme.background}60)`,
                  border: `1px solid ${theme.border}`
                }}
              >
                <div className="flex items-center justify-center gap-1.5 mb-2">
                  <Calendar className="w-4 h-4" style={{ color: theme.textMuted }} />
                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: theme.textSecondary }}>Bitiş</span>
                </div>
                <div className="text-sm font-bold" style={{ color: theme.text }}>{event.endDate ? formatDateTR(event.endDate) : 'Süresiz'}</div>
              </div>
            </div>

            {/* Time Remaining for active events */}
            {!isCompleted && (
              <div
                className="flex items-center justify-between py-3 px-4 rounded-xl"
                style={{
                  background: `linear-gradient(135deg, ${theme.primary}08, ${theme.primary}04)`,
                  border: `1px solid ${theme.primary}20`
                }}
              >
                <span className="text-sm font-medium" style={{ color: theme.text }}>Kalan Süre</span>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" style={{ color: theme.primary }} />
                  <span className="text-base font-bold" style={{ color: theme.primaryLight }}>{getTimeRemaining(event.endDate)}</span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {isActive && (
              <Button
                onClick={setReviewing}
                disabled={processing}
                className="w-full h-12 text-sm font-semibold rounded-xl border-0 transition-all duration-200"
                style={{
                  background: `linear-gradient(135deg, ${theme.warning}, #d97706)`,
                  color: 'white',
                  boxShadow: `0 4px 16px ${theme.warning}40`
                }}
              >
                {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <Clock className="w-4 h-4 mr-2" />
                Beklemeye Al (Yeni Katılımı Durdur)
              </Button>
            )}

            {/* Katılımcılar - artık etkinlik "Aktif" durumundayken de görünüyor,
                eskiden sadece "Beklemede"/"Çekiliş Bekliyor" durumuna geçince
                gösteriliyordu - admin en çok izlemek isteyeceği an (aktif
                katılım sırasında) katılımcıları hiç göremiyordu. */}
            <div
              className="rounded-xl p-4 space-y-3"
              style={{ background: 'rgba(15, 23, 42, 0.5)', border: `1px solid ${theme.border}` }}
            >
              <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: theme.text }}>
                <Banknote className="w-4 h-4" style={{ color: theme.primaryLight }} />
                Katılımcılar - Yatırım Tutarı Girişi
              </h3>
              <p className="text-xs" style={{ color: theme.textMuted }}>
                Her katılımcının gerçek yatırım tutarını gir. Bilet fiyatı: {formatAmount(event.ticketPrice)} TL
              </p>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {(event.requests || []).map((r) => {
                  const hasNumbers = (r.ticketNumbers?.length || 0) > 0
                  const estimatedTickets = Math.floor(r.investmentAmount / event.ticketPrice)
                  return (
                    <div
                      key={r.id}
                      className="flex items-center gap-2 p-2 rounded-lg"
                      style={{ background: 'rgba(30, 41, 59, 0.5)' }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate" style={{ color: theme.text }}>
                          {r.user?.siteUsername || r.user?.email || r.userId}
                        </p>
                        <p className="text-[11px]" style={{ color: theme.textMuted }}>
                          Sponsor: {r.sponsorInfo}
                          {hasNumbers && (
                            <span style={{ color: theme.primaryLight }}>
                              {' '}• {r.ticketNumbers!.length} bilet: {r.ticketNumbers!.map(t => t.ticketNumber).join(', ')}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          defaultValue={r.investmentAmount || ''}
                          placeholder="Tutar"
                          className="w-24 h-8 text-xs"
                          onBlur={(e) => {
                            const value = parseFloat(e.target.value)
                            if (!isNaN(value) && value !== r.investmentAmount) {
                              updateInvestment(r.id, value)
                            }
                          }}
                        />
                        <span className="text-[11px] whitespace-nowrap" style={{ color: theme.textMuted }}>
                          ≈{estimatedTickets} bilet
                        </span>
                        <button
                          onClick={() => removeParticipant(r.id)}
                          title="Katılımcıyı çıkar"
                          className="p-1.5 rounded-md hover:bg-white/5 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" style={{ color: theme.danger }} />
                        </button>
                      </div>
                    </div>
                  )
                })}
                {(!event.requests || event.requests.length === 0) && (
                  <p className="text-xs text-center py-4" style={{ color: theme.textMuted }}>
                    Henüz katılımcı yok
                  </p>
                )}
              </div>
            </div>

            {(isReviewing || isWaitingDraw) && (
              <div className="space-y-3">
                <Button
                  onClick={generateNumbers}
                  disabled={processing}
                  className="w-full h-12 text-sm font-semibold rounded-xl border-0"
                  style={{
                    background: `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})`,
                    color: 'white'
                  }}
                >
                  {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <Hash className="w-4 h-4 mr-2" />
                  Bilet Numaralarını Oluştur
                </Button>

                {isReviewing && event.soldTickets > 0 && (
                  <Button
                    onClick={() => setShowCompleteConfirm(true)}
                    disabled={processing}
                    className="w-full h-12 text-sm font-semibold rounded-xl border-0"
                    style={{
                      background: `linear-gradient(135deg, ${theme.warning}, #d97706)`,
                      color: 'white'
                    }}
                  >
                    <Trophy className="w-4 h-4 mr-2" />
                    Çekilişe Hazırla
                  </Button>
                )}
              </div>
            )}

            {isWaitingDraw && (
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setShowDistributeConfirm(true)}
                  disabled={processing || !allPrizesSelected}
                  className="flex-1 h-12 text-sm font-semibold rounded-xl border-0 transition-all duration-200 disabled:opacity-40"
                  style={{
                    background: `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})`,
                    color: 'white',
                    boxShadow: `0 4px 16px ${theme.gradientFrom}40`
                  }}
                >
                  {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <Award className="w-4 h-4 mr-2" />
                  Ödülleri Dağıt
                </Button>
                <Button
                  onClick={copyWinnersToClipboard}
                  disabled={!hasAnyWinners}
                  className="h-12 w-12 rounded-xl disabled:opacity-40"
                  style={{
                    background: theme.backgroundSecondary,
                    color: theme.textSecondary,
                    border: `1px solid ${theme.border}`
                  }}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            )}

            {isCompleted && (
              <Button
                onClick={copyWinnersToClipboard}
                className="w-full h-12 text-sm font-semibold rounded-xl"
                style={{
                  background: theme.backgroundSecondary,
                  color: theme.textSecondary,
                  border: `1px solid ${theme.border}`
                }}
              >
                <Copy className="w-4 h-4 mr-2" />
                Kazananları Kopyala
              </Button>
            )}
          </div>
        </div>

        {/* Prizes Card */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: theme.card,
            border: `1px solid ${theme.border}`,
            boxShadow: `0 8px 32px ${theme.gradientFrom}08, 0 2px 8px rgba(0,0,0,0.12)`
          }}
        >
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-base flex items-center gap-2" style={{ color: theme.text }}>
                <Trophy className="w-5 h-5" style={{ color: '#f59e0b' }} />
                Ödüller
              </h2>
              <span
                className="px-3 py-1.5 rounded-lg text-xs font-bold"
                style={{
                  background: `${theme.primary}15`,
                  color: theme.primaryLight,
                  border: `1px solid ${theme.primary}25`
                }}
              >
                Toplam: {formatAmount(totalPrizePool)} TL
              </span>
            </div>

            <div className="space-y-2">
              {event.prizes.map((prize, idx) => {
                const prizeId = prize.id || ''
                const winners = selectedWinners[prizeId] || []
                const isComplete = winners.length === prize.winnerCount

                return (
                  <div
                    key={prize.id || idx}
                    className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-xl"
                    style={{
                      background: `${theme.backgroundSecondary}60`,
                      border: `1px solid ${theme.border}`
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{
                          background: `linear-gradient(135deg, #f59e0b30, #f59e0b20)`,
                          border: `1px solid #f59e0b40`
                        }}
                      >
                        <Award className="w-5 h-5" style={{ color: '#fbbf24' }} />
                      </div>
                      <div>
                        <span className="text-lg font-bold" style={{ color: '#fbbf24' }}>{formatAmount(prize.prizeAmount)} TL</span>
                        <span className="text-xs ml-2" style={{ color: theme.textMuted }}>x{prize.winnerCount} kişi</span>
                      </div>
                    </div>

                    {isWaitingDraw && (
                      <div className="flex items-center gap-2">
                        {winners.length > 0 && (
                          <div className="flex items-center gap-1">
                            {winners.slice(0, 3).map(ticketNum => (
                              <span
                                key={ticketNum}
                                className="px-2 py-1 text-xs rounded-lg font-mono"
                                style={{
                                  background: `${theme.primary}20`,
                                  color: theme.primaryLight
                                }}
                              >
                                #{ticketNum}
                              </span>
                            ))}
                            {winners.length > 3 && (
                              <span className="text-xs" style={{ color: theme.textMuted }}>+{winners.length - 3}</span>
                            )}
                          </div>
                        )}
                        <Button
                          onClick={() => openPrizeSelectionModal(prize)}
                          size="sm"
                          className="h-9 px-4 text-xs rounded-lg"
                          style={{
                            background: isComplete ? `${theme.primary}20` : `${theme.backgroundSecondary}`,
                            color: isComplete ? theme.primaryLight : theme.textSecondary,
                            border: `1px solid ${isComplete ? `${theme.primary}40` : theme.border}`
                          }}
                        >
                          {isComplete && <Check className="w-3.5 h-3.5 mr-1" />}
                          {winners.length}/{prize.winnerCount} Seç
                        </Button>
                      </div>
                    )}

                    {isCompleted && prize.winners && prize.winners.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {prize.winners.map((winner: any, widx: number) => (
                          <div
                            key={widx}
                            className="px-3 py-1.5 rounded-lg"
                            style={{
                              background: `${theme.primary}15`,
                              border: `1px solid ${theme.primary}25`
                            }}
                          >
                            <div className="flex items-center gap-1.5">
                              <Hash className="w-3 h-3" style={{ color: theme.primaryLight }} />
                              <span className="font-bold text-xs" style={{ color: theme.primaryLight }}>{winner.ticketNumber?.ticketNumber ?? '-'}</span>
                              <span className="text-[10px]" style={{ color: theme.textMuted }}>
                                {winner.ticketNumber?.user?.siteUsername || winner.ticketNumber?.user?.email || '-'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Ticket Numbers Card */}
        {ticketNumbers.length > 0 && (
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: theme.card,
              border: `1px solid ${theme.border}`,
              boxShadow: `0 8px 32px ${theme.gradientFrom}08, 0 2px 8px rgba(0,0,0,0.12)`
            }}
          >
            <div className="p-5 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <h2 className="font-bold text-base flex items-center gap-2" style={{ color: theme.text }}>
                  <TicketCheck className="w-5 h-5" style={{ color: theme.primary }} />
                  Biletler ({ticketNumbers.length})
                </h2>
                <div className="relative w-full md:w-56">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: theme.textMuted }} />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Bilet veya kullanıcı ara..."
                    className="h-10 pl-10 text-sm rounded-xl"
                    style={{
                      background: theme.backgroundSecondary,
                      border: `1px solid ${theme.border}`,
                      color: theme.text
                    }}
                  />
                </div>
              </div>

              <ScrollArea className="max-h-[400px]">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                  {displayedTickets.map(ticket => (
                    <div
                      key={ticket.id}
                      className="p-3 rounded-xl"
                      style={{
                        background: `${theme.backgroundSecondary}60`,
                        border: `1px solid ${theme.border}`
                      }}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <Hash className="w-3.5 h-3.5" style={{ color: theme.primary }} />
                        <span className="font-bold text-sm" style={{ color: theme.primaryLight }}>{ticket.ticketNumber}</span>
                      </div>
                      <div className="text-xs truncate font-medium" style={{ color: theme.text }}>
                        {ticket.username || 'N/A'}
                      </div>
                      <div className="text-[10px] truncate" style={{ color: theme.textMuted }}>
                        {ticket.sponsorInfo}
                      </div>
                    </div>
                  ))}
                </div>

                {displayedTickets.length === 0 && searchTerm.trim() !== '' && (
                  <div className="text-center py-8 text-sm" style={{ color: theme.textMuted }}>
                    Sonuç bulunamadı
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent
            className="max-w-md rounded-2xl"
            style={{
              background: theme.card,
              border: `1px solid ${theme.border}`
            }}
          >
            <AlertDialogHeader>
              <AlertDialogTitle style={{ color: theme.text }}>Etkinliği Sil</AlertDialogTitle>
              <AlertDialogDescription style={{ color: theme.textSecondary }}>
                Bu etkinliği silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel
                className="h-10 text-sm rounded-xl"
                style={{
                  background: theme.backgroundSecondary,
                  color: theme.textSecondary,
                  border: `1px solid ${theme.border}`
                }}
              >
                İptal
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={deleteEvent}
                className="h-10 text-sm rounded-xl border-0"
                style={{
                  background: `linear-gradient(135deg, ${theme.danger}, #dc2626)`,
                  color: 'white'
                }}
              >
                Evet, Sil
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Prepare Draw Confirmation Dialog */}
        <AlertDialog open={showCompleteConfirm} onOpenChange={setShowCompleteConfirm}>
          <AlertDialogContent
            className="max-w-md rounded-2xl"
            style={{
              background: theme.card,
              border: `1px solid ${theme.border}`
            }}
          >
            <AlertDialogHeader>
              <AlertDialogTitle style={{ color: theme.text }}>Çekilişe Hazırla</AlertDialogTitle>
              <AlertDialogDescription style={{ color: theme.textSecondary }}>
                Etkinlik çekiliş hazırlama aşamasına geçecek. Artık yeni bilet satışı yapılmayacak. Devam etmek istiyor musunuz?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel
                className="h-10 text-sm rounded-xl"
                style={{
                  background: theme.backgroundSecondary,
                  color: theme.textSecondary,
                  border: `1px solid ${theme.border}`
                }}
              >
                İptal
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={prepareDrawEvent}
                className="h-10 text-sm rounded-xl border-0"
                style={{
                  background: `linear-gradient(135deg, ${theme.warning}, #d97706)`,
                  color: 'white'
                }}
              >
                Evet, Hazırla
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Distribute Rewards Confirmation Dialog */}
        <AlertDialog open={showDistributeConfirm} onOpenChange={setShowDistributeConfirm}>
          <AlertDialogContent
            className="max-w-md rounded-2xl"
            style={{
              background: theme.card,
              border: `1px solid ${theme.border}`
            }}
          >
            <AlertDialogHeader>
              <AlertDialogTitle style={{ color: theme.text }}>Ödülleri Dağıt</AlertDialogTitle>
              <AlertDialogDescription style={{ color: theme.textSecondary }}>
                Seçilen kazananlara ödüller dağıtılacak ve etkinlik tamamlanacak. Bu işlem geri alınamaz. Devam etmek istiyor musunuz?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel
                className="h-10 text-sm rounded-xl"
                style={{
                  background: theme.backgroundSecondary,
                  color: theme.textSecondary,
                  border: `1px solid ${theme.border}`
                }}
              >
                İptal
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={distributeRewards}
                className="h-10 text-sm rounded-xl border-0"
                style={{
                  background: `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})`,
                  color: 'white'
                }}
              >
                Evet, Dağıt
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Winner Selection Modal */}
        {showPrizeSelectionModal && selectedPrizeForSelection && event && (
          <WinnerSelector
            event={event}
            prize={selectedPrizeForSelection}
            ticketNumbers={ticketNumbers}
            selectedWinners={selectedWinners[selectedPrizeForSelection.id || ''] || []}
            allSelectedWinners={selectedWinners}
            onToggleWinner={(ticketNumber) => toggleWinnerSelection(selectedPrizeForSelection.id || '', ticketNumber)}
            onClearSelection={() => {
              const prizeId = selectedPrizeForSelection.id || ''
              setSelectedWinners(prev => ({ ...prev, [prizeId]: [] }))
            }}
            onClose={() => {
              setShowPrizeSelectionModal(false)
              setSelectedPrizeForSelection(null)
            }}
            formatAmount={formatAmount}
          />
        )}
      </div>
    </div>
  )
}
