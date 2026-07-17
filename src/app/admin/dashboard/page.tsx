'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { StatCard, MiniStatCard, SectionCard } from '@/components/admin/StatCards'
import {
  Users,
  MessageSquare,
  ShoppingCart,
  Ticket,
  UserCheck,
  TrendingUp,
  Activity,
  Coins,
  MousePointer,
  Eye,
  Calendar,
  Gift,
  Star,
  Award,
  Send,
  Hash,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Mail,
  Shield,
  Layers,
  Target,
  Zap,
  Trophy,
  Radio,
  Megaphone,
  UserPlus,
  Store,
  RefreshCw,
  Bell,
  ChevronRight,
  AlertTriangle,
  Spade,
  Copy,
  Link2,
  Wifi,
  ChevronDown
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'

interface Stats {
  users: {
    total: number
    siteUsers: number
    telegramOnly: number
    linked: number
    banned: number
    hadStart: number
    emailVerified: number
    withWallet: number
    newToday: number
    newWeek: number
    newMonth: number
    recent: Array<{
      id: string
      siteUsername: string | null
      telegramUsername: string | null
      createdAt: string
    }>
  }
  points: {
    total: number
    totalXp: number
  }
  purchases: {
    total: number
    pending: number
    completed: number
    today: number
    week: number
    month: number
    recent: Array<{
      id: string
      pointsSpent: number
      status: string
      purchasedAt: string
      user: { siteUsername: string | null; telegramUsername: string | null }
      item: { name: string }
    }>
  }
  wheel: {
    totalSpins: number
    today: number
    week: number
    month: number
    prizes: Array<{
      id: string
      name: string
      points: number
      color: string
    }>
    topPrizes: Array<{
      prizeId: string
      _count: { prizeId: number }
    }>
  }
  sponsors: {
    total: number
    active: number
    totalClicks: number
    topSponsors: Array<{
      id: string
      name: string
      clicks: number
      category: string
    }>
  }
  siteVisits: {
    total: number
    daily: number
    weekly: number
    monthly: number
  }
  messages: {
    total: number
    daily: number
    weekly: number
    monthly: number
  }
  tasks: {
    total: number
    active: number
    completions: number
    completionsToday: number
  }
  shop: {
    total: number
    active: number
  }
  tickets: {
    totalEvents: number
    activeEvents: number
    totalRequests: number
    pendingRequests: number
    approvedRequests: number
  }
  events: {
    total: number
    active: number
    participants: number
    winners: number
  }
  randy: {
    total: number
    active: number
    participants: number
  }
  promocodes: {
    total: number
    active: number
    usages: number
    usagesToday: number
  }
  broadcasts: {
    total: number
    completed: number
    messagesSent: number
  }
  system: {
    ranks: number
    admins: number
  }
  multi: {
    duplicateIPs: number
    usersWithMulti: number
  }
}

// Requests Alert Card Component
function RequestsAlertCard({
  pendingOrders,
  pendingTicketRequests,
  onOrdersClick,
  onTicketsClick
}: {
  pendingOrders: number
  pendingTicketRequests: number
  onOrdersClick: () => void
  onTicketsClick: () => void
}) {
  const totalRequests = pendingOrders + pendingTicketRequests

  if (totalRequests === 0) return null

  return (
    <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl p-4 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-amber-500/20 rounded-lg">
          <Bell className="w-5 h-5 text-amber-400 animate-pulse" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Bekleyen Talepler</h2>
          <p className="text-sm text-amber-200/70">Toplam {totalRequests} adet işlem bekliyor</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Market Siparişleri */}
        {pendingOrders > 0 && (
          <button
            onClick={onOrdersClick}
            className="flex items-center justify-between p-4 bg-slate-800/50 hover:bg-slate-800/80 border border-slate-700/50 hover:border-amber-500/50 rounded-xl transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <ShoppingCart className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-white">Market Siparişleri</p>
                <p className="text-xs text-slate-400">{pendingOrders} adet onay bekliyor</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 bg-amber-500/20 text-amber-400 text-xs font-bold rounded-full">
                {pendingOrders}
              </span>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-white group-hover:translate-x-1 transition-all" />
            </div>
          </button>
        )}

        {/* Bilet Talepleri */}
        {pendingTicketRequests > 0 && (
          <button
            onClick={onTicketsClick}
            className="flex items-center justify-between p-4 bg-slate-800/50 hover:bg-slate-800/80 border border-slate-700/50 hover:border-rose-500/50 rounded-xl transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-500/20 rounded-lg">
                <Ticket className="w-5 h-5 text-rose-400" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-white">Bilet Talepleri</p>
                <p className="text-xs text-slate-400">{pendingTicketRequests} adet onay bekliyor</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 bg-rose-500/20 text-rose-400 text-xs font-bold rounded-full">
                {pendingTicketRequests}
              </span>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-white group-hover:translate-x-1 transition-all" />
            </div>
          </button>
        )}
      </div>
    </div>
  )
}

function ProgressBar({ value, max, color = 'emerald' }: { value: number; max: number; color?: string }) {
  const percentage = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
      <div
        className={`h-full bg-${color}-500 transition-all duration-500`}
        style={{ width: `${Math.min(percentage, 100)}%` }}
      />
    </div>
  )
}

export default function AdminDashboard() {
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const token = localStorage.getItem('admin_token')
      const statsResponse = await fetch('/api/admin/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const statsData = await statsResponse.json()
      setStats(statsData)
      setLastUpdate(new Date())
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Navigation handlers
  const handleOrdersClick = () => {
    router.push('/admin/shop?tab=orders')
  }

  const handleTicketsClick = () => {
    router.push('/admin/tickets?tab=requests')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-slate-600 border-t-emerald-500 rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Dashboard yükleniyor...</p>
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-rose-400 mx-auto mb-4" />
          <p className="text-slate-400">İstatistikler yüklenemedi</p>
          <button
            onClick={loadData}
            className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm transition-colors"
          >
            Tekrar Dene
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-page-container">
      <div className="admin-page-inner space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-7 h-7 text-emerald-400" />
              Dashboard
            </h1>
            <p className="text-slate-400 text-sm mt-1">Sistem istatistiklerine genel bakış</p>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdate && (
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Son güncelleme: {lastUpdate.toLocaleTimeString('tr-TR')}
              </span>
            )}
            <button
              onClick={() => { setLoading(true); loadData(); }}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Bekleyen Talepler Alert */}
        <RequestsAlertCard
          pendingOrders={stats.purchases.pending}
          pendingTicketRequests={stats.tickets.pendingRequests}
          onOrdersClick={handleOrdersClick}
          onTicketsClick={handleTicketsClick}
        />

        {/* Ana İstatistikler */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={Users}
            label="Toplam Kullanıcı"
            value={stats.users.total}
            subValue={`+${stats.users.newToday} bugün`}
            color="blue"
            trend="up"
            trendValue={`+${stats.users.newWeek} hafta`}
          />
          <StatCard
            icon={Coins}
            label="Toplam Puan"
            value={stats.points.total}
            subValue={`${stats.points.totalXp.toLocaleString('tr-TR')} XP`}
            color="amber"
          />
          <StatCard
            icon={ShoppingCart}
            label="Toplam Satın Alma"
            value={stats.purchases.total}
            subValue={`${stats.purchases.pending} beklemede`}
            color="emerald"
          />
          <StatCard
            icon={MousePointer}
            label="Sponsor Tıklamaları"
            value={stats.sponsors.totalClicks}
            subValue={`${stats.sponsors.active} aktif sponsor`}
            color="purple"
          />
        </div>

        {/* İkinci Sıra İstatistikler */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={MessageSquare}
            label="Toplam Mesaj"
            value={stats.messages.total}
            subValue={`+${stats.messages.daily} bugün`}
            color="cyan"
          />
          <StatCard
            icon={Gift}
            label="Çark Çevirme"
            value={stats.wheel.totalSpins}
            subValue={`+${stats.wheel.today} bugün`}
            color="orange"
          />
          <StatCard
            icon={Eye}
            label="Site Ziyareti"
            value={stats.siteVisits.total}
            subValue={`+${stats.siteVisits.daily} bugün`}
            color="slate"
          />
          <StatCard
            icon={UserCheck}
            label="HAD Sahibi"
            value={stats.users.hadStart}
            subValue={`${stats.users.linked} bağlı hesap`}
            color="rose"
          />
        </div>


        {/* Kullanıcı ve Mesaj Detayları */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Kullanıcı Dağılımı */}
          <SectionCard title="Kullanıcı Dağılımı" icon={Users} color="blue">
            <div className="grid grid-cols-2 gap-3">
              <MiniStatCard icon={Users} label="Site Kayıtlı" value={stats.users.siteUsers} color="blue" />
              <MiniStatCard icon={Send} label="Sadece Telegram" value={stats.users.telegramOnly} color="cyan" />
              <MiniStatCard icon={UserCheck} label="Bağlı Hesaplar" value={stats.users.linked} color="emerald" />
              <MiniStatCard icon={XCircle} label="Banlı" value={stats.users.banned} color="rose" />
              <MiniStatCard icon={Mail} label="Email Doğrulanmış" value={stats.users.emailVerified} color="amber" />
              <MiniStatCard icon={Wallet} label="Cüzdan Kayıtlı" value={stats.users.withWallet} color="purple" />
            </div>
            <div className="mt-4 pt-4 border-t border-slate-800/50">
              <h4 className="text-xs text-slate-500 mb-2">Yeni Kayıtlar</h4>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-2 bg-slate-800/30 rounded-lg">
                  <p className="text-lg font-bold text-emerald-400">{stats.users.newToday}</p>
                  <p className="text-xs text-slate-500">Bugün</p>
                </div>
                <div className="text-center p-2 bg-slate-800/30 rounded-lg">
                  <p className="text-lg font-bold text-blue-400">{stats.users.newWeek}</p>
                  <p className="text-xs text-slate-500">Bu Hafta</p>
                </div>
                <div className="text-center p-2 bg-slate-800/30 rounded-lg">
                  <p className="text-lg font-bold text-purple-400">{stats.users.newMonth}</p>
                  <p className="text-xs text-slate-500">Bu Ay</p>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Mesaj İstatistikleri */}
          <SectionCard title="Mesaj İstatistikleri" icon={MessageSquare} color="cyan">
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-slate-400">Günlük Mesaj</span>
                  <span className="text-sm font-semibold text-white">{stats.messages.daily.toLocaleString('tr-TR')}</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500" style={{ width: '75%' }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-slate-400">Haftalık Mesaj</span>
                  <span className="text-sm font-semibold text-white">{stats.messages.weekly.toLocaleString('tr-TR')}</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500" style={{ width: '60%' }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-slate-400">Aylık Mesaj</span>
                  <span className="text-sm font-semibold text-white">{stats.messages.monthly.toLocaleString('tr-TR')}</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-purple-500 to-rose-500" style={{ width: '45%' }} />
                </div>
              </div>
              <div className="pt-2 border-t border-slate-800/50">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-400">Toplam Mesaj</span>
                  <span className="text-lg font-bold text-white">{stats.messages.total.toLocaleString('tr-TR')}</span>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Sponsor ve Ziyaret İstatistikleri */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* En Çok Tıklanan Sponsorlar */}
          <SectionCard title="En Çok Tıklanan Sponsorlar" icon={MousePointer} color="purple">
            <div className="space-y-3">
              {stats.sponsors.topSponsors.length > 0 ? (
                stats.sponsors.topSponsors.slice(0, 5).map((sponsor, index) => (
                  <div key={sponsor.id} className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      index === 0 ? 'bg-amber-500/20 text-amber-400' :
                      index === 1 ? 'bg-slate-400/20 text-slate-300' :
                      index === 2 ? 'bg-orange-500/20 text-orange-400' :
                      'bg-slate-700/50 text-slate-500'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-white truncate">{sponsor.name}</p>
                        {sponsor.category === 'vip' && (
                          <span className="px-1.5 py-0.5 text-[10px] bg-amber-500/20 text-amber-400 rounded">VIP</span>
                        )}
                      </div>
                      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
                        <div
                          className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                          style={{ width: `${Math.min((sponsor.clicks / (stats.sponsors.topSponsors[0]?.clicks || 1)) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-purple-400">{sponsor.clicks.toLocaleString('tr-TR')}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500 text-center py-4">Henüz sponsor tıklaması yok</p>
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-800/50 grid grid-cols-3 gap-2">
              <div className="text-center">
                <p className="text-lg font-bold text-purple-400">{stats.sponsors.total}</p>
                <p className="text-xs text-slate-500">Toplam</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-emerald-400">{stats.sponsors.active}</p>
                <p className="text-xs text-slate-500">Aktif</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-amber-400">{stats.sponsors.totalClicks.toLocaleString('tr-TR')}</p>
                <p className="text-xs text-slate-500">Tıklama</p>
              </div>
            </div>
          </SectionCard>

          {/* Site Ziyaretleri */}
          <SectionCard title="Site Ziyaretleri" icon={Eye} color="slate">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-800/30 rounded-xl text-center">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                </div>
                <p className="text-2xl font-bold text-white">{stats.siteVisits.daily.toLocaleString('tr-TR')}</p>
                <p className="text-xs text-slate-500">Bugün</p>
              </div>
              <div className="p-4 bg-slate-800/30 rounded-xl text-center">
                <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Calendar className="w-5 h-5 text-blue-400" />
                </div>
                <p className="text-2xl font-bold text-white">{stats.siteVisits.weekly.toLocaleString('tr-TR')}</p>
                <p className="text-xs text-slate-500">Bu Hafta</p>
              </div>
              <div className="p-4 bg-slate-800/30 rounded-xl text-center">
                <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                  <BarChart3 className="w-5 h-5 text-purple-400" />
                </div>
                <p className="text-2xl font-bold text-white">{stats.siteVisits.monthly.toLocaleString('tr-TR')}</p>
                <p className="text-xs text-slate-500">Bu Ay</p>
              </div>
              <div className="p-4 bg-slate-800/30 rounded-xl text-center">
                <div className="w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Activity className="w-5 h-5 text-amber-400" />
                </div>
                <p className="text-2xl font-bold text-white">{stats.siteVisits.total.toLocaleString('tr-TR')}</p>
                <p className="text-xs text-slate-500">Toplam</p>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Satın Alma ve Çark */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Satın Alma İstatistikleri */}
          <SectionCard title="Satın Alma İstatistikleri" icon={ShoppingCart} color="emerald">
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="text-center p-3 bg-amber-500/10 border border-amber-700/30 rounded-lg">
                <Clock className="w-5 h-5 text-amber-400 mx-auto mb-1" />
                <p className="text-lg font-bold text-white">{stats.purchases.pending}</p>
                <p className="text-xs text-slate-500">Beklemede</p>
              </div>
              <div className="text-center p-3 bg-emerald-500/10 border border-emerald-700/30 rounded-lg">
                <CheckCircle className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                <p className="text-lg font-bold text-white">{stats.purchases.completed}</p>
                <p className="text-xs text-slate-500">Tamamlanan</p>
              </div>
              <div className="text-center p-3 bg-blue-500/10 border border-blue-700/30 rounded-lg">
                <ShoppingCart className="w-5 h-5 text-blue-400 mx-auto mb-1" />
                <p className="text-lg font-bold text-white">{stats.purchases.total}</p>
                <p className="text-xs text-slate-500">Toplam</p>
              </div>
            </div>
            <div className="space-y-2 pt-3 border-t border-slate-800/50">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Bugün</span>
                <span className="text-white font-medium">{stats.purchases.today}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Bu Hafta</span>
                <span className="text-white font-medium">{stats.purchases.week}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Bu Ay</span>
                <span className="text-white font-medium">{stats.purchases.month}</span>
              </div>
            </div>
          </SectionCard>

          {/* Çark İstatistikleri */}
          <SectionCard title="Çark İstatistikleri" icon={Gift} color="orange">
            <div className="grid grid-cols-4 gap-2 mb-4">
              <div className="text-center p-2 bg-slate-800/30 rounded-lg">
                <p className="text-lg font-bold text-emerald-400">{stats.wheel.today}</p>
                <p className="text-xs text-slate-500">Bugün</p>
              </div>
              <div className="text-center p-2 bg-slate-800/30 rounded-lg">
                <p className="text-lg font-bold text-blue-400">{stats.wheel.week}</p>
                <p className="text-xs text-slate-500">Hafta</p>
              </div>
              <div className="text-center p-2 bg-slate-800/30 rounded-lg">
                <p className="text-lg font-bold text-purple-400">{stats.wheel.month}</p>
                <p className="text-xs text-slate-500">Ay</p>
              </div>
              <div className="text-center p-2 bg-slate-800/30 rounded-lg">
                <p className="text-lg font-bold text-amber-400">{stats.wheel.totalSpins}</p>
                <p className="text-xs text-slate-500">Toplam</p>
              </div>
            </div>
            {stats.wheel.prizes.length > 0 && (
              <div className="pt-3 border-t border-slate-800/50">
                <p className="text-xs text-slate-500 mb-2">Aktif Ödüller</p>
                <div className="flex flex-wrap gap-2">
                  {stats.wheel.prizes.slice(0, 6).map(prize => (
                    <div
                      key={prize.id}
                      className="px-2 py-1 rounded text-xs font-medium"
                      style={{ backgroundColor: `${prize.color}20`, color: prize.color }}
                    >
                      {prize.name} ({prize.points}P)
                    </div>
                  ))}
                </div>
              </div>
            )}
          </SectionCard>
        </div>

        {/* Etkinlikler, Biletler, Randy */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Etkinlik İstatistikleri */}
          <SectionCard title="Etkinlikler" icon={Calendar} color="blue">
            <div className="space-y-3">
              <MiniStatCard icon={Calendar} label="Toplam Etkinlik" value={stats.events.total} color="blue" />
              <MiniStatCard icon={Activity} label="Aktif Etkinlik" value={stats.events.active} color="emerald" />
              <MiniStatCard icon={Users} label="Katılımcılar" value={stats.events.participants} color="cyan" />
              <MiniStatCard icon={Trophy} label="Kazananlar" value={stats.events.winners} color="amber" />
            </div>
          </SectionCard>

          {/* Bilet İstatistikleri */}
          <SectionCard title="Biletler" icon={Ticket} color="rose">
            <div className="space-y-3">
              <MiniStatCard icon={Ticket} label="Toplam Etkinlik" value={stats.tickets.totalEvents} color="rose" />
              <MiniStatCard icon={Activity} label="Aktif Etkinlik" value={stats.tickets.activeEvents} color="emerald" />
              <MiniStatCard icon={Clock} label="Bekleyen Talep" value={stats.tickets.pendingRequests} color="amber" />
              <MiniStatCard icon={CheckCircle} label="Onaylanan" value={stats.tickets.approvedRequests} color="emerald" />
            </div>
          </SectionCard>

          {/* Randy İstatistikleri */}
          <SectionCard title="Randy Çekilişler" icon={Radio} color="purple">
            <div className="space-y-3">
              <MiniStatCard icon={Radio} label="Toplam Randy" value={stats.randy.total} color="purple" />
              <MiniStatCard icon={Zap} label="Aktif Randy" value={stats.randy.active} color="emerald" />
              <MiniStatCard icon={Users} label="Toplam Katılım" value={stats.randy.participants} color="cyan" />
            </div>
          </SectionCard>
        </div>

        {/* Görevler, Promocodlar, Yayınlar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Görev İstatistikleri */}
          <SectionCard title="Görevler" icon={Target} color="cyan">
            <div className="space-y-3">
              <MiniStatCard icon={Target} label="Toplam Görev" value={stats.tasks.total} color="cyan" />
              <MiniStatCard icon={Activity} label="Aktif Görev" value={stats.tasks.active} color="emerald" />
              <MiniStatCard icon={CheckCircle} label="Tamamlanan" value={stats.tasks.completions} color="amber" />
              <MiniStatCard icon={TrendingUp} label="Bugün Tamamlanan" value={stats.tasks.completionsToday} color="purple" />
            </div>
          </SectionCard>

          {/* Promocode İstatistikleri */}
          <SectionCard title="Promosyon Kodları" icon={Hash} color="amber">
            <div className="space-y-3">
              <MiniStatCard icon={Hash} label="Toplam Kod" value={stats.promocodes.total} color="amber" />
              <MiniStatCard icon={Activity} label="Aktif Kod" value={stats.promocodes.active} color="emerald" />
              <MiniStatCard icon={CheckCircle} label="Kullanım" value={stats.promocodes.usages} color="blue" />
              <MiniStatCard icon={TrendingUp} label="Bugün Kullanım" value={stats.promocodes.usagesToday} color="purple" />
            </div>
          </SectionCard>

          {/* Yayın İstatistikleri */}
          <SectionCard title="Toplu Mesajlar" icon={Megaphone} color="orange">
            <div className="space-y-3">
              <MiniStatCard icon={Megaphone} label="Toplam Yayın" value={stats.broadcasts.total} color="orange" />
              <MiniStatCard icon={CheckCircle} label="Tamamlanan" value={stats.broadcasts.completed} color="emerald" />
              <MiniStatCard icon={Send} label="Gönderilen Mesaj" value={stats.broadcasts.messagesSent} color="blue" />
            </div>
          </SectionCard>
        </div>

        {/* Mağaza ve Sistem */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Mağaza İstatistikleri */}
          <SectionCard title="Mağaza" icon={Store} color="emerald">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-slate-800/30 rounded-xl text-center">
                <Store className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-white">{stats.shop.total}</p>
                <p className="text-xs text-slate-500">Toplam Ürün</p>
              </div>
              <div className="p-4 bg-slate-800/30 rounded-xl text-center">
                <Activity className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-white">{stats.shop.active}</p>
                <p className="text-xs text-slate-500">Aktif Ürün</p>
              </div>
            </div>
          </SectionCard>

          {/* Sistem İstatistikleri */}
          <SectionCard title="Sistem" icon={Shield} color="slate">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-slate-800/30 rounded-xl text-center">
                <Award className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-white">{stats.system.ranks}</p>
                <p className="text-xs text-slate-500">Rütbe Sayısı</p>
              </div>
              <div className="p-4 bg-slate-800/30 rounded-xl text-center">
                <Shield className="w-8 h-8 text-rose-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-white">{stats.system.admins}</p>
                <p className="text-xs text-slate-500">Admin Sayısı</p>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Son Kayıtlar */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Son Kayıt Olan Kullanıcılar */}
          <SectionCard title="Son Kayıt Olan Kullanıcılar" icon={UserPlus} color="blue">
            <div className="space-y-2">
              {stats.users.recent.length > 0 ? (
                stats.users.recent.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-2 bg-slate-800/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                        <Users className="w-4 h-4 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">
                          {user.siteUsername || user.telegramUsername || 'Anonim'}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-slate-500">
                      {new Date(user.createdAt).toLocaleDateString('tr-TR')}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500 text-center py-4">Henüz kullanıcı yok</p>
              )}
            </div>
          </SectionCard>

          {/* Son Satın Almalar */}
          <SectionCard title="Son Satın Almalar" icon={ShoppingCart} color="emerald">
            <div className="space-y-2">
              {stats.purchases.recent.length > 0 ? (
                stats.purchases.recent.map((purchase) => (
                  <div key={purchase.id} className="flex items-center justify-between p-2 bg-slate-800/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        purchase.status === 'completed' ? 'bg-emerald-500/20' :
                        purchase.status === 'pending' ? 'bg-amber-500/20' : 'bg-slate-500/20'
                      }`}>
                        {purchase.status === 'completed' ? (
                          <CheckCircle className="w-4 h-4 text-emerald-400" />
                        ) : purchase.status === 'pending' ? (
                          <Clock className="w-4 h-4 text-amber-400" />
                        ) : (
                          <ShoppingCart className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{purchase.item.name}</p>
                        <p className="text-xs text-slate-500">
                          {purchase.user.siteUsername || purchase.user.telegramUsername || 'Anonim'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-amber-400">{purchase.pointsSpent.toLocaleString('tr-TR')}P</p>
                      <p className="text-xs text-slate-500">
                        {new Date(purchase.purchasedAt).toLocaleDateString('tr-TR')}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500 text-center py-4">Henüz satın alma yok</p>
              )}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
