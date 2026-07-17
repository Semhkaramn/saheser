'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StatCard, MiniStatCard, SectionCard } from '@/components/admin/StatCards'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  User,
  Edit,
  Ban,
  ShieldCheck,
  MessageSquare,
  Coins,
  Award,
  ShoppingCart,
  Calendar,
  Clock,
  TrendingUp,
  Gift,
  Target,
  Trophy,
  Mail,
  Wallet,
  CheckCircle,
  XCircle,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  ChevronRight,
  Ticket,
  Sparkles,
  Store,
  Send,
  Copy,
  ArrowUpRight,
  ArrowDownRight,
  Users,
  Wifi,
  History,
  Star,
  Crown,
  Unlink
} from 'lucide-react'
import { toast } from 'sonner'

interface PointHistory {
  id: string
  amount: number
  type: string
  description: string
  adminUsername?: string
  createdAt: string
}

interface ActivityStats {
  totalPurchases: number
  pendingPurchases: number
  completedPurchases: number
  totalEventParticipations: number
  totalEventWins: number
  prizeAddedWins: number
  totalWheelSpins: number
  totalTasksCompleted: number
  totalSponsorsRegistered: number
  totalTicketRequests: number
  approvedTicketRequests: number
  totalPromocodesUsed: number
}

interface MultiAccountMatch {
  type: 'ip'
  value: string
  users: Array<{
    id: string
    siteUsername: string | null
    telegramId: string | null
    telegramUsername: string | null
    firstName: string | null
    points: number
    createdAt: Date
  }>
}

interface UserDetail {
  user: any
  telegramUser?: any
  wheelSpins: any[]
  pointHistory: PointHistory[]
  xpHistory: any[]
  purchases: any[]
  taskHistory: any[]
  eventParticipations: any[]
  eventWins: any[]
  sponsorInfo: any
  ticketRequests: any[]
  ticketNumbers: any[]
  promocodeUsages: any[]
  activityStats: ActivityStats
  messageStats: {
    daily: number
    weekly: number
    monthly: number
    total: number
    recent: any[]
  }
  telegramMessageStats?: {
    daily: number
    weekly: number
    monthly: number
    total: number
    recent: any[]
  }
  multiAccountMatches?: MultiAccountMatch[]
}

// Point History Icon helper
function getPointHistoryIcon(type: string) {
  switch(type) {
    case 'wheel_win':
      return { Icon: Star, color: 'text-orange-400', bg: 'bg-orange-500/20' }
    case 'shop_purchase':
    case 'purchase':
      return { Icon: ShoppingCart, color: 'text-rose-400', bg: 'bg-rose-500/20' }
    case 'task_reward':
    case 'task_complete':
      return { Icon: Target, color: 'text-cyan-400', bg: 'bg-cyan-500/20' }
    case 'referral_reward':
      return { Icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/20' }
    case 'randy_win':
      return { Icon: Crown, color: 'text-amber-400', bg: 'bg-amber-500/20' }
    case 'rank_up':
      return { Icon: Trophy, color: 'text-purple-400', bg: 'bg-purple-500/20' }
    case 'promocode_use':
      return { Icon: Gift, color: 'text-emerald-400', bg: 'bg-emerald-500/20' }
    case 'admin_add':
    case 'admin_points_add':
      return { Icon: ShieldCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/20' }
    case 'admin_remove':
    case 'admin_points_remove':
      return { Icon: ShieldCheck, color: 'text-rose-400', bg: 'bg-rose-500/20' }
    case 'event_win':
      return { Icon: Trophy, color: 'text-amber-400', bg: 'bg-amber-500/20' }
    default:
      return { Icon: History, color: 'text-slate-400', bg: 'bg-slate-500/20' }
  }
}

export default function UserDetailPage() {
  const router = useRouter()
  const params = useParams()
  const userId = params.id as string

  const [loading, setLoading] = useState(true)
  const [userDetail, setUserDetail] = useState<UserDetail | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [banDialogOpen, setBanDialogOpen] = useState(false)
  const [banReason, setBanReason] = useState('')
  const [formData, setFormData] = useState({
    points: 0,
    xp: 0,
    dailySpinsLeft: 1
  })
  const [activeTab, setActiveTab] = useState('history')
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (!token) {
      router.push('/admin')
      return
    }
    loadUserDetail()
    // eslint-disable-next-line
  }, [userId])

  async function loadUserDetail() {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/statistics/user/${userId}`)
      const data = await response.json()

      if (data.error) {
        toast.error(data.error)
        router.push('/admin/users')
        return
      }

      setUserDetail(data)
      setFormData({
        points: data.user?.points || 0,
        xp: data.user?.xp || 0,
        dailySpinsLeft: data.user?.dailySpinsLeft || 0
      })
      setLastUpdate(new Date())
    } catch (error) {
      console.error('Error loading user detail:', error)
      toast.error('Kullanıcı detayları yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  async function handleBanToggle() {
    const user = userDetail?.user
    if (!user) return

    const action = user.isBanned ? 'unban' : 'ban'

    if (!user.isBanned && !banReason) {
      toast.error('Ban nedeni gerekli')
      return
    }

    try {
      const response = await fetch(`/api/admin/users/${userId}/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          reason: banReason,
          adminUsername: 'Admin'
        })
      })

      const data = await response.json()

      if (data.success) {
        toast.success(data.message)
        setBanDialogOpen(false)
        setBanReason('')
        loadUserDetail()
      } else {
        toast.error(data.error || 'İşlem başarısız')
      }
    } catch (error) {
      console.error('Ban toggle error:', error)
      toast.error('Bir hata oluştu')
    }
  }

  async function handleUpdateUser(e: React.FormEvent) {
    e.preventDefault()

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (data.user) {
        toast.success('Kullanıcı güncellendi')
        setEditDialogOpen(false)
        loadUserDetail()
      } else {
        toast.error(data.error || 'Güncelleme başarısız')
      }
    } catch (error) {
      console.error('Update error:', error)
      toast.error('Bir hata oluştu')
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    toast.success('Kopyalandı!')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-slate-600 border-t-emerald-500 rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Kullanıcı bilgileri yükleniyor...</p>
        </div>
      </div>
    )
  }

  if (!userDetail) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-rose-400 mx-auto mb-4" />
          <p className="text-slate-400">Kullanıcı bulunamadı</p>
          <button
            onClick={() => router.push('/admin/users')}
            className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm transition-colors"
          >
            Geri Dön
          </button>
        </div>
      </div>
    )
  }

  const user = userDetail.user
  const telegramUser = userDetail.telegramUser
  const stats = userDetail.activityStats

  return (
    <div className="admin-page-container">
      <div className="admin-page-inner space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/admin/users')}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <User className="w-6 h-6 text-blue-400" />
                Kullanıcı Detayları
              </h1>
              <p className="text-slate-400 text-sm mt-0.5">Profil ve aktivite geçmişi</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdate && (
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {lastUpdate.toLocaleTimeString('tr-TR')}
              </span>
            )}
            <button
              onClick={() => loadUserDetail()}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            {user.isRegistered !== false && (
              <Button
                onClick={() => setEditDialogOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Edit className="w-4 h-4 mr-2" />
                Düzenle
              </Button>
            )}
            <Button
              onClick={() => user.isBanned ? handleBanToggle() : setBanDialogOpen(true)}
              className={user.isBanned ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}
            >
              {user.isBanned ? (
                <><ShieldCheck className="w-4 h-4 mr-2" /> Ban Kaldır</>
              ) : (
                <><Ban className="w-4 h-4 mr-2" /> Banla</>
              )}
            </Button>
          </div>
        </div>

        {/* User Profile Card */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 border border-slate-800/50 rounded-2xl overflow-hidden">
          <div className="p-6">
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Avatar & Basic Info */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                <div className="relative">
                  <Avatar className="w-24 h-24 border-4 border-slate-700/50">
                    {user.avatar ? (
                      <AvatarImage src={user.avatar} alt="Avatar" />
                    ) : (
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-3xl font-bold">
                        {(user.siteUsername || user.firstName || user.username || 'U').charAt(0).toUpperCase()}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  {user.isBanned && (
                    <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-rose-500 rounded-full flex items-center justify-center border-4 border-slate-900">
                      <Ban className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
                <div className="text-center sm:text-left">
                  <h2 className="text-2xl font-bold text-white">
                    {user.siteUsername || user.firstName || user.username || 'Kullanıcı'}
                  </h2>
                  {user.rank && (
                    <div className="flex items-center justify-center sm:justify-start gap-2 mt-2">
                      <span className="text-lg">{user.rank.icon}</span>
                      <span style={{ color: user.rank.color }} className="font-semibold">
                        {user.rank.name}
                      </span>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-3">
                    {user.isBanned && (
                      <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30">
                        <Ban className="w-3 h-3 mr-1" />Banlı
                      </Badge>
                    )}
                    {user.isRegistered === false && (
                      <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                        Sadece Telegram
                      </Badge>
                    )}
                    {user.emailVerified && (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                        <CheckCircle className="w-3 h-3 mr-1" />Email Onaylı
                      </Badge>
                    )}
                    {telegramUser?.hadStart && (
                      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                        <Send className="w-3 h-3 mr-1" />HAD
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard
                  icon={Coins}
                  label="Puan"
                  value={user.points || 0}
                  color="amber"
                />
                <StatCard
                  icon={Sparkles}
                  label="XP"
                  value={user.xp || 0}
                  color="purple"
                />
                <StatCard
                  icon={MessageSquare}
                  label="Mesaj"
                  value={userDetail.telegramMessageStats?.total || telegramUser?.messageCount || 0}
                  subValue={`+${userDetail.telegramMessageStats?.daily || 0} bugün`}
                  color="cyan"
                />
                <StatCard
                  icon={Gift}
                  label="Çark Hakkı"
                  value={user.dailySpinsLeft || 0}
                  color="orange"
                />
              </div>
            </div>

            {/* User Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-800/50">
              {/* Contact Info */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <Mail className="w-3 h-3" />İletişim
                </h4>
                {user.email && (
                  <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg group">
                    <div className="flex items-center gap-2 min-w-0">
                      <Mail className="w-4 h-4 text-blue-400 flex-shrink-0" />
                      <span className="text-sm text-white truncate">{user.email}</span>
                    </div>
                    <button
                      onClick={() => copyToClipboard(user.email)}
                      className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-slate-700 rounded transition-all"
                    >
                      <Copy className="w-3 h-3 text-slate-400" />
                    </button>
                  </div>
                )}
                {user.telegramId && (
                  <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg group">
                    <div className="flex items-center gap-2 min-w-0">
                      <Send className="w-4 h-4 text-blue-400 flex-shrink-0" />
                      <span className="text-sm text-white font-mono">{user.telegramId}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => copyToClipboard(user.telegramId)}
                        className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-slate-700 rounded transition-all"
                      >
                        <Copy className="w-3 h-3 text-slate-400" />
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm('Bu kullanıcının Telegram bağlantısını koparmak istediğine emin misin?')) return
                          try {
                            const res = await fetch(`/api/admin/users/${user.id}/telegram-disconnect`, { method: 'POST' })
                            if (!res.ok) throw new Error()
                            toast.success('Telegram bağlantısı koparıldı')
                            window.location.reload()
                          } catch {
                            toast.error('Bağlantı koparılamadı')
                          }
                        }}
                        className="p-1.5 hover:bg-rose-500/20 rounded transition-all"
                        title="Telegram bağlantısını kopar"
                      >
                        <Unlink className="w-3 h-3 text-rose-400" />
                      </button>
                    </div>
                  </div>
                )}
                {(user.username || telegramUser?.username) && (
                  <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg group">
                    <div className="flex items-center gap-2 min-w-0">
                      <User className="w-4 h-4 text-blue-400 flex-shrink-0" />
                      <span className="text-sm text-white">@{user.username || telegramUser?.username}</span>
                    </div>
                    <button
                      onClick={() => copyToClipboard(`@${user.username || telegramUser?.username}`)}
                      className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-slate-700 rounded transition-all"
                    >
                      <Copy className="w-3 h-3 text-slate-400" />
                    </button>
                  </div>
                )}
              </div>

              {/* Account Info */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <Calendar className="w-3 h-3" />Hesap
                </h4>
                <div className="p-3 bg-slate-800/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm text-slate-400">Kayıt Tarihi</span>
                  </div>
                  <p className="text-sm text-white mt-1 ml-6">
                    {new Date(user.createdAt).toLocaleDateString('tr-TR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </p>
                </div>
                {user.trc20WalletAddress && (
                  <div className="p-3 bg-slate-800/30 rounded-lg group">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-emerald-400" />
                        <span className="text-sm text-slate-400">TRC20 Cüzdan</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => copyToClipboard(user.trc20WalletAddress)}
                          className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-slate-700 rounded transition-all"
                        >
                          <Copy className="w-3 h-3 text-slate-400" />
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm('Bu kullanıcının cüzdan adresini kaldırmak istediğine emin misin?')) return
                            try {
                              const res = await fetch(`/api/admin/users/${user.id}/wallet-remove`, { method: 'POST' })
                              if (!res.ok) throw new Error()
                              toast.success('Cüzdan adresi kaldırıldı')
                              window.location.reload()
                            } catch {
                              toast.error('Cüzdan kaldırılamadı')
                            }
                          }}
                          className="p-1.5 hover:bg-rose-500/20 rounded transition-all"
                          title="Cüzdan adresini kaldır"
                        >
                          <Unlink className="w-3 h-3 text-rose-400" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-white mt-1 ml-6 font-mono truncate">
                      {user.trc20WalletAddress}
                    </p>
                  </div>
                )}
              </div>

              {/* Ban Status */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-3 h-3" />Durum
                </h4>
                {user.isBanned ? (
                  <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-lg space-y-2">
                    <div className="flex items-center gap-2 text-rose-400">
                      <Ban className="w-4 h-4" />
                      <span className="text-sm font-medium">Banlı Kullanıcı</span>
                    </div>
                    {user.banReason && (
                      <p className="text-sm text-rose-300/80 ml-6">
                        {user.banReason}
                      </p>
                    )}
                    {user.bannedAt && (
                      <p className="text-xs text-rose-400/60 ml-6">
                        {new Date(user.bannedAt).toLocaleString('tr-TR')}
                      </p>
                    )}
                    {user.bannedBy && (
                      <p className="text-xs text-rose-400/60 ml-6">
                        Admin: {user.bannedBy}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                    <div className="flex items-center gap-2 text-emerald-400">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm font-medium">Aktif Hesap</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Multi Account Warning - kompakt */}
        {userDetail.multiAccountMatches && userDetail.multiAccountMatches.length > 0 && (
          <div className="bg-gradient-to-r from-rose-500/10 via-orange-500/10 to-amber-500/10 border border-rose-500/30 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <p className="text-xs text-rose-400 font-medium">
                Multi Hesap: aynı IP'de {userDetail.multiAccountMatches.reduce((acc, m) => acc + m.users.length, 0)} farklı kullanıcı
              </p>
            </div>

            <div className="space-y-2">
              {userDetail.multiAccountMatches.map((match, index) => (
                <div key={index} className="bg-slate-900/50 border border-slate-800/50 rounded-lg p-2">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Wifi className="w-3 h-3 text-amber-400" />
                    <code className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px] text-amber-400 font-mono">
                      {match.value}
                    </code>
                    <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30 text-[10px] px-1.5 py-0">
                      {match.users.length}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                    {match.users.map((multiUser) => (
                      <div
                        key={multiUser.id}
                        onClick={() => router.push(`/admin/users/${multiUser.id}`)}
                        className="flex items-center gap-2 p-1.5 bg-slate-800/50 border border-slate-700/50 rounded-md hover:border-rose-500/50 hover:bg-slate-800 cursor-pointer transition-all group"
                      >
                        <Avatar className="w-6 h-6 border border-slate-700 flex-shrink-0">
                          <AvatarFallback className="bg-gradient-to-br from-rose-500 to-orange-600 text-white text-[10px] font-bold">
                            {(multiUser.siteUsername || multiUser.firstName || 'U').charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-white truncate group-hover:text-rose-400 transition-colors">
                            {multiUser.siteUsername || multiUser.firstName || 'Anonim'}
                          </p>
                          <span className="text-[10px] text-slate-500">{multiUser.points.toLocaleString('tr-TR')} puan</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Activity Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <MiniStatCard icon={ShoppingCart} label="Satın Alma" value={stats?.totalPurchases || 0} color="emerald" />
          <MiniStatCard icon={Calendar} label="Etkinlik" value={stats?.totalEventParticipations || 0} color="blue" />
          <MiniStatCard icon={Trophy} label="Kazanma" value={stats?.totalEventWins || 0} color="amber" />
          <MiniStatCard icon={Gift} label="Çark" value={stats?.totalWheelSpins || 0} color="orange" />
          <MiniStatCard icon={Target} label="Görev" value={stats?.totalTasksCompleted || 0} color="cyan" />
          <MiniStatCard icon={Store} label="Sponsor" value={stats?.totalSponsorsRegistered || 0} color="purple" />
        </div>

        {/* Tabs - with Point History */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-slate-900/50 border border-slate-800/50 p-1 rounded-xl w-full grid grid-cols-2 md:grid-cols-5 gap-1">
            <TabsTrigger
              value="history"
              className="data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400 rounded-lg text-sm"
            >
              <History className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Puan Geçmişi</span>
              <span className="sm:hidden">Geçmiş</span>
            </TabsTrigger>
            <TabsTrigger
              value="messages"
              className="data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400 rounded-lg text-sm"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Mesajlar
            </TabsTrigger>
            <TabsTrigger
              value="events"
              className="data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400 rounded-lg text-sm"
            >
              <Calendar className="w-4 h-4 mr-2" />
              Etkinlikler
            </TabsTrigger>
            <TabsTrigger
              value="purchases"
              className="data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400 rounded-lg text-sm"
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              Market
            </TabsTrigger>
            <TabsTrigger
              value="sponsors"
              className="data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400 rounded-lg text-sm"
            >
              <Store className="w-4 h-4 mr-2" />
              Sponsorlar
            </TabsTrigger>
          </TabsList>

          {/* Point History Tab */}
          <TabsContent value="history" className="mt-4">
            <SectionCard
              title="Puan Geçmişi"
              icon={History}
              color="amber"
              action={
                <span className="text-xs text-slate-500">
                  {userDetail.pointHistory?.length || 0} kayıt
                </span>
              }
            >
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {userDetail.pointHistory && userDetail.pointHistory.length > 0 ? (
                  userDetail.pointHistory.map((history: PointHistory) => {
                    const isPositive = history.amount > 0
                    const { Icon, color, bg } = getPointHistoryIcon(history.type)

                    return (
                      <div
                        key={history.id}
                        className="p-3 bg-slate-800/30 border border-slate-700/30 rounded-lg hover:border-slate-600/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${bg}`}>
                            <Icon className={`w-5 h-5 ${color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{history.description}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-slate-500">
                                {new Date(history.createdAt).toLocaleDateString('tr-TR', {
                                  day: 'numeric',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                              {history.adminUsername && (
                                <span className="text-xs text-slate-600">
                                  • Admin: {history.adminUsername}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className={`text-xl font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {isPositive ? '+' : ''}{history.amount.toLocaleString('tr-TR')}
                            </p>
                            <p className="text-xs text-slate-600">puan</p>
                          </div>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="text-center py-12">
                    <History className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">Puan geçmişi bulunamadı</p>
                  </div>
                )}
              </div>
            </SectionCard>
          </TabsContent>

          {/* Messages Tab */}
          <TabsContent value="messages" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SectionCard title="Mesaj İstatistikleri" icon={MessageSquare} color="cyan">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-xl text-center">
                    <p className="text-3xl font-bold text-cyan-400">
                      {userDetail?.telegramMessageStats?.daily || 0}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Bugün</p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl text-center">
                    <p className="text-3xl font-bold text-blue-400">
                      {userDetail?.telegramMessageStats?.weekly || 0}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Bu Hafta</p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl text-center">
                    <p className="text-3xl font-bold text-purple-400">
                      {userDetail?.telegramMessageStats?.monthly || 0}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Bu Ay</p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-xl text-center">
                    <p className="text-3xl font-bold text-emerald-400">
                      {userDetail?.telegramMessageStats?.total || 0}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Toplam</p>
                  </div>
                </div>
              </SectionCard>

              {telegramUser && (
                <SectionCard title="Telegram Bilgileri" icon={Send} color="blue">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg">
                      <span className="text-sm text-slate-400">Telegram ID</span>
                      <span className="text-sm text-white font-mono">{telegramUser.telegramId}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg">
                      <span className="text-sm text-slate-400">Username</span>
                      <span className="text-sm text-white">{telegramUser.username ? `@${telegramUser.username}` : '-'}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg">
                      <span className="text-sm text-slate-400">İlk Görülme</span>
                      <span className="text-sm text-white">
                        {new Date(telegramUser.firstSeenAt).toLocaleDateString('tr-TR')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg">
                      <span className="text-sm text-slate-400">Son Mesaj</span>
                      <span className="text-sm text-white">
                        {telegramUser.lastMessageAt
                          ? new Date(telegramUser.lastMessageAt).toLocaleString('tr-TR')
                          : '-'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg">
                      <span className="text-sm text-slate-400">HAD Durumu</span>
                      <Badge className={telegramUser.hadStart ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'}>
                        {telegramUser.hadStart ? 'Aktif' : 'Pasif'}
                      </Badge>
                    </div>
                  </div>
                </SectionCard>
              )}
            </div>
          </TabsContent>

          {/* Events Tab */}
          <TabsContent value="events" className="mt-4">
            <SectionCard
              title="Etkinlik Geçmişi"
              icon={Calendar}
              color="blue"
              action={
                <span className="text-xs text-slate-500">
                  {userDetail.eventParticipations?.length || 0} katılım, {userDetail.eventWins?.length || 0} kazanç
                </span>
              }
            >
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {userDetail.eventParticipations && userDetail.eventParticipations.length > 0 ? (
                  userDetail.eventParticipations.map((ep: any) => {
                    const winInfo = userDetail.eventWins?.find((ew: any) => ew.eventId === ep.eventId)
                    const isWinner = !!winInfo

                    return (
                      <div
                        key={ep.id}
                        className={`p-3 rounded-lg border transition-colors ${
                          isWinner
                            ? winInfo.status === 'prize_added'
                              ? 'bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40'
                              : 'bg-rose-500/5 border-rose-500/20 hover:border-rose-500/40'
                            : 'bg-slate-800/30 border-slate-700/30 hover:border-slate-600/50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            {ep.event?.sponsor?.logoUrl && (
                              <img
                                src={ep.event.sponsor.logoUrl}
                                alt={ep.event.sponsor.name}
                                className="h-8 w-16 object-contain rounded"
                              />
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-white truncate">{ep.event?.title}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-slate-500">
                                  {new Date(ep.createdAt).toLocaleDateString('tr-TR')}
                                </span>
                                {ep.event?.sponsor?.name && (
                                  <span className="text-xs text-slate-600">• {ep.event.sponsor.name}</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {isWinner ? (
                              <>
                                <div className="text-right">
                                  <Badge className={
                                    winInfo.status === 'prize_added'
                                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                      : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                                  }>
                                    <Trophy className="w-3 h-3 mr-1" />
                                    {winInfo.status === 'prize_added' ? 'Ödüllendi' : 'Kazandı'}
                                  </Badge>
                                  {winInfo.statusMessage && winInfo.status !== 'prize_added' && (
                                    <p className="text-[10px] text-rose-400/70 mt-0.5 max-w-[120px] truncate">
                                      {winInfo.statusMessage}
                                    </p>
                                  )}
                                </div>
                              </>
                            ) : (
                              <Badge className="bg-slate-700/50 text-slate-400 border-slate-600/30">
                                {ep.event?.status === 'completed' ? 'Katıldı' : 'Bekliyor'}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="text-center py-12">
                    <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-sm text-slate-500">Etkinlik katılımı yok</p>
                  </div>
                )}
              </div>
            </SectionCard>
          </TabsContent>

          {/* Purchases Tab */}
          <TabsContent value="purchases" className="mt-4">
            <SectionCard
              title="Market Satın Alımları"
              icon={ShoppingCart}
              color="emerald"
              action={
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-slate-500">{stats?.totalPurchases || 0} toplam</span>
                  {stats?.pendingPurchases > 0 && (
                    <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-full">
                      {stats.pendingPurchases} beklemede
                    </span>
                  )}
                </div>
              }
            >
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {userDetail.purchases && userDetail.purchases.length > 0 ? (
                  userDetail.purchases.map((purchase: any) => (
                    <div key={purchase.id} className="p-4 bg-slate-800/30 border border-slate-700/30 rounded-xl hover:border-slate-600/50 transition-colors">
                      <div className="flex gap-4">
                        {purchase.item.imageUrl && (
                          <div className="w-16 h-16 rounded-lg bg-slate-800 flex-shrink-0 overflow-hidden">
                            <img
                              src={purchase.item.imageUrl}
                              alt={purchase.item.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-white">{purchase.item.name}</p>
                              <p className="text-xs text-slate-500 mt-1">{purchase.item.description}</p>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge className={`text-xs ${
                                  purchase.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                                  purchase.status === 'pending' ? 'bg-amber-500/20 text-amber-400' :
                                  'bg-rose-500/20 text-rose-400'
                                }`}>
                                  {purchase.status === 'completed' ? 'Tamamlandı' :
                                   purchase.status === 'pending' ? 'Beklemede' : 'İptal'}
                                </Badge>
                                <span className="text-xs text-slate-500">
                                  {new Date(purchase.purchasedAt).toLocaleDateString('tr-TR')}
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-rose-400">
                                -{purchase.pointsSpent.toLocaleString('tr-TR')}
                              </p>
                              <p className="text-xs text-slate-500">puan</p>
                            </div>
                          </div>
                          {(purchase.walletAddress || purchase.sponsorInfo) && (
                            <div className="mt-3 pt-3 border-t border-slate-700/30 text-xs space-y-1">
                              {purchase.walletAddress && (
                                <p className="text-slate-400">
                                  <span className="text-slate-500">Cüzdan:</span> {purchase.walletAddress}
                                </p>
                              )}
                              {purchase.sponsorInfo && (
                                <p className="text-slate-400">
                                  <span className="text-slate-500">Sponsor Bilgisi:</span> {purchase.sponsorInfo}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <ShoppingCart className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">Henüz satın alma yapılmamış</p>
                  </div>
                )}
              </div>
            </SectionCard>
          </TabsContent>

          {/* Sponsors Tab */}
          <TabsContent value="sponsors" className="mt-4">
            <SectionCard
              title="Kayıtlı Sponsor Bilgileri"
              icon={Store}
              color="purple"
              action={
                <span className="text-xs text-slate-500">
                  {userDetail.sponsorInfo?.totalSponsors || 0} sponsor
                </span>
              }
            >
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {userDetail.sponsorInfo?.sponsors && userDetail.sponsorInfo.sponsors.length > 0 ? (
                  userDetail.sponsorInfo.sponsors.map((si: any) => (
                    <div key={si.id} className="p-3 bg-slate-800/30 border border-slate-700/30 rounded-lg hover:border-purple-500/30 transition-colors group">
                      <div className="flex items-center gap-3">
                        {si.sponsor.logoUrl && (
                          <div className="h-10 w-20 flex-shrink-0 flex items-center justify-center bg-slate-900/50 rounded overflow-hidden">
                            <img
                              src={si.sponsor.logoUrl}
                              alt={si.sponsor.name}
                              className="h-8 w-16 object-contain"
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-white">{si.sponsor.name}</p>
                            <Badge className="bg-purple-500/20 text-purple-400 text-[10px] px-1.5 py-0">
                              {si.sponsor.identifierType === 'username' ? 'Username' :
                               si.sponsor.identifierType === 'email' ? 'Email' : 'ID'}
                            </Badge>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                              si.status === 'approved' ? 'bg-emerald-500/15 text-emerald-400' :
                              si.status === 'rejected' ? 'bg-rose-500/15 text-rose-400' :
                              si.status === 'post_deposit' ? 'bg-amber-500/15 text-amber-400' :
                              si.status === 'incorrect' ? 'bg-rose-500/15 text-rose-400' :
                              'bg-white/10 text-slate-400'
                            }`}>
                              {si.status === 'approved' ? 'Onaylı ✅' :
                               si.status === 'rejected' ? 'Red ❌' :
                               si.status === 'post_deposit' ? 'Yatırım Sonrası 💰' :
                               si.status === 'incorrect' ? 'Hatalı ⚠️' : 'Bekliyor ⏳'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 truncate mt-0.5 font-mono">{si.identifier}</p>
                        </div>
                        <button
                          onClick={() => copyToClipboard(si.identifier)}
                          className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-slate-700 rounded transition-all"
                          title="Kopyala"
                        >
                          <Copy className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-2.5 italic">
                        Onaylama / reddetme işlemleri artık burada değil — Sponsorlar &gt; Kullanıcı Verileri sayfasından toplu şekilde yapılıyor.
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <Store className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">Kayıtlı sponsor bilgisi yok</p>
                  </div>
                )}
              </div>
            </SectionCard>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5 text-blue-400" />
              Kullanıcıyı Düzenle
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateUser} className="space-y-4">
            <div>
              <Label className="text-slate-400">Puan</Label>
              <Input
                type="number"
                value={formData.points}
                onChange={(e) => setFormData({ ...formData, points: parseInt(e.target.value) })}
                className="bg-slate-800 border-slate-700 text-white mt-1"
                required
              />
            </div>

            <div>
              <Label className="text-slate-400">XP</Label>
              <Input
                type="number"
                value={formData.xp}
                onChange={(e) => setFormData({ ...formData, xp: parseInt(e.target.value) })}
                className="bg-slate-800 border-slate-700 text-white mt-1"
                required
              />
            </div>

            <div>
              <Label className="text-slate-400">Günlük Çark Hakkı</Label>
              <Input
                type="number"
                value={formData.dailySpinsLeft}
                onChange={(e) => setFormData({ ...formData, dailySpinsLeft: parseInt(e.target.value) })}
                className="bg-slate-800 border-slate-700 text-white mt-1"
                min="0"
                required
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                onClick={() => setEditDialogOpen(false)}
                variant="outline"
                className="flex-1 border-slate-700 text-slate-400 hover:bg-slate-800"
              >
                İptal
              </Button>
              <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700">
                Güncelle
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Ban Dialog */}
      <Dialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-400">
              <Ban className="w-5 h-5" />
              Kullanıcıyı Banla
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-slate-400">Ban Nedeni</Label>
              <Input
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white mt-1"
                placeholder="Ban nedenini yazın..."
                required
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                onClick={() => setBanDialogOpen(false)}
                variant="outline"
                className="flex-1 border-slate-700 text-slate-400 hover:bg-slate-800"
              >
                İptal
              </Button>
              <Button
                onClick={handleBanToggle}
                className="flex-1 bg-rose-600 hover:bg-rose-700"
              >
                <Ban className="w-4 h-4 mr-2" />
                Banla
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
