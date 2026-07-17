'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Users, Trophy, ArrowLeft, Loader2, Search, Calendar, Copy, CheckCircle, Sparkles, Crown, Clock, Gift, ChevronRight, Check } from 'lucide-react'
import { toast } from 'sonner'
import Image from 'next/image'

// Sabit mavi tema renkleri
const theme = {
  primary: '#3b82f6',
  primaryLight: '#60a5fa',
  primaryDark: '#2563eb',
  gradientFrom: '#3b82f6',
  gradientTo: '#1d4ed8',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  card: 'rgba(30, 41, 59, 0.8)',
  cardHover: 'rgba(30, 41, 59, 0.95)',
  border: 'rgba(71, 85, 105, 0.5)',
  text: '#f1f5f9',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  background: '#0f172a',
  backgroundSecondary: '#1e293b',
}

interface Event {
  id: string
  title: string
  description: string
  imageUrl?: string
  status: string
  sponsor: { id: string; name: string; logoUrl?: string }
  participantLimit: number
  participationType: string
  participantCount: number
  endDate: string | null
  participants?: Array<{
    id: string
    user: { siteUsername?: string; email?: string; telegramUsername?: string; firstName?: string }
    sponsorInfo: string
    createdAt: string
  }>
  winners?: Array<{
    id: string
    status: string
    statusMessage: string
    userId: string
    user: { siteUsername?: string; email?: string }
  }>
  _count?: { participants: number; winners: number }
}

const statusOptions = [
  { value: 'prize_added', label: 'Ödül Eklendi' },
  { value: 'no_investment', label: 'Yatırım Yok' },
  { value: 'no_bonus', label: 'No Bonus' },
  { value: 'multi', label: 'Multi' },
  { value: 'last_transaction', label: 'Son İşlem Bonus' },
  { value: 'active_balance', label: 'Aktif Bakiye' },
  { value: 'different_btag', label: 'Farklı Btag' }
]

export default function AdminEventDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [event, setEvent] = useState<Event | null>(null)
  const [search, setSearch] = useState('')
  const [winnerSearch, setWinnerSearch] = useState('')
  const [processing, setProcessing] = useState(false)
  const [winnerStatuses, setWinnerStatuses] = useState<Record<string, { status: string; statusMessage: string }>>({})
  const [showEndConfirm, setShowEndConfirm] = useState(false)
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false)

  // New state for status selection dialog
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [selectedWinnerId, setSelectedWinnerId] = useState<string | null>(null)
  const [tempSelectedStatus, setTempSelectedStatus] = useState<string>('')

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) return router.push('/admin')
    loadEvent()
    // eslint-disable-next-line
  }, [params.id])

  async function loadEvent() {
    try {
      const res = await fetch(`/api/admin/events/${params.id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` }
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setEvent(data.event)

      if (data.event.winners) {
        const statuses: Record<string, { status: string; statusMessage: string }> = {}
        data.event.winners.forEach((w: any) => {
          statuses[w.userId] = {
            status: w.status === 'pending' ? 'prize_added' : w.status,
            statusMessage: w.status === 'pending' ? 'Ödül Eklendi' : w.statusMessage
          }
        })
        setWinnerStatuses(statuses)
      }
    } catch {
      toast.error('Hata')
      router.push('/admin/events')
    } finally {
      setLoading(false)
    }
  }

  async function handleAction(action: 'end') {
    setShowEndConfirm(false)
    try {
      setProcessing(true)
      const res = await fetch(`/api/admin/events/${params.id}/${action}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` }
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      toast.success(data.message || 'Başarılı')
      loadEvent()
    } catch {
      toast.error('Hata')
    } finally {
      setProcessing(false)
    }
  }

  async function handleComplete() {
    setShowCompleteConfirm(false)
    try {
      setProcessing(true)
      const res = await fetch(`/api/admin/events/${params.id}/complete`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('admin_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ winnerStatuses })
      })
      if (!res.ok) throw new Error()
      toast.success('Etkinlik tamamlandı')
      loadEvent()
    } catch {
      toast.error('Hata')
    } finally {
      setProcessing(false)
    }
  }

  function updateWinnerStatus(userId: string, statusValue: string) {
    const option = statusOptions.find(opt => opt.value === statusValue)
    if (option) {
      setWinnerStatuses(prev => ({
        ...prev,
        [userId]: {
          status: option.value,
          statusMessage: option.label
        }
      }))
    }
  }

  // New function to open status dialog
  function openStatusDialog(userId: string) {
    setSelectedWinnerId(userId)
    setTempSelectedStatus(winnerStatuses[userId]?.status || 'prize_added')
    setStatusDialogOpen(true)
  }

  // New function to confirm status selection
  function confirmStatusSelection() {
    if (selectedWinnerId && tempSelectedStatus) {
      updateWinnerStatus(selectedWinnerId, tempSelectedStatus)
    }
    setStatusDialogOpen(false)
    setSelectedWinnerId(null)
    setTempSelectedStatus('')
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

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen" style={{ background: theme.background }}>
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: theme.primary }} />
    </div>
  )
  if (!event) return null

  const filtered = event.participants?.filter(p => {
    const s = search.toLowerCase()
    return p.user.siteUsername?.toLowerCase().includes(s) ||
           p.user.email?.toLowerCase().includes(s) ||
           p.user.telegramUsername?.toLowerCase().includes(s) ||
           p.sponsorInfo.toLowerCase().includes(s)
  }) || []

  const filteredWinners = event.winners?.filter(w => {
    const s = winnerSearch.toLowerCase()
    const participant = event.participants?.find(p => p.user.siteUsername === w.user.siteUsername || p.user.email === w.user.email)
    return w.user.siteUsername?.toLowerCase().includes(s) ||
           w.user.email?.toLowerCase().includes(s) ||
           participant?.sponsorInfo?.toLowerCase().includes(s)
  }) || []

  const progress = (event.participantCount / event.participantLimit) * 100
  const isRaffle = event.participationType === 'raffle'
  const isEveryone = event.participationType === 'everyone'
  const isPastEvent = event.status === 'completed' || event.status === 'pending'

  const allWinnersHaveStatus = event.winners?.every(w =>
    winnerStatuses[w.userId]?.status &&
    winnerStatuses[w.userId]?.status !== 'pending'
  ) ?? false

  const formatDate = (date: string) =>
    new Date(date).toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })

  return (
    <div className="min-h-screen" style={{ background: theme.background }}>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => router.push('/admin/events')}
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
              background: event.status === 'completed'
                ? '#475569'
                : event.status === 'pending'
                ? `linear-gradient(90deg, ${theme.warning}, #d97706)`
                : `linear-gradient(90deg, ${theme.gradientFrom}, ${theme.gradientTo})`
            }}
          />

          <div className="p-6 space-y-5">
            {/* Header: Logo + Title */}
            <div className="flex items-start gap-4">
              <div
                className="flex-shrink-0 w-16 h-16 relative rounded-xl overflow-hidden"
                style={{
                  background: `linear-gradient(145deg, ${theme.backgroundSecondary}, ${theme.background})`,
                  border: `1px solid ${theme.border}`,
                  boxShadow: `0 4px 12px ${theme.gradientFrom}12`
                }}
              >
                <Image
                  src={event.imageUrl || event.sponsor.logoUrl || '/logo.webp'}
                  alt={event.title}
                  fill
                  className="object-contain p-2"
                />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold mb-2" style={{ color: theme.text }}>
                  {event.title}
                </h1>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Status Badge */}
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                    style={{
                      background: event.status === 'completed'
                        ? 'rgba(71, 85, 105, 0.3)'
                        : event.status === 'pending'
                        ? `${theme.warning}20`
                        : `${theme.primary}20`,
                      color: event.status === 'completed' ? '#94a3b8' : event.status === 'pending' ? theme.warning : theme.primaryLight,
                      border: `1px solid ${event.status === 'completed' ? 'rgba(71, 85, 105, 0.4)' : event.status === 'pending' ? `${theme.warning}30` : `${theme.primary}30`}`
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{
                        background: event.status === 'completed' ? '#94a3b8' : event.status === 'pending' ? theme.warning : theme.primary
                      }}
                    />
                    {event.status === 'active' ? 'Aktif' : event.status === 'pending' ? 'Beklemede' : 'Tamamlandı'}
                  </span>

                  {/* Type Badge */}
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                    style={{
                      background: isRaffle ? `${theme.primary}15` : `${theme.success}15`,
                      color: isRaffle ? theme.primaryLight : theme.success,
                      border: `1px solid ${isRaffle ? `${theme.primary}25` : `${theme.success}25`}`
                    }}
                  >
                    {isRaffle ? <Sparkles className="w-3.5 h-3.5" /> : <Crown className="w-3.5 h-3.5" />}
                    {isRaffle ? 'Çekiliş' : 'İlk Gelen Alır'}
                  </span>
                </div>
              </div>
            </div>

            {/* Description */}
            {event.description && (
              <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: theme.textSecondary }}>
                {event.description}
              </p>
            )}

            {/* Stats Grid - 4 columns */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Kazanacak */}
              <div
                className="p-4 rounded-xl text-center"
                style={{
                  background: `linear-gradient(145deg, ${theme.backgroundSecondary}80, ${theme.background}60)`,
                  border: `1px solid ${theme.border}`
                }}
              >
                <div className="flex items-center justify-center gap-1.5 mb-2">
                  <Trophy className="w-4 h-4" style={{ color: theme.primary }} />
                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: theme.textSecondary }}>Kazanacak</span>
                </div>
                <div className="text-2xl font-black" style={{ color: theme.text }}>
                  {isEveryone ? 'Herkes' : event.participantLimit}
                </div>
              </div>

              {/* Katılımcı */}
              <div
                className="p-4 rounded-xl text-center"
                style={{
                  background: `linear-gradient(145deg, ${theme.backgroundSecondary}80, ${theme.background}60)`,
                  border: `1px solid ${theme.border}`
                }}
              >
                <div className="flex items-center justify-center gap-1.5 mb-2">
                  <Users className="w-4 h-4" style={{ color: theme.primary }} />
                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: theme.textSecondary }}>Katılımcı</span>
                </div>
                <div className="text-2xl font-black" style={{ color: theme.text }}>
                  {event.participantCount}
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
                <div className="text-sm font-bold" style={{ color: theme.text }}>{event.endDate ? formatDate(event.endDate) : 'Süresiz'}</div>
              </div>

              {/* Kazanan */}
              <div
                className="p-4 rounded-xl text-center"
                style={{
                  background: `linear-gradient(145deg, ${theme.backgroundSecondary}80, ${theme.background}60)`,
                  border: `1px solid ${theme.border}`
                }}
              >
                <div className="flex items-center justify-center gap-1.5 mb-2">
                  <Trophy className="w-4 h-4" style={{ color: theme.success }} />
                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: theme.textSecondary }}>Kazanan</span>
                </div>
                <div className="text-2xl font-black" style={{ color: theme.text }}>
                  {event._count?.winners || 0}
                </div>
              </div>
            </div>

            {/* Time Remaining for active events */}
            {!isPastEvent && (
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

            {/* Progress (sadece limited için - raffle ve everyone'da doluluk anlamsız) */}
            {!isRaffle && !isEveryone && !isPastEvent && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium" style={{ color: theme.text }}>Doluluk Oranı</span>
                  <span className="font-bold" style={{ color: theme.primaryLight }}>{Math.round(progress)}%</span>
                </div>
                <div
                  className="w-full h-3 rounded-full overflow-hidden"
                  style={{ background: `${theme.border}` }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(progress, 100)}%`,
                      background: `linear-gradient(90deg, ${theme.gradientFrom}, ${theme.gradientTo})`
                    }}
                  />
                </div>
              </div>
            )}

            {/* Action Button */}
            {event.status === 'active' && (
              <Button
                onClick={() => setShowEndConfirm(true)}
                disabled={processing}
                className="w-full h-12 text-sm font-semibold rounded-xl border-0 transition-all duration-200"
                style={{
                  background: `linear-gradient(135deg, ${theme.danger}, #dc2626)`,
                  color: 'white',
                  boxShadow: `0 4px 16px ${theme.danger}40`
                }}
              >
                {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {event.participationType === 'raffle' ? 'Sonlandır ve Çekiliş Yap' : 'Sonlandır'}
              </Button>
            )}
          </div>
        </div>

        {/* Participants Card */}
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
                <Users className="w-5 h-5" style={{ color: theme.primary }} />
                Katılımcılar ({event.participants?.length || 0})
              </h2>
              <div className="relative w-full md:w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: theme.textMuted }} />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Katılımcı ara..."
                  className="h-10 pl-10 text-sm rounded-xl"
                  style={{
                    background: theme.backgroundSecondary,
                    border: `1px solid ${theme.border}`,
                    color: theme.text
                  }}
                />
              </div>
            </div>

            <ScrollArea className="max-h-[400px] md:max-h-[500px] pr-2 -mr-2">
              <div className="space-y-2">
                {filtered.length > 0 ? filtered.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-3 rounded-xl"
                    style={{
                      background: `${theme.backgroundSecondary}60`,
                      border: `1px solid ${theme.border}`
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate" style={{ color: theme.text }}>
                        {p.user.siteUsername || p.user.email || p.user.telegramUsername || p.user.firstName || 'User'}
                      </p>
                      <p className="text-xs truncate" style={{ color: theme.textMuted }}>{p.sponsorInfo}</p>
                    </div>
                  </div>
                )) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
                      style={{
                        background: `${theme.primary}15`,
                        border: `1px solid ${theme.primary}20`
                      }}
                    >
                      <Users className="w-7 h-7" style={{ color: `${theme.primary}60` }} />
                    </div>
                    <p className="text-sm font-medium" style={{ color: theme.textMuted }}>
                      {search ? 'Katılımcı bulunamadı' : 'Henüz katılımcı yok'}
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Winners Card */}
        {event.winners && event.winners.length > 0 && (
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: theme.card,
              border: `1px solid ${theme.border}`,
              boxShadow: `0 8px 32px ${theme.gradientFrom}08, 0 2px 8px rgba(0,0,0,0.12)`
            }}
          >
            <div className="p-5 space-y-4">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <h2 className="font-bold text-base flex items-center gap-2" style={{ color: theme.text }}>
                    <Trophy className="w-5 h-5" style={{ color: theme.success }} />
                    Kazananlar ({event.winners.length})
                  </h2>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => {
                        const winnersText = event.winners?.map((w) => {
                          const participant = event.participants?.find(p => p.user.siteUsername === w.user.siteUsername || p.user.email === w.user.email)
                          const sponsorInfo = participant?.sponsorInfo || 'Sponsor bilgisi yok'
                          if (event.status === 'completed') {
                            const status = winnerStatuses[w.userId]?.statusMessage || w.statusMessage || 'Durum yok'
                            return `${sponsorInfo} - ${status}`
                          } else {
                            return sponsorInfo
                          }
                        }).join('\n') || ''
                        navigator.clipboard.writeText(winnersText)
                        toast.success('Kopyalandı')
                      }}
                      size="sm"
                      className="h-9 px-4 text-xs rounded-lg"
                      style={{
                        background: theme.backgroundSecondary,
                        color: theme.textSecondary,
                        border: `1px solid ${theme.border}`
                      }}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Kopyala
                    </Button>
                    {event.status === 'pending' && (
                      <Button
                        onClick={() => setShowCompleteConfirm(true)}
                        disabled={processing || !allWinnersHaveStatus}
                        size="sm"
                        className="h-9 px-4 text-xs rounded-lg border-0 disabled:opacity-40"
                        style={{
                          background: `linear-gradient(135deg, ${theme.success}, #16a34a)`,
                          color: 'white',
                          boxShadow: `0 4px 12px ${theme.success}40`
                        }}
                      >
                        {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                        Tamamla
                      </Button>
                    )}
                  </div>
                </div>

                <div className="relative w-full md:w-56">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: theme.textMuted }} />
                  <Input
                    value={winnerSearch}
                    onChange={(e) => setWinnerSearch(e.target.value)}
                    placeholder="Kazanan ara..."
                    className="h-10 pl-10 text-sm rounded-xl"
                    style={{
                      background: theme.backgroundSecondary,
                      border: `1px solid ${theme.border}`,
                      color: theme.text
                    }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                {filteredWinners.length > 0 ? filteredWinners.map((w, idx) => {
                  const participant = event.participants?.find(p => p.user.siteUsername === w.user.siteUsername || p.user.email === w.user.email)
                  const currentStatus = winnerStatuses[w.userId]?.statusMessage || 'Ödül Eklendi'
                  return (
                    <div
                      key={w.id}
                      className="flex flex-col md:flex-row md:items-center gap-3 p-4 rounded-xl"
                      style={{
                        background: `${theme.backgroundSecondary}60`,
                        border: `1px solid ${theme.border}`
                      }}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span
                          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{
                            background: `linear-gradient(135deg, ${theme.gradientFrom}30, ${theme.gradientTo}20)`,
                            color: theme.text
                          }}
                        >
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate" style={{ color: theme.text }}>{w.user.siteUsername || w.user.email || 'User'}</p>
                          <p className="text-xs truncate" style={{ color: theme.textMuted }}>{participant?.sponsorInfo || 'Sponsor bilgisi yok'}</p>
                        </div>
                      </div>
                      {event.status === 'pending' ? (
                        <div className="flex items-center gap-3">
                          <span
                            className="text-sm font-medium"
                            style={{ color: theme.text }}
                          >
                            {currentStatus}
                          </span>
                          <Button
                            onClick={() => openStatusDialog(w.userId)}
                            size="sm"
                            className="h-9 px-4 text-xs rounded-lg flex items-center gap-1"
                            style={{
                              background: `${theme.primary}20`,
                              color: theme.primaryLight,
                              border: `1px solid ${theme.primary}30`
                            }}
                          >
                            Seç
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="text-right">
                          <span
                            className="px-3 py-1.5 rounded-lg text-xs font-medium"
                            style={{
                              background: `${theme.primary}20`,
                              color: theme.primaryLight
                            }}
                          >
                            {w.statusMessage || w.status}
                          </span>
                        </div>
                      )}
                    </div>
                  )
                }) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
                      style={{
                        background: `${theme.success}15`,
                        border: `1px solid ${theme.success}20`
                      }}
                    >
                      <Trophy className="w-7 h-7" style={{ color: `${theme.success}60` }} />
                    </div>
                    <p className="text-sm font-medium" style={{ color: theme.textMuted }}>
                      {winnerSearch ? 'Kazanan bulunamadı' : 'Henüz kazanan yok'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* End Event Confirmation Dialog */}
        <AlertDialog open={showEndConfirm} onOpenChange={setShowEndConfirm}>
          <AlertDialogContent
            className="max-w-md rounded-2xl"
            style={{
              background: theme.card,
              border: `1px solid ${theme.border}`
            }}
          >
            <AlertDialogHeader>
              <AlertDialogTitle style={{ color: theme.text }}>Etkinliği Sonlandır</AlertDialogTitle>
              <AlertDialogDescription style={{ color: theme.textSecondary }}>
                {event?.participationType === 'raffle'
                  ? 'Etkinlik sonlandırılacak ve çekiliş yapılacak. Emin misiniz?'
                  : 'Etkinliği sonlandırmak istediğinizden emin misiniz?'}
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
                onClick={() => handleAction('end')}
                className="h-10 text-sm rounded-xl border-0"
                style={{
                  background: `linear-gradient(135deg, ${theme.danger}, #dc2626)`,
                  color: 'white'
                }}
              >
                Evet, Sonlandır
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Complete Event Confirmation Dialog */}
        <AlertDialog open={showCompleteConfirm} onOpenChange={setShowCompleteConfirm}>
          <AlertDialogContent
            className="max-w-md rounded-2xl"
            style={{
              background: theme.card,
              border: `1px solid ${theme.border}`
            }}
          >
            <AlertDialogHeader>
              <AlertDialogTitle style={{ color: theme.text }}>Etkinliği Tamamla</AlertDialogTitle>
              <AlertDialogDescription style={{ color: theme.textSecondary }}>
                Etkinliği tamamlamak istediğinizden emin misiniz? Bu işlem geri alınamaz.
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
                onClick={handleComplete}
                className="h-10 text-sm rounded-xl border-0"
                style={{
                  background: `linear-gradient(135deg, ${theme.success}, #16a34a)`,
                  color: 'white'
                }}
              >
                Evet, Tamamla
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Status Selection Dialog */}
        <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
          <DialogContent
            className="max-w-sm rounded-2xl p-0 overflow-hidden"
            style={{
              background: theme.card,
              border: `1px solid ${theme.border}`
            }}
          >
            <DialogHeader className="p-5 pb-3">
              <DialogTitle style={{ color: theme.text }}>Durum Seç</DialogTitle>
            </DialogHeader>
            <div className="px-5 pb-3 space-y-2">
              {statusOptions.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTempSelectedStatus(opt.value)}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl transition-all duration-150"
                  style={{
                    background: tempSelectedStatus === opt.value
                      ? `${theme.primary}20`
                      : `${theme.backgroundSecondary}60`,
                    border: tempSelectedStatus === opt.value
                      ? `1px solid ${theme.primary}40`
                      : `1px solid ${theme.border}`,
                    cursor: 'pointer'
                  }}
                >
                  <span
                    className="text-sm font-medium"
                    style={{
                      color: tempSelectedStatus === opt.value ? theme.primaryLight : theme.text
                    }}
                  >
                    {opt.label}
                  </span>
                  {tempSelectedStatus === opt.value && (
                    <Check className="w-5 h-5" style={{ color: theme.primary }} />
                  )}
                </button>
              ))}
            </div>
            <DialogFooter className="p-5 pt-3 gap-2">
              <Button
                variant="ghost"
                onClick={() => setStatusDialogOpen(false)}
                className="h-10 px-4 text-sm rounded-xl"
                style={{
                  background: theme.backgroundSecondary,
                  color: theme.textSecondary,
                  border: `1px solid ${theme.border}`
                }}
              >
                İptal
              </Button>
              <Button
                onClick={confirmStatusSelection}
                className="h-10 px-6 text-sm rounded-xl border-0"
                style={{
                  background: `linear-gradient(135deg, ${theme.primary}, ${theme.primaryDark})`,
                  color: 'white'
                }}
              >
                Tamam
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
