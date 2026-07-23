'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Users,
  Search,
  Ban,
  ShieldCheck,
  MessageSquare,
  Coins,
  Award,
  Eye,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  Download,
  X,
  FileSpreadsheet,
  FileJson,
  Check
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

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

interface User {
  id: string
  userId: string | null
  telegramId?: string | null
  siteUsername?: string | null
  username?: string | null
  telegramUsername?: string
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  avatar?: string | null
  points: number
  xp: number
  totalMessages: number
  dailySpinsLeft: number
  isBanned: boolean
  banReason?: string | null | undefined
  bannedAt?: string | null | undefined
  bannedBy?: string | null | undefined
  createdAt: string
  isRegistered: boolean
  hadStart?: boolean
  hasTelegram?: boolean
  rank?: {
    name: string
    icon: string
    color: string
  } | null
  _count: {
    purchases: number
    wheelSpins: number
    messages: number
  }
}

interface Pagination {
  currentPage: number
  totalPages: number
  totalCount: number
  limit: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export default function AdminUsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('points')
  const [sortOrder, setSortOrder] = useState('desc')
  const [userType, setUserType] = useState('all')
  const [bannedFilter, setBannedFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [pagination, setPagination] = useState<Pagination | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)

  // Export Modal States
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv')
  const [exportOptions, setExportOptions] = useState({
    includeSponsors: false,
    includePurchases: false,
    includeWheelSpins: false,
    includeEventParticipations: false,
    includeTicketRequests: false,
  })
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (!token) {
      router.push('/admin')
      return
    }
    loadUsers()
  }, [router])

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (!token) return

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    const delayDebounceFn = setTimeout(() => {
      loadUsers()
    }, 400)

    return () => {
      clearTimeout(delayDebounceFn)
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [searchTerm, sortBy, sortOrder, userType, bannedFilter, currentPage, limit])

  async function loadUsers() {
    try {
      abortControllerRef.current = new AbortController()

      const params = new URLSearchParams({
        search: searchTerm,
        sortBy,
        sortOrder,
        userType,
        page: currentPage.toString(),
        limit: limit.toString()
      })

      if (bannedFilter !== 'all') {
        params.append('banned', bannedFilter)
      }

      const response = await fetch(
        `/api/admin/statistics?${params.toString()}`,
        { signal: abortControllerRef.current.signal }
      )
      const data = await response.json()

      let filteredUsers = data.users || []

      setUsers(filteredUsers)
      setPagination(data.pagination)
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') return
      console.error('Error loading users:', error)
      toast.error('Kullanıcılar yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  async function handleBanToggle(userId: string, isBanned: boolean) {
    const action = isBanned ? 'unban' : 'ban'
    const reason = !isBanned ? prompt('Ban nedeni:') : undefined

    if (!isBanned && !reason) return

    try {
      const response = await fetch(`/api/admin/users/${userId}/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          reason,
          adminUsername: 'Admin'
        })
      })

      const data = await response.json()

      if (data.success) {
        toast.success(data.message)
        loadUsers()
      } else {
        toast.error(data.error || 'İşlem başarısız')
      }
    } catch (error) {
      console.error('Ban toggle error:', error)
      toast.error('Bir hata oluştu')
    }
  }

  async function handleExport() {
    try {
      setExporting(true)
      const response = await fetch('/api/admin/users/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format: exportFormat,
          ...exportOptions
        })
      })

      if (!response.ok) {
        // API'den hata detaylarını al
        let errorMessage = 'Export işlemi başarısız'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
          if (errorData.details) {
            console.error('Export details:', errorData.details)
          }
        } catch {
          // JSON parse edilemezse varsayılan mesajı kullan
        }
        throw new Error(errorMessage)
      }

      if (exportFormat === 'csv') {
        // CSV dosyasını indir
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `kullanicilar_${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        toast.success('CSV dosyası indirildi!')
      } else {
        // JSON dosyasını indir
        const data = await response.json()
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `kullanicilar_${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        toast.success('JSON dosyası indirildi!')
      }

      setShowExportModal(false)
    } catch (error) {
      console.error('Export error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Export işlemi başarısız'
      toast.error(errorMessage)
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen" style={{ background: theme.background }}>
        <Loader2 className="w-8 h-8 animate-spin mb-3" style={{ color: theme.primary }} />
        <p className="text-sm" style={{ color: theme.textMuted }}>Kullanıcılar yükleniyor...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: theme.background }}>
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold mb-1 flex items-center gap-2" style={{ color: theme.text }}>
              <Users className="w-6 h-6" />
              Kullanıcılar
            </h1>
            <p className="text-sm" style={{ color: theme.textMuted }}>
              Toplam {pagination?.totalCount || 0} kullanıcı
            </p>
          </div>
          <Button
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-all hover:scale-105"
            style={{
              background: `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})`,
              color: 'white',
              boxShadow: `0 4px 16px ${theme.gradientFrom}30`
            }}
          >
            <Download className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline">Dışa Aktar</span>
          </Button>
        </div>

        {/* Filters */}
        <div
          className="p-4 rounded-2xl space-y-3"
          style={{
            background: theme.card,
            border: `1px solid ${theme.border}`,
            boxShadow: `0 8px 32px ${theme.gradientFrom}10`
          }}
        >
          {/* Search */}
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 z-10" style={{ color: theme.textMuted }} />
            <input
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full pl-10 h-10 rounded-xl border-0 text-sm"
              style={{
                background: theme.backgroundSecondary,
                color: theme.text,
                border: `1px solid ${theme.border}`
              }}
              placeholder="İsim, kullanıcı adı, email veya Telegram ID ile ara..."
            />
          </div>

          {/* Filter Options */}
          <div className="flex flex-wrap gap-2">
            <Select value={userType} onValueChange={(val) => { setUserType(val); setCurrentPage(1); }}>
              <SelectTrigger
                className="h-9 text-sm w-auto min-w-[130px] rounded-lg border-0"
                style={{ background: theme.backgroundSecondary, color: theme.text, border: `1px solid ${theme.border}` }}
              >
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Kullanıcı Tipi" />
              </SelectTrigger>
              <SelectContent style={{ background: theme.backgroundSecondary, border: `1px solid ${theme.border}` }}>
                <SelectItem value="all">Tümü</SelectItem>
                <SelectItem value="site">Site Kayıtlı</SelectItem>
                <SelectItem value="telegram">Sadece Telegram</SelectItem>
                <SelectItem value="linked">Bağlı Hesaplar</SelectItem>
              </SelectContent>
            </Select>

            <Select value={bannedFilter} onValueChange={(val) => { setBannedFilter(val); setCurrentPage(1); }}>
              <SelectTrigger
                className="h-9 text-sm w-auto min-w-[120px] rounded-lg border-0"
                style={{ background: theme.backgroundSecondary, color: theme.text, border: `1px solid ${theme.border}` }}
              >
                <SelectValue placeholder="Ban Durumu" />
              </SelectTrigger>
              <SelectContent style={{ background: theme.backgroundSecondary, border: `1px solid ${theme.border}` }}>
                <SelectItem value="all">Tümü</SelectItem>
                <SelectItem value="true">Banlı</SelectItem>
                <SelectItem value="false">Aktif</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger
                className="h-9 text-sm w-auto min-w-[140px] rounded-lg border-0"
                style={{ background: theme.backgroundSecondary, color: theme.text, border: `1px solid ${theme.border}` }}
              >
                <SelectValue placeholder="Sırala" />
              </SelectTrigger>
              <SelectContent style={{ background: theme.backgroundSecondary, border: `1px solid ${theme.border}` }}>
                <SelectItem value="points">Puan</SelectItem>
                <SelectItem value="xp">XP</SelectItem>
                <SelectItem value="messages">Mesaj Sayısı</SelectItem>
                <SelectItem value="createdAt">Kayıt Tarihi</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortOrder} onValueChange={setSortOrder}>
              <SelectTrigger
                className="h-9 text-sm w-auto min-w-[150px] rounded-lg border-0"
                style={{ background: theme.backgroundSecondary, color: theme.text, border: `1px solid ${theme.border}` }}
              >
                <SelectValue placeholder="Sıralama" />
              </SelectTrigger>
              <SelectContent style={{ background: theme.backgroundSecondary, border: `1px solid ${theme.border}` }}>
                <SelectItem value="desc">Yüksekten Düşüğe</SelectItem>
                <SelectItem value="asc">Düşükten Yükseğe</SelectItem>
              </SelectContent>
            </Select>

            <Select value={limit.toString()} onValueChange={(val) => { setLimit(parseInt(val)); setCurrentPage(1); }}>
              <SelectTrigger
                className="h-9 text-sm w-auto min-w-[80px] rounded-lg border-0"
                style={{ background: theme.backgroundSecondary, color: theme.text, border: `1px solid ${theme.border}` }}
              >
                <SelectValue placeholder="Göster" />
              </SelectTrigger>
              <SelectContent style={{ background: theme.backgroundSecondary, border: `1px solid ${theme.border}` }}>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Users List */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: theme.card,
            border: `1px solid ${theme.border}`,
            boxShadow: `0 8px 32px ${theme.gradientFrom}10`
          }}
        >
          {users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: `${theme.primary}15`, border: `1px solid ${theme.primary}20` }}
              >
                <Users className="w-8 h-8" style={{ color: `${theme.primary}60` }} />
              </div>
              <h3 className="text-sm font-semibold mb-1" style={{ color: theme.textSecondary }}>Kullanıcı Bulunamadı</h3>
              <p className="text-xs" style={{ color: theme.textMuted }}>Arama kriterlerinize uygun kullanıcı yok</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead style={{ background: `${theme.backgroundSecondary}80`, borderBottom: `1px solid ${theme.border}` }}>
                  <tr>
                    <th className="text-left p-4 text-xs font-semibold uppercase tracking-wide" style={{ color: theme.textMuted }}>KULLANICI</th>
                    <th className="text-left p-4 text-xs font-semibold uppercase tracking-wide hidden md:table-cell" style={{ color: theme.textMuted }}>İSTATİSTİKLER</th>
                    <th className="text-left p-4 text-xs font-semibold uppercase tracking-wide hidden lg:table-cell" style={{ color: theme.textMuted }}>TİP</th>
                    <th className="text-right p-4 text-xs font-semibold uppercase tracking-wide" style={{ color: theme.textMuted }}>İŞLEMLER</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user, index) => (
                    <tr
                      key={user.id}
                      className="transition-colors"
                      style={{
                        borderBottom: `1px solid ${theme.border}`,
                        background: user.isBanned ? `${theme.danger}10` : index % 2 === 0 ? 'transparent' : `${theme.backgroundSecondary}30`
                      }}
                    >
                      {/* User Info */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 flex-shrink-0">
                            {user.avatar ? (
                              <AvatarImage src={user.avatar} alt="Avatar" />
                            ) : (
                              <AvatarFallback style={{ background: `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})`, color: 'white' }}>
                                {(user.siteUsername || user.firstName || user.username || user.telegramUsername || 'U').charAt(0).toUpperCase()}
                              </AvatarFallback>
                            )}
                          </Avatar>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold truncate" style={{ color: theme.text }}>
                                {user.siteUsername || user.firstName || user.username || user.telegramUsername || 'Kullanıcı'}
                              </p>
                              {user.rank && (
                                <span className="text-sm" style={{ color: user.rank.color }}>
                                  {user.rank.icon}
                                </span>
                              )}
                              {user.isBanned && (
                                <span
                                  className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                                  style={{ background: `${theme.danger}20`, color: theme.danger }}
                                >
                                  BANLI
                                </span>
                              )}
                            </div>
                            <p className="text-xs truncate" style={{ color: theme.textMuted }}>
                              {(user.username || user.telegramUsername) ? `@${user.username || user.telegramUsername}` : user.email || user.telegramId || 'Bilgi yok'}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Stats */}
                      <td className="p-4 hidden md:table-cell">
                        <div className="flex items-center gap-4 text-xs">
                          <span className="flex items-center gap-1" style={{ color: '#facc15' }} title="Puan">
                            <Coins className="w-3.5 h-3.5" /> {user.points}
                          </span>
                          <span className="flex items-center gap-1" style={{ color: '#a855f7' }} title="XP">
                            <Award className="w-3.5 h-3.5" /> {user.xp}
                          </span>
                          <span className="flex items-center gap-1" style={{ color: '#22d3ee' }} title="Mesaj">
                            <MessageSquare className="w-3.5 h-3.5" /> {user._count.messages || user.totalMessages}
                          </span>
                        </div>
                      </td>

                      {/* Type */}
                      <td className="p-4 hidden lg:table-cell">
                        <div className="flex gap-1">
                          {user.isRegistered ? (
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                              style={{ background: `${theme.success}20`, color: theme.success }}
                            >
                              Site
                            </span>
                          ) : (
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                              style={{ background: `${theme.warning}20`, color: theme.warning }}
                            >
                              TG
                            </span>
                          )}
                          {user.hasTelegram && user.isRegistered && (
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                              style={{ background: `${theme.primary}20`, color: theme.primaryLight }}
                            >
                              Bağlı
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/users/${user.userId || user.id}`}
                            className="text-xs px-2.5 sm:px-3 py-1.5 flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-all hover:scale-105 flex-shrink-0"
                            style={{
                              background: `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})`,
                              color: 'white'
                            }}
                            title="Detayları Görüntüle"
                          >
                            <Eye className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="hidden sm:inline">Detay</span>
                          </Link>
                          <button
                            onClick={() => handleBanToggle(user.id, user.isBanned)}
                            className="text-xs px-2.5 sm:px-3 py-1.5 flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-all hover:scale-105 flex-shrink-0"
                            style={{
                              background: user.isBanned ? `${theme.success}20` : `${theme.danger}20`,
                              color: user.isBanned ? theme.success : theme.danger
                            }}
                            title={user.isBanned ? "Ban Kaldır" : "Banla"}
                          >
                            {user.isBanned ? (
                              <><ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" /> <span className="hidden lg:inline">Kaldır</span></>
                            ) : (
                              <><Ban className="w-3.5 h-3.5 flex-shrink-0" /> <span className="hidden lg:inline">Banla</span></>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm" style={{ color: theme.textMuted }}>
              {((currentPage - 1) * limit) + 1} - {Math.min(currentPage * limit, pagination.totalCount)} / {pagination.totalCount}
            </div>
            <div className="flex gap-1">
              <Button
                onClick={() => setCurrentPage(1)}
                disabled={!pagination.hasPreviousPage}
                className="p-2 rounded-lg border-0 disabled:opacity-50"
                style={{ background: theme.backgroundSecondary, color: theme.text }}
                title="İlk Sayfa"
              >
                <ChevronsLeft className="w-4 h-4" />
              </Button>
              <Button
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={!pagination.hasPreviousPage}
                className="p-2 rounded-lg border-0 disabled:opacity-50"
                style={{ background: theme.backgroundSecondary, color: theme.text }}
                title="Önceki"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>

              <div className="flex items-center px-4 text-sm" style={{ color: theme.textMuted }}>
                {currentPage} / {pagination.totalPages}
              </div>

              <Button
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={!pagination.hasNextPage}
                className="p-2 rounded-lg border-0 disabled:opacity-50"
                style={{ background: `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})`, color: 'white' }}
                title="Sonraki"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button
                onClick={() => setCurrentPage(pagination.totalPages)}
                disabled={!pagination.hasNextPage}
                className="p-2 rounded-lg border-0 disabled:opacity-50"
                style={{ background: theme.backgroundSecondary, color: theme.text }}
                title="Son Sayfa"
              >
                <ChevronsRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Export Modal */}
        {showExportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div
              className="w-full max-w-md rounded-2xl overflow-hidden"
              style={{
                background: theme.card,
                border: `1px solid ${theme.border}`,
                boxShadow: `0 25px 50px -12px ${theme.gradientFrom}30`
              }}
            >
              {/* Modal Header */}
              <div
                className="flex items-center justify-between p-4"
                style={{
                  background: `linear-gradient(135deg, ${theme.gradientFrom}15, ${theme.gradientTo}10)`,
                  borderBottom: `1px solid ${theme.border}`
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{
                      background: `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})`
                    }}
                  >
                    <Download className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg" style={{ color: theme.text }}>Kullanıcıları Dışa Aktar</h3>
                    <p className="text-xs" style={{ color: theme.textMuted }}>Format ve verileri seçin</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowExportModal(false)}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" style={{ color: theme.textMuted }} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-4 space-y-4">
                {/* Format Selection */}
                <div>
                  <label className="text-sm font-semibold mb-2 block" style={{ color: theme.text }}>
                    Dosya Formatı
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setExportFormat('csv')}
                      className="p-4 rounded-xl flex flex-col items-center gap-2 transition-all"
                      style={{
                        background: exportFormat === 'csv'
                          ? `linear-gradient(135deg, ${theme.gradientFrom}20, ${theme.gradientTo}15)`
                          : theme.backgroundSecondary,
                        border: `2px solid ${exportFormat === 'csv' ? theme.primary : theme.border}`,
                        boxShadow: exportFormat === 'csv' ? `0 4px 16px ${theme.primary}20` : 'none'
                      }}
                    >
                      <FileSpreadsheet className="w-8 h-8" style={{ color: exportFormat === 'csv' ? theme.primary : theme.textMuted }} />
                      <span className="font-semibold text-sm" style={{ color: exportFormat === 'csv' ? theme.primary : theme.text }}>CSV</span>
                      <span className="text-xs text-center" style={{ color: theme.textMuted }}>Excel uyumlu</span>
                    </button>
                    <button
                      onClick={() => setExportFormat('json')}
                      className="p-4 rounded-xl flex flex-col items-center gap-2 transition-all"
                      style={{
                        background: exportFormat === 'json'
                          ? `linear-gradient(135deg, ${theme.gradientFrom}20, ${theme.gradientTo}15)`
                          : theme.backgroundSecondary,
                        border: `2px solid ${exportFormat === 'json' ? theme.primary : theme.border}`,
                        boxShadow: exportFormat === 'json' ? `0 4px 16px ${theme.primary}20` : 'none'
                      }}
                    >
                      <FileJson className="w-8 h-8" style={{ color: exportFormat === 'json' ? theme.primary : theme.textMuted }} />
                      <span className="font-semibold text-sm" style={{ color: exportFormat === 'json' ? theme.primary : theme.text }}>JSON</span>
                      <span className="text-xs text-center" style={{ color: theme.textMuted }}>Geliştirici dostu</span>
                    </button>
                  </div>
                </div>

                {/* Additional Data Options */}
                <div>
                  <label className="text-sm font-semibold mb-3 block" style={{ color: theme.text }}>
                    Ekstra Veriler <span className="font-normal" style={{ color: theme.textMuted }}>(Opsiyonel)</span>
                  </label>
                  <p className="text-xs mb-3" style={{ color: theme.textMuted }}>
                    Temel kullanıcı bilgileri (ID, isim, email, puan, XP vb.) her zaman dahil edilir.
                  </p>
                  <div className="space-y-2">
                    {[
                      { key: 'includeSponsors', label: 'Sponsor Bilgileri', desc: 'Kullanıcının kayıtlı sponsor hesapları' },
                      { key: 'includePurchases', label: 'Satın Almalar', desc: 'Mağaza satın alma geçmişi' },
                      { key: 'includeWheelSpins', label: 'Çark Çevirmeleri', desc: 'Çark çevirme sayısı' },
                      { key: 'includeEventParticipations', label: 'Etkinlik Katılımları', desc: 'Katıldığı etkinlikler' },
                      { key: 'includeTicketRequests', label: 'Bilet Talepleri', desc: 'Bilet talep geçmişi' },
                    ].map((option) => (
                      <label
                        key={option.key}
                        className="flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all hover:bg-white/5"
                        style={{
                          background: exportOptions[option.key as keyof typeof exportOptions]
                            ? `${theme.primary}10`
                            : 'transparent',
                          border: `1px solid ${exportOptions[option.key as keyof typeof exportOptions] ? theme.primary : theme.border}40`
                        }}
                      >
                        <div
                          className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{
                            background: exportOptions[option.key as keyof typeof exportOptions]
                              ? `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})`
                              : theme.backgroundSecondary,
                            border: `2px solid ${exportOptions[option.key as keyof typeof exportOptions] ? 'transparent' : theme.border}`
                          }}
                        >
                          {exportOptions[option.key as keyof typeof exportOptions] && (
                            <Check className="w-3 h-3 text-white" />
                          )}
                        </div>
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={exportOptions[option.key as keyof typeof exportOptions]}
                          onChange={(e) => setExportOptions(prev => ({
                            ...prev,
                            [option.key]: e.target.checked
                          }))}
                        />
                        <div>
                          <span className="font-medium text-sm block" style={{ color: theme.text }}>{option.label}</span>
                          <span className="text-xs" style={{ color: theme.textMuted }}>{option.desc}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div
                className="flex items-center justify-end gap-3 p-4"
                style={{ borderTop: `1px solid ${theme.border}` }}
              >
                <Button
                  onClick={() => setShowExportModal(false)}
                  className="px-4 py-2 rounded-xl font-semibold"
                  style={{
                    background: theme.backgroundSecondary,
                    color: theme.text,
                    border: `1px solid ${theme.border}`
                  }}
                  disabled={exporting}
                >
                  İptal
                </Button>
                <Button
                  onClick={handleExport}
                  disabled={exporting}
                  className="px-6 py-2 rounded-xl font-semibold flex items-center gap-2"
                  style={{
                    background: `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})`,
                    color: 'white',
                    boxShadow: `0 4px 16px ${theme.gradientFrom}30`
                  }}
                >
                  {exporting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      İndiriliyor...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      İndir
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
