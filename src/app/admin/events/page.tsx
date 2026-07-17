'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Users, Calendar, Gift, Trophy, Loader2, Clock, Sparkles, Crown, Eye } from 'lucide-react'
import { toast } from 'sonner'
import Image from 'next/image'
import Link from 'next/link'
import { optimizeCloudinaryImage } from '@/lib/utils'

// Sabit mavi tema renkleri
const theme = {
  primary: '#3b82f6',
  primaryLight: '#60a5fa',
  primaryDark: '#2563eb',
  gradientFrom: '#3b82f6',
  gradientTo: '#1d4ed8',
  success: '#22c55e',
  warning: '#f59e0b',
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
  imageUrl?: string
  sponsor: { name: string; logoUrl?: string }
  participantLimit: number
  participationType: 'limited' | 'raffle' | 'everyone'
  participantCount: number
  endDate: string | null
  status: 'active' | 'pending' | 'completed'
  _count?: { participants: number; winners: number }
}

export default function AdminEventsPage() {
  const router = useRouter()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) return router.push('/admin')
    loadEvents()
  }, [])

  async function loadEvents() {
    try {
      const res = await fetch('/api/admin/events', {
        headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` }
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setEvents(data.events || [])
    } catch {
      toast.error('Etkinlikler yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })

  const getTimeRemaining = (endDate: string | null) => {
    if (!endDate) return 'Süresiz'
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

  const activeEvents = events.filter(e => e.status === 'active' || e.status === 'pending')
  const pastEvents = events.filter(e => e.status === 'completed')

  const EventCard = ({ event }: { event: Event }) => {
    const progress = (event.participantCount / event.participantLimit) * 100
    const isRaffle = event.participationType === 'raffle'
    const isEveryone = event.participationType === 'everyone'
    const isCompleted = event.status === 'completed'
    const isPending = event.status === 'pending'

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
            background: isCompleted
              ? '#475569'
              : isPending
              ? `linear-gradient(90deg, ${theme.warning}, #d97706)`
              : `linear-gradient(90deg, ${theme.gradientFrom}, ${theme.gradientTo})`
          }}
        />

        <div className="p-5 space-y-4">
          {/* Header: Logo + Title + Type Badge */}
          <div className="flex items-start gap-4">
            <div
              className="flex-shrink-0 w-14 h-14 relative rounded-xl overflow-hidden"
              style={{
                background: `linear-gradient(145deg, ${theme.backgroundSecondary}, ${theme.background})`,
                border: `1px solid ${theme.border}`,
                boxShadow: `0 4px 12px ${theme.gradientFrom}15`
              }}
            >
              <Image
                src={optimizeCloudinaryImage(event.imageUrl || event.sponsor.logoUrl || '/logo.webp', 112, 112)}
                unoptimized
                alt={event.title}
                fill
                className="object-contain p-2"
              />
            </div>
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
                    background: isCompleted
                      ? 'rgba(71, 85, 105, 0.3)'
                      : isPending
                      ? `${theme.warning}20`
                      : `${theme.primary}20`,
                    color: isCompleted ? '#94a3b8' : isPending ? theme.warning : theme.primaryLight,
                    border: `1px solid ${isCompleted ? 'rgba(71, 85, 105, 0.4)' : isPending ? `${theme.warning}30` : `${theme.primary}30`}`
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      background: isCompleted ? '#94a3b8' : isPending ? theme.warning : theme.primary
                    }}
                  />
                  {isCompleted ? 'Tamamlandı' : isPending ? 'Beklemede' : 'Aktif'}
                </span>

                {/* Type Badge */}
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                  style={{
                    background: isRaffle ? `${theme.primary}15` : `${theme.success}15`,
                    color: isRaffle ? theme.primaryLight : theme.success,
                    border: `1px solid ${isRaffle ? `${theme.primary}25` : `${theme.success}25`}`
                  }}
                >
                  {isRaffle ? <Sparkles className="w-3 h-3" /> : <Crown className="w-3 h-3" />}
                  {isRaffle ? 'Çekiliş' : 'İlk Gelen'}
                </span>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3">
            {/* Kazanacak (Winners Count) */}
            <div
              className="p-3 rounded-xl text-center"
              style={{
                background: `linear-gradient(145deg, ${theme.backgroundSecondary}80, ${theme.background}60)`,
                border: `1px solid ${theme.border}`
              }}
            >
              <div className="flex items-center justify-center gap-1 mb-1">
                <Trophy className="w-3.5 h-3.5" style={{ color: theme.primary }} />
              </div>
              <div className="text-lg font-bold" style={{ color: theme.text }}>{isEveryone ? 'Herkes' : event.participantLimit}</div>
              <div className="text-[9px] font-medium uppercase tracking-wide" style={{ color: theme.textMuted }}>
                Kazanacak
              </div>
            </div>

            {/* Katılımcı */}
            <div
              className="p-3 rounded-xl text-center"
              style={{
                background: `linear-gradient(145deg, ${theme.backgroundSecondary}80, ${theme.background}60)`,
                border: `1px solid ${theme.border}`
              }}
            >
              <div className="flex items-center justify-center gap-1 mb-1">
                <Users className="w-3.5 h-3.5" style={{ color: theme.primary }} />
              </div>
              <div className="text-lg font-bold" style={{ color: theme.text }}>{event.participantCount}</div>
              <div className="text-[9px] font-medium uppercase tracking-wide" style={{ color: theme.textMuted }}>
                Katılımcı
              </div>
            </div>

            {/* Bitiş */}
            <div
              className="p-3 rounded-xl text-center"
              style={{
                background: `linear-gradient(145deg, ${theme.backgroundSecondary}80, ${theme.background}60)`,
                border: `1px solid ${theme.border}`
              }}
            >
              <div className="flex items-center justify-center gap-1 mb-1">
                <Calendar className="w-3.5 h-3.5" style={{ color: theme.textMuted }} />
              </div>
              <div className="text-[10px] font-bold" style={{ color: theme.text }}>{event.endDate ? formatDate(event.endDate) : 'Süresiz'}</div>
              <div className="text-[9px] font-medium uppercase tracking-wide" style={{ color: theme.textMuted }}>
                Bitiş
              </div>
            </div>
          </div>

          {/* Progress Section - Only for active events */}
          {!isCompleted && (
            <div
              className="p-3 rounded-xl"
              style={{
                background: `${theme.backgroundSecondary}50`,
                border: `1px solid ${theme.border}`
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" style={{ color: theme.textMuted }} />
                  <span className="text-[11px] font-medium" style={{ color: theme.textSecondary }}>Kalan Süre</span>
                </div>
                <span className="text-[11px] font-bold" style={{ color: theme.primaryLight }}>{getTimeRemaining(event.endDate)}</span>
              </div>

              {!isRaffle && !isEveryone && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px]">
                    <span style={{ color: theme.textMuted }}>Doluluk</span>
                    <span className="font-semibold" style={{ color: theme.primaryLight }}>{Math.round(progress)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: `${theme.border}` }}>
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
            </div>
          )}

          {/* Detaylar Butonu */}
          <Button
            onClick={() => router.push(`/admin/events/${event.id}`)}
            className="w-full h-10 text-sm font-semibold rounded-xl border-0 transition-all duration-200 hover:scale-[1.02]"
            style={{
              background: `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})`,
              color: 'white',
              boxShadow: `0 4px 16px ${theme.gradientFrom}30`
            }}
          >
            <Eye className="w-4 h-4 mr-2" />
            Detaylar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: theme.background }}>
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold mb-1" style={{ color: theme.text }}>Etkinlik Yönetimi</h1>
            <p className="text-sm" style={{ color: theme.textMuted }}>Etkinlikleri görüntüle ve yönet</p>
          </div>
          <Link href="/admin/events/create">
            <Button
              className="font-semibold rounded-xl px-5 h-10 text-sm border-0 transition-all duration-200 hover:scale-105"
              style={{
                background: `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})`,
                color: 'white',
                boxShadow: `0 4px 16px ${theme.gradientFrom}40`
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Yeni Etkinlik
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin mb-3" style={{ color: theme.primary }} />
            <p className="text-sm" style={{ color: theme.textMuted }}>Etkinlikler yükleniyor...</p>
          </div>
        ) : (
          <Tabs defaultValue="active" className="w-full">
            {/* Tab List */}
            <div
              className="flex gap-1.5 p-1.5 rounded-xl mb-5"
              style={{
                background: `linear-gradient(135deg, ${theme.backgroundSecondary}90, ${theme.card}90)`,
                border: `1px solid ${theme.border}`,
              }}
            >
              <TabsList className="bg-transparent p-0 h-auto gap-1 w-full">
                <TabsTrigger
                  value="active"
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all data-[state=active]:shadow-lg data-[state=inactive]:opacity-70"
                  style={{ color: theme.text }}
                >
                  <Gift className="w-4 h-4 mr-2" />
                  Aktif ({activeEvents.length})
                </TabsTrigger>
                <TabsTrigger
                  value="past"
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all data-[state=active]:shadow-lg data-[state=inactive]:opacity-70"
                  style={{ color: theme.text }}
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Geçmiş ({pastEvents.length})
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Active Tab Content */}
            <TabsContent value="active" className="mt-0">
              {activeEvents.length === 0 ? (
                <div
                  className="flex flex-col items-center justify-center py-16 rounded-2xl"
                  style={{
                    background: theme.card,
                    border: `1px solid ${theme.border}`
                  }}
                >
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                    style={{
                      background: `${theme.primary}15`,
                      border: `1px solid ${theme.primary}20`
                    }}
                  >
                    <Gift className="w-8 h-8" style={{ color: `${theme.primary}60` }} />
                  </div>
                  <h3 className="text-sm font-semibold mb-1" style={{ color: theme.textSecondary }}>Aktif Etkinlik Yok</h3>
                  <p className="text-xs" style={{ color: theme.textMuted }}>Yeni bir etkinlik oluşturmak için yukarıdaki butonu kullanın</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeEvents.map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Past Tab Content */}
            <TabsContent value="past" className="mt-0">
              {pastEvents.length === 0 ? (
                <div
                  className="flex flex-col items-center justify-center py-16 rounded-2xl"
                  style={{
                    background: theme.card,
                    border: `1px solid ${theme.border}`
                  }}
                >
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                    style={{
                      background: `${theme.primary}15`,
                      border: `1px solid ${theme.primary}20`
                    }}
                  >
                    <Calendar className="w-8 h-8" style={{ color: `${theme.primary}60` }} />
                  </div>
                  <h3 className="text-sm font-semibold mb-1" style={{ color: theme.textSecondary }}>Geçmiş Etkinlik Yok</h3>
                  <p className="text-xs" style={{ color: theme.textMuted }}>Tamamlanan etkinlikler burada görünecek</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pastEvents.map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  )
}
