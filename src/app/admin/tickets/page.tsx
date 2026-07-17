'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TicketCreateForm } from '@/components/tickets/admin/TicketCreateForm'
import { TicketEventCard } from '@/components/tickets/admin/TicketEventCard'
import { TicketHistoryCard } from '@/components/tickets/admin/TicketHistoryCard'
import { TicketCheck, Plus, Gift, History, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

// Sabit mavi tema renkleri (Events sayfasıyla aynı)
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

interface Sponsor {
  id: string
  name: string
  category: string
}

interface Prize {
  id?: string
  prizeAmount: number
  winnerCount: number
}

interface TicketEvent {
  id: string
  title: string
  description: string
  sponsor: Sponsor
  totalTickets: number | null
  ticketPrice: number
  soldTickets: number
  endDate: string | null
  status: string
  createdAt: string
  prizes: Prize[]
}

export default function AdminTicketsPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('active')
  const [loading, setLoading] = useState(true)

  const [sponsors, setSponsors] = useState<Sponsor[]>([])
  const [events, setEvents] = useState<TicketEvent[]>([])
  const [historyEvents, setHistoryEvents] = useState<TicketEvent[]>([])

  const [showCreateForm, setShowCreateForm] = useState(false)

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

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (!token) {
      router.push('/admin')
      return
    }
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  async function loadData() {
    try {
      setLoading(true)
      const token = localStorage.getItem('admin_token')

      const sponsorsRes = await fetch('/api/admin/sponsors', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const sponsorsData = await sponsorsRes.json()
      setSponsors(sponsorsData.sponsors || [])

      if (activeTab === 'active') {
        const eventsRes = await fetch('/api/admin/tickets?status=active', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        const eventsData = await eventsRes.json()

        const waitingRes = await fetch('/api/admin/tickets?status=waiting_draw', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        const waitingData = await waitingRes.json()

        setEvents([...(eventsData.events || []), ...(waitingData.events || [])])
      } else if (activeTab === 'history') {
        const historyRes = await fetch('/api/admin/tickets?status=completed', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        const historyData = await historyRes.json()
        setHistoryEvents(historyData.events || [])
      }
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Veri yüklenirken hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateSuccess() {
    setShowCreateForm(false)
    loadData()
  }

  const activeEvents = events.filter(e => e.status === 'active' || e.status === 'waiting_draw')

  return (
    <div className="min-h-screen" style={{ background: theme.background }}>
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold mb-1" style={{ color: theme.text }}>Bilet Yönetimi</h1>
            <p className="text-sm" style={{ color: theme.textMuted }}>Bilet etkinliklerini ve katılımcıları yönet</p>
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="font-semibold rounded-xl px-5 h-10 text-sm flex items-center justify-center gap-2 w-full md:w-auto transition-colors duration-200"
            style={{
              background: showCreateForm
                ? '#dc2626'
                : `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})`,
              color: 'white',
              boxShadow: showCreateForm ? 'none' : `0 4px 16px ${theme.gradientFrom}40`
            }}
            onMouseEnter={(e) => {
              if (!showCreateForm) {
                e.currentTarget.style.background = `linear-gradient(135deg, ${theme.primaryDark}, #1e40af)`
              } else {
                e.currentTarget.style.background = '#b91c1c'
              }
            }}
            onMouseLeave={(e) => {
              if (!showCreateForm) {
                e.currentTarget.style.background = `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})`
              } else {
                e.currentTarget.style.background = '#dc2626'
              }
            }}
          >
            <Plus className={`w-4 h-4 ${showCreateForm ? 'rotate-45' : ''}`} style={{ transition: 'transform 0.2s' }} />
            {showCreateForm ? 'Kapat' : 'Yeni Etkinlik'}
          </button>
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <div
            className="mb-6 rounded-2xl overflow-hidden"
            style={{
              background: theme.card,
              border: `1px solid ${theme.border}`,
            }}
          >
            <TicketCreateForm
              sponsors={sponsors}
              onSuccess={handleCreateSuccess}
              onCancel={() => setShowCreateForm(false)}
            />
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin mb-3" style={{ color: theme.primary }} />
            <p className="text-sm" style={{ color: theme.textMuted }}>Yükleniyor...</p>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
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
                  value="history"
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all data-[state=active]:shadow-lg data-[state=inactive]:opacity-70"
                  style={{ color: theme.text }}
                >
                  <History className="w-4 h-4 mr-2" />
                  Geçmiş ({historyEvents.length})
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Active Tab */}
            <TabsContent value="active" className="mt-0">
              {events.length === 0 ? (
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
                    <TicketCheck className="w-8 h-8" style={{ color: `${theme.primary}60` }} />
                  </div>
                  <h3 className="text-sm font-semibold mb-1" style={{ color: theme.textSecondary }}>Aktif Etkinlik Yok</h3>
                  <p className="text-xs" style={{ color: theme.textMuted }}>Yeni bir bilet etkinliği oluşturun</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {events.map(event => (
                    <TicketEventCard
                      key={event.id}
                      event={event}
                      onViewDetails={(id) => router.push(`/admin/tickets/${id}`)}
                      formatAmount={formatAmount}
                      formatDateTR={formatDateTR}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="mt-0">
              {historyEvents.length === 0 ? (
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
                    <History className="w-8 h-8" style={{ color: `${theme.primary}60` }} />
                  </div>
                  <h3 className="text-sm font-semibold mb-1" style={{ color: theme.textSecondary }}>Geçmiş Etkinlik Yok</h3>
                  <p className="text-xs" style={{ color: theme.textMuted }}>Tamamlanan etkinlikler burada görünecek</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {historyEvents.map(event => (
                    <TicketHistoryCard
                      key={event.id}
                      event={event}
                      onCopyWinners={() => {}}
                      onViewDetails={(id) => router.push(`/admin/tickets/${id}`)}
                      formatAmount={formatAmount}
                      formatDateTR={formatDateTR}
                    />
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
