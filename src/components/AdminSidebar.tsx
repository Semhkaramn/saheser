'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import {
  LayoutDashboard,
  BarChart3,
  FileText,
  ShoppingCart,
  Ticket,
  TicketCheck,
  Calendar,
  Heart,
  Sparkles,
  MonitorPlay,
  Shield,
  Users2,
  Link2,
  UserCog,
  Bot,
  Menu,
  X,
  LogOut,
  User,
  Users,
  ShieldAlert,
  Gift,
  Activity
} from 'lucide-react'

import { Button } from '@/components/ui/button'

interface AdminSidebarProps {
  adminInfo: {
    username: string
    isSuperAdmin: boolean
    permissions: Record<string, boolean>
  } | null
}

export default function AdminSidebar({ adminInfo }: AdminSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [isTelegram, setIsTelegram] = useState(false)

  // Telegram WebApp ortamını tespit et
  useEffect(() => {
    const checkTelegram = () => {
      const isTg = !!(
        typeof window !== 'undefined' &&
        (window as any).Telegram?.WebApp ||
        navigator.userAgent.includes('Telegram') ||
        window.location.href.includes('tgWebAppData')
      )
      setIsTelegram(isTg)
    }
    checkTelegram()
  }, [])

  // Telegram için özel navigasyon
  const handleNavigation = useCallback((e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (isTelegram) {
      e.preventDefault()
      e.stopPropagation()
      // Telegram'da tam URL ile navigasyon yap
      const fullUrl = href.startsWith('http') ? href : `${window.location.origin}${href}`
      window.location.assign(fullUrl)
    }
  }, [isTelegram])

  const allMenuItems = [
    {
      href: '/admin/dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      gradient: 'from-blue-500 to-indigo-600',
      permission: null
    },
    {
      href: '/admin/users',
      label: 'Kullanıcılar',
      icon: Users,
      gradient: 'from-cyan-500 to-cyan-600',
      permission: 'canAccessUsers'
    },
    {
      href: '/admin/multi-detection',
      label: 'Multi Hesap Tespiti',
      icon: ShieldAlert,
      gradient: 'from-red-500 to-red-600',
      permission: 'canAccessUsers'
    },
    {
      href: '/admin/tasks',
      label: 'Görevler',
      icon: FileText,
      gradient: 'from-indigo-500 to-indigo-600',
      permission: 'canAccessTasks'
    },
    {
      href: '/admin/shop',
      label: 'Market',
      icon: ShoppingCart,
      gradient: 'from-emerald-500 to-emerald-600',
      permission: 'canAccessShop'
    },
    {
      href: '/admin/wheel',
      label: 'Çark',
      icon: Ticket,
      gradient: 'from-orange-500 to-orange-600',
      permission: 'canAccessWheel'
    },
    {
      href: '/admin/tickets',
      label: 'Biletler',
      icon: TicketCheck,
      gradient: 'from-rose-500 to-rose-600',
      permission: 'canAccessTickets'
    },
    {
      href: '/admin/events',
      label: 'Etkinlikler',
      icon: Calendar,
      gradient: 'from-purple-500 to-purple-600',
      permission: 'canAccessEvents'
    },
    {
      href: '/admin/promocodes',
      label: 'Promocodlar',
      icon: Gift,
      gradient: 'from-teal-500 to-teal-600',
      permission: 'canAccessPromocodes'
    },
    {
      href: '/admin/sponsors',
      label: 'Sponsorlar',
      icon: Heart,
      gradient: 'from-pink-500 to-pink-600',
      permission: 'canAccessSponsors'
    },
    {
      href: '/admin/promotions',
      label: 'Bonuslar & Promosyonlar',
      icon: Sparkles,
      gradient: 'from-amber-500 to-orange-600',
      permission: 'canAccessSponsors'
    },
    {
      href: '/admin/ads',
      label: 'Reklamlar',
      icon: MonitorPlay,
      gradient: 'from-violet-500 to-violet-600',
      permission: 'canAccessAds'
    },
    {
      href: '/admin/ranks',
      label: 'Rütbeler',
      icon: Shield,
      gradient: 'from-yellow-500 to-yellow-600',
      permission: 'canAccessRanks'
    },
    {
      href: '/admin/admins',
      label: 'Adminler',
      icon: UserCog,
      gradient: 'from-red-500 to-red-600',
      permission: 'canAccessAdmins'
    },
    {
      href: '/admin/activity-logs',
      label: 'Aktivite Logları',
      icon: Activity,
      gradient: 'from-cyan-500 to-teal-600',
      permission: 'canAccessActivityLogs'
    },
    {
      href: '/admin/groups',
      label: 'Bot Yönetimi',
      icon: Users2,
      gradient: 'from-sky-500 to-sky-600',
      permission: 'canAccessSettings'
    },
    {
      href: '/admin/short-links',
      label: 'Kısa Linkler',
      icon: Link2,
      gradient: 'from-teal-500 to-teal-600',
      permission: 'canAccessSettings'
    },
    {
      href: '/admin/bot-settings',
      label: 'Bot Ayarları',
      icon: Bot,
      gradient: 'from-violet-500 to-violet-600',
      permission: 'canAccessSettings'
    }
  ]

  // Filter menu items based on permissions
  const menuItems = allMenuItems.filter(item => {
    if (!adminInfo) return false
    if (item.permission === null) return true // Dashboard is always visible
    if (adminInfo.isSuperAdmin) return true
    return adminInfo.permissions[item.permission] === true
  })

  async function handleLogout() {
    try {
      // API'ye logout isteği gönder (session tablosundan siler)
      await fetch('/api/admin/logout', {
        method: 'POST'
      })
    } catch (error) {
      console.error('Logout error:', error)
    }

    // LocalStorage'dan token'ı temizle
    localStorage.removeItem('admin_token')
    router.push('/admin')
  }

  return (
    <>
      {/* Mobile Hamburger Button */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="lg:hidden fixed top-3 left-3 z-50 p-2 rounded-xl bg-slate-900 border border-slate-700 text-gray-100 hover:bg-slate-800 transition-all shadow-lg"
      >
        {isMobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-30"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Desktop Sidebar */}
      <aside
        className="hidden lg:flex fixed left-0 top-0 h-screen bg-slate-900 border-r border-slate-700 flex-col z-40 w-64 overflow-hidden"
      >
        {/* Admin Info */}
        <div className="p-6 border-b border-slate-700 flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-100 whitespace-nowrap mb-3">Admin Panel</h2>
          {adminInfo && (
            <div className="text-sm">
              <p className="font-semibold text-gray-100 truncate">{adminInfo.username}</p>
              {adminInfo.isSuperAdmin && (
                <p className="text-yellow-400 text-xs mt-1">Ana Admin</p>
              )}
            </div>
          )}
        </div>

        {/* Menu Items */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto min-h-0">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={(e) => handleNavigation(e, item.href)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                  isActive
                    ? `bg-gradient-to-r ${item.gradient} shadow-lg`
                    : 'hover:bg-slate-800 hover:shadow-md'
                }`}
                title={item.label}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-gray-300 group-hover:text-white'}`} />
                <span className={`font-medium whitespace-nowrap ${isActive ? 'text-white' : 'text-gray-300 group-hover:text-white'}`}>
                  {item.label}
                </span>
              </Link>
            )
          })}
        </nav>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-700 space-y-2 flex-shrink-0">
          <Link href="/admin/profile" onClick={(e) => handleNavigation(e, '/admin/profile')}>
            <Button variant="outline" className="w-full border-slate-600 hover:bg-slate-800 text-gray-200 justify-start">
              <User className="w-4 h-4 mr-2" />
              Profil
            </Button>
          </Link>
          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full border-red-500/30 hover:bg-red-500/10 text-red-400 hover:text-red-300 justify-start"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Çıkış Yap
          </Button>
        </div>
      </aside>

      {/* Mobile Sidebar */}
      <aside
        className={`lg:hidden flex fixed left-0 top-0 h-screen w-64 bg-slate-900 border-r border-slate-700 flex-col z-40 transition-transform duration-300 ease-in-out overflow-hidden ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Admin Info */}
        <div className="p-6 border-b border-slate-700 pt-16 flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-100 mb-3">Admin Panel</h2>
          {adminInfo && (
            <div className="text-sm">
              <p className="font-semibold text-gray-100 truncate">{adminInfo.username}</p>
              {adminInfo.isSuperAdmin && (
                <p className="text-yellow-400 text-xs mt-1">Ana Admin</p>
              )}
            </div>
          )}
        </div>

        {/* Menu Items */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto min-h-0">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={(e) => {
                  setIsMobileOpen(false)
                  handleNavigation(e, item.href)
                }}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                  isActive
                    ? `bg-gradient-to-r ${item.gradient} shadow-lg`
                    : 'hover:bg-slate-800 hover:shadow-md'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-300 group-hover:text-white'}`} />
                <span className={`font-medium ${isActive ? 'text-white' : 'text-gray-300 group-hover:text-white'}`}>
                  {item.label}
                </span>
              </Link>
            )
          })}
        </nav>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-700 space-y-2 flex-shrink-0">
          <Link
            href="/admin/profile"
            onClick={(e) => {
              setIsMobileOpen(false)
              handleNavigation(e, '/admin/profile')
            }}
          >
            <Button
              variant="outline"
              className="w-full border-slate-600 hover:bg-slate-800 text-gray-200 justify-start"
            >
              <User className="w-4 h-4 mr-2" />
              Profil
            </Button>
          </Link>
          <Button
            onClick={() => {
              handleLogout()
              setIsMobileOpen(false)
            }}
            variant="outline"
            className="w-full border-red-500/30 hover:bg-red-500/10 text-red-400 hover:text-red-300 justify-start"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Çıkış Yap
          </Button>
        </div>
      </aside>
    </>
  )
}
