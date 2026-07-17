'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  History,
  Search,
  Filter,
  Calendar,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  User,
  Wallet,
  Store,
  ShoppingCart,
  Gift,
  Target,
  Ticket,
  Hash,
  Send,
  Trophy,
  Sparkles,
  MessageSquare,
  ShieldCheck,
  Activity,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Clock,
  X,
  ExternalLink,
  Gamepad2
} from 'lucide-react'
import { toast } from 'sonner'

interface ActivityLog {
  id: string
  userId: string
  user: {
    siteUsername: string | null
    email: string | null
    telegramUsername: string | null
    firstName: string | null
    avatar: string | null
  } | null
  actionType: string
  actionLabel: string
  actionTitle: string
  actionDescription: string | null
  icon: string
  color: string
  oldValue: string | null
  newValue: string | null
  relatedId: string | null
  relatedType: string | null
  metadata: any
  ipAddress: string | null
  createdAt: string
}

interface Pagination {
  page: number
  limit: number
  totalCount: number
  totalPages: number
}

interface ActionTypeStat {
  actionType: string
  label: string
  count: number
}

// Icon component based on type
function ActivityIcon({ type, color }: { type: string; color: string }) {
  const iconColors: Record<string, string> = {
    emerald: 'text-emerald-400 bg-emerald-500/20',
    amber: 'text-amber-400 bg-amber-500/20',
    rose: 'text-rose-400 bg-rose-500/20',
    blue: 'text-blue-400 bg-blue-500/20',
    purple: 'text-purple-400 bg-purple-500/20',
    cyan: 'text-cyan-400 bg-cyan-500/20',
    orange: 'text-orange-400 bg-orange-500/20',
    slate: 'text-slate-400 bg-slate-500/20'
  }

  const colorClass = iconColors[color] || iconColors.slate

  const icons: Record<string, React.ReactNode> = {
    sponsor: <Store className="w-4 h-4" />,
    wallet: <Wallet className="w-4 h-4" />,
    shopping: <ShoppingCart className="w-4 h-4" />,
    calendar: <Calendar className="w-4 h-4" />,
    trophy: <Trophy className="w-4 h-4" />,
    wheel: <Gift className="w-4 h-4" />,
    task: <Target className="w-4 h-4" />,
    ticket: <Ticket className="w-4 h-4" />,
    promocode: <Hash className="w-4 h-4" />,
    admin: <ShieldCheck className="w-4 h-4" />,
    message: <MessageSquare className="w-4 h-4" />,
    telegram: <Send className="w-4 h-4" />,
    randy: <Sparkles className="w-4 h-4" />,
    user: <User className="w-4 h-4" />,
    game: <Gamepad2 className="w-4 h-4" />
  }

  return (
    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
      {icons[type] || <Activity className="w-4 h-4" />}
    </div>
  )
}

export default function ActivityLogsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    totalCount: 0,
    totalPages: 0
  })
  const [actionTypeStats, setActionTypeStats] = useState<ActionTypeStat[]>([])

  // Filters
  const [search, setSearch] = useState('')
  const [actionType, setActionType] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [showFilters, setShowFilters] = useState(false)

  const loadLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        sortBy,
        sortOrder
      })

      if (search) params.set('search', search)
      if (actionType && actionType !== 'all') params.set('actionType', actionType)
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)

      const response = await fetch(`/api/admin/activity-logs?${params}`)
      const data = await response.json()

      if (data.error) {
        toast.error(data.error)
        return
      }

      setLogs(data.logs)
      setPagination(data.pagination)
      setActionTypeStats(data.actionTypeStats)
    } catch (error) {
      console.error('Error loading logs:', error)
      toast.error('Loglar yüklenemedi')
    } finally {
      setLoading(false)
    }
  }, [pagination.page, pagination.limit, search, actionType, startDate, endDate, sortBy, sortOrder])

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (!token) {
      router.push('/admin')
      return
    }
    loadLogs()
  }, [loadLogs])

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 }))
    loadLogs()
  }

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  const clearFilters = () => {
    setSearch('')
    setActionType('all')
    setStartDate('')
    setEndDate('')
    setSortBy('createdAt')
    setSortOrder('desc')
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatRelativeDate = (dateStr: string) => {
    // Tam tarih ve saat göster
    return formatDate(dateStr)
  }

  const hasActiveFilters = search || actionType !== 'all' || startDate || endDate

  // Helper function to translate result to Turkish
  const translateResult = (result: string) => {
    const translations: Record<string, string> = {
      'win': 'Kazanç',
      'lose': 'Kayıp',
      'push': 'Berabere',
      'timeout': 'Zaman Aşımı'
    }
    return translations[result] || result
  }

  return (
    <div className="admin-page-container">
      <div className="admin-page-inner space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <History className="w-6 h-6 text-blue-400" />
              Aktivite Logları
            </h1>
            <p className="text-slate-400 text-sm mt-0.5">
              Tüm kullanıcı aktivitelerini görüntüleyin ve filtreleyin
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">
              {pagination.totalCount.toLocaleString('tr-TR')} kayıt
            </span>
            <Button
              onClick={loadLogs}
              variant="outline"
              size="sm"
              className="border-slate-700 text-slate-400 hover:bg-slate-800"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          {actionTypeStats.slice(0, 6).map((stat) => (
            <button
              key={stat.actionType}
              onClick={() => {
                setActionType(stat.actionType)
                setPagination(prev => ({ ...prev, page: 1 }))
              }}
              className={`p-3 rounded-lg border transition-all text-left ${
                actionType === stat.actionType
                  ? 'bg-blue-500/20 border-blue-500/50'
                  : 'bg-slate-800/30 border-slate-700/30 hover:border-slate-600/50'
              }`}
            >
              <p className="text-lg font-bold text-white">{stat.count.toLocaleString('tr-TR')}</p>
              <p className="text-xs text-slate-400 truncate">{stat.label}</p>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 space-y-3">
          {/* Top Row */}
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                placeholder="Ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-9 bg-slate-800/50 border-slate-700/50 text-white"
              />
            </div>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-36 bg-slate-800/50 border-slate-700/50 text-white"
              title="Başlangıç"
            />
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-36 bg-slate-800/50 border-slate-700/50 text-white"
              title="Bitiş"
            />
            <Button
              onClick={() => setShowFilters(!showFilters)}
              variant="outline"
              className={`border-slate-700 ${showFilters ? 'bg-blue-500/20 text-blue-400' : 'text-slate-400'}`}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filtre
            </Button>
            <Button
              onClick={handleSearch}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Search className="w-4 h-4 mr-2" />
              Ara
            </Button>
            {hasActiveFilters && (
              <Button
                onClick={clearFilters}
                variant="outline"
                className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
              >
                <X className="w-4 h-4 mr-2" />
                Temizle
              </Button>
            )}
          </div>

          {/* Filter Options */}
          {showFilters && (
            <div className="pt-3 border-t border-slate-800/50">
              <p className="text-xs text-slate-500 mb-2">Aksiyon Tipi</p>
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => setActionType('all')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    actionType === 'all' ? 'bg-blue-500 text-white' : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  Tümü
                </button>
                {actionTypeStats.map((stat) => (
                  <button
                    key={stat.actionType}
                    onClick={() => setActionType(stat.actionType)}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                      actionType === stat.actionType
                        ? 'bg-blue-500 text-white'
                        : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    {stat.label} ({stat.count})
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800/50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                    Kullanıcı
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                    Aksiyon
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                    Detay
                  </th>
                  <th
                    className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase cursor-pointer hover:text-slate-300"
                    onClick={() => handleSort('createdAt')}
                  >
                    <div className="flex items-center gap-1">
                      Tarih
                      {sortBy === 'createdAt' && (
                        sortOrder === 'desc' ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <RefreshCw className="w-6 h-6 text-slate-600 animate-spin" />
                        <span className="text-sm text-slate-500">Yükleniyor...</span>
                      </div>
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center">
                      <History className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                      <p className="text-slate-500">Log bulunamadı</p>
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr
                      key={log.id}
                      className="border-b border-slate-800/30 hover:bg-slate-800/30 transition-colors"
                    >
                      {/* User */}
                      <td className="px-4 py-3">
                        <button
                          onClick={() => router.push(`/admin/users/${log.userId}`)}
                          className="flex items-center gap-2 group"
                        >
                          <Avatar className="w-8 h-8 border border-slate-700">
                            {log.user?.avatar ? (
                              <AvatarImage src={log.user.avatar} />
                            ) : (
                              <AvatarFallback className="bg-slate-800 text-slate-400 text-xs">
                                {(log.user?.siteUsername || log.user?.firstName || 'U').charAt(0).toUpperCase()}
                              </AvatarFallback>
                            )}
                          </Avatar>
                          <div className="text-left min-w-0">
                            <p className="text-sm text-white group-hover:text-blue-400 truncate max-w-[120px]">
                              {log.user?.siteUsername || log.user?.firstName || 'Anonim'}
                            </p>
                            {log.user?.telegramUsername && (
                              <p className="text-xs text-slate-500 truncate max-w-[120px]">
                                @{log.user.telegramUsername}
                              </p>
                            )}
                          </div>
                          <ExternalLink className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100" />
                        </button>
                      </td>

                      {/* Action Type */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <ActivityIcon type={log.icon} color={log.color} />
                          <Badge className={`text-xs bg-${log.color}-500/20 text-${log.color}-400 border-${log.color}-500/30`}>
                            {log.actionLabel}
                          </Badge>
                        </div>
                      </td>

                      {/* Detail */}
                      <td className="px-4 py-3">
                        <div className="max-w-[400px]">
                          <p className="text-sm text-white break-words">{log.actionTitle}</p>
                          {log.actionDescription && log.actionDescription.trim() !== '' && (
                            <p className="text-xs text-slate-500 mt-0.5 break-words">{log.actionDescription}</p>
                          )}
                          {/* Metadata badges */}
                          {log.metadata && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {log.metadata.pointsWon && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                                  +{log.metadata.pointsWon}
                                </span>
                              )}
                              {log.metadata.pointsSpent && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400">
                                  -{log.metadata.pointsSpent}
                                </span>
                              )}
                              {log.metadata.betAmount && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                                  Bahis: {log.metadata.betAmount}
                                </span>
                              )}
                              {log.metadata.result && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                  log.metadata.result === 'win'
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : log.metadata.result === 'lose'
                                    ? 'bg-rose-500/20 text-rose-400'
                                    : 'bg-slate-500/20 text-slate-400'
                                }`}>
                                  {translateResult(log.metadata.result)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-slate-600" />
                          <span className="text-xs text-slate-400" title={formatDate(log.createdAt)}>
                            {formatRelativeDate(log.createdAt)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="px-4 py-3 border-t border-slate-800/50 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Sayfa {pagination.page} / {pagination.totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={pagination.page === 1}
                  variant="outline"
                  size="sm"
                  className="border-slate-700 text-slate-400 disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page >= pagination.totalPages}
                  variant="outline"
                  size="sm"
                  className="border-slate-700 text-slate-400 disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
