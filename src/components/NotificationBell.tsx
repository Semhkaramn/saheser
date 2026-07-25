'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Check, ShoppingBag, Trophy, TrendingUp, Users, ClipboardCheck, Building2 } from 'lucide-react'
import { useUserTheme } from '@/components/providers/user-theme-provider'

interface NotificationItem {
  id: string
  type: string
  title: string
  message: string
  isRead: boolean
  linkUrl: string | null
  createdAt: string
}

const TYPE_ICON: Record<string, any> = {
  purchase_approved: ShoppingBag,
  purchase_rejected: ShoppingBag,
  randy_won: Trophy,
  rank_up: TrendingUp,
  referral_bonus: Users,
  task_completed: ClipboardCheck,
  sponsor_approved: Building2,
  sponsor_rejected: Building2,
}

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'az önce'
  if (mins < 60) return `${mins} dk önce`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} sa önce`
  const days = Math.floor(hours / 24)
  return `${days} gün önce`
}

export default function NotificationBell() {
  const { theme } = useUserTheme()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/notifications', { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      setNotifications(data.notifications || [])
      setUnreadCount(data.unreadCount || 0)
    } catch {
      // sessizce geç - bildirim bir "nice to have", sayfanın geri kalanını bozmasın
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // 🔔 Yeni bildirim var mı diye periyodik kontrol (60 saniyede bir) -
    // sayfa açık kalırsa da rozet güncel kalsın diye.
    const interval = setInterval(load, 60000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleItemClick(item: NotificationItem) {
    if (!item.isRead) {
      setNotifications((prev) => prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)))
      setUnreadCount((prev) => Math.max(0, prev - 1))
      fetch(`/api/notifications/${item.id}/read`, { method: 'POST', credentials: 'include' }).catch(() => {})
    }
    setOpen(false)
    if (item.linkUrl) router.push(item.linkUrl)
  }

  async function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    setUnreadCount(0)
    try {
      await fetch('/api/notifications/read-all', { method: 'POST', credentials: 'include' })
    } catch {}
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center justify-center w-9 h-9 lg:w-10 lg:h-10 rounded-full transition-all duration-200 backdrop-blur-sm"
        style={{ backgroundColor: `${theme.colors.card}bb`, border: `1px solid ${theme.colors.border}` }}
        aria-label="Bildirimler"
      >
        <Bell className="w-[18px] h-[18px]" style={{ color: theme.colors.textSecondary }} />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-[10px] font-bold"
            style={{ background: theme.colors.error, color: '#fff' }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-[320px] sm:w-[360px] max-h-[420px] overflow-y-auto rounded-2xl shadow-2xl z-50"
          style={{ background: theme.colors.card, border: `1px solid ${theme.colors.border}` }}
        >
          <div
            className="flex items-center justify-between px-4 py-3 sticky top-0"
            style={{ background: theme.colors.card, borderBottom: `1px solid ${theme.colors.border}` }}
          >
            <span className="font-display font-bold text-sm" style={{ color: theme.colors.text }}>Bildirimler</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs font-semibold flex items-center gap-1"
                style={{ color: theme.colors.primary }}
              >
                <Check className="w-3.5 h-3.5" />
                Hepsini okundu yap
              </button>
            )}
          </div>

          {loading && notifications.length === 0 ? (
            <p className="text-xs text-center py-8" style={{ color: theme.colors.textMuted }}>Yükleniyor...</p>
          ) : notifications.length === 0 ? (
            <div className="py-10 text-center px-4">
              <Bell className="w-7 h-7 mx-auto mb-2 opacity-40" style={{ color: theme.colors.textMuted }} />
              <p className="text-xs" style={{ color: theme.colors.textMuted }}>Henüz bir bildirimin yok.</p>
            </div>
          ) : (
            <div>
              {notifications.map((item) => {
                const Icon = TYPE_ICON[item.type] || Bell
                return (
                  <button
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className="w-full text-left flex items-start gap-3 px-4 py-3 transition-colors hover:bg-white/5"
                    style={{ borderBottom: `1px solid ${theme.colors.border}40` }}
                  >
                    <span
                      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: `${theme.colors.primary}15` }}
                    >
                      <Icon className="w-4 h-4" style={{ color: theme.colors.primary }} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold truncate" style={{ color: theme.colors.text }}>{item.title}</p>
                        {!item.isRead && (
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: theme.colors.primary }} />
                        )}
                      </div>
                      <p className="text-xs mt-0.5 line-clamp-2" style={{ color: theme.colors.textMuted }}>{item.message}</p>
                      <p className="text-[10px] mt-1" style={{ color: theme.colors.textMuted }}>{timeAgo(item.createdAt)}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
