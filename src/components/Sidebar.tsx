'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useCallback, useId, useTransition } from 'react'
import {
  Home,
  ShoppingBag,
  FileText,
  Users,
  Ticket,
  Trophy,
  Heart,
  Wallet,
  Menu,
  X,
  TicketCheck,
  Calendar,
  Loader2,
  Gift,
  Sparkles,
  Repeat,
  BookOpen
} from 'lucide-react'
import { useSocialMedia } from '@/lib/hooks/useSocialMedia'
import { useUserTheme } from '@/components/providers/user-theme-provider'
import { useAuth } from '@/components/providers/auth-provider'

interface SocialMedia {
  id: string
  name: string
  platform: string
  username: string
  order: number
}

// ✅ OPTIMIZASYON: Social media icon'ları SVG component olarak
const SocialIcon = ({ platform, className }: { platform: string, className?: string }) => {
  const iconClass = className || "w-5 h-5"
  const uniqueId = useId()
  const gradientId = `ig-gradient${uniqueId}`

  // Platform bazlı renkler
  const getColor = () => {
    switch (platform.toLowerCase()) {
      case 'telegram': return '#0088cc'
      case 'instagram': return '#E4405F'
      case 'twitter': return '#1DA1F2'
      case 'youtube': return '#FF0000'
      case 'discord': return '#5865F2'
      case 'tiktok': return '#000000'
      case 'facebook': return '#1877F2'
      case 'whatsapp': return '#25D366'
      case 'linkedin': return '#0A66C2'
      case 'twitch': return '#9146FF'
      default: return 'currentColor'
    }
  }

  switch (platform.toLowerCase()) {
    case 'telegram':
      return (
        <svg className={iconClass} fill={getColor()} viewBox="0 0 24 24">
          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z"/>
        </svg>
      )
    case 'instagram':
      return (
        <svg className={iconClass} viewBox="0 0 24 24">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" style={{ stopColor: '#FED373' }} />
              <stop offset="15%" style={{ stopColor: '#F15245' }} />
              <stop offset="30%" style={{ stopColor: '#D92E7F' }} />
              <stop offset="50%" style={{ stopColor: '#9B36B7' }} />
              <stop offset="85%" style={{ stopColor: '#515ECF' }} />
            </linearGradient>
          </defs>
          <path fill={`url(#${gradientId})`} d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
        </svg>
      )
    case 'twitter':
      return (
        <svg className={iconClass} fill={getColor()} viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      )
    case 'youtube':
      return (
        <svg className={iconClass} fill={getColor()} viewBox="0 0 24 24">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
        </svg>
      )
    case 'discord':
      return (
        <svg className={iconClass} fill={getColor()} viewBox="0 0 24 24">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
        </svg>
      )
    case 'tiktok':
      return (
        <svg className={iconClass} fill={getColor()} viewBox="0 0 24 24">
          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
        </svg>
      )
    case 'facebook':
      return (
        <svg className={iconClass} fill={getColor()} viewBox="0 0 24 24">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      )
    case 'whatsapp':
      return (
        <svg className={iconClass} fill={getColor()} viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
        </svg>
      )
    case 'linkedin':
      return (
        <svg className={iconClass} fill={getColor()} viewBox="0 0 24 24">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
        </svg>
      )
    case 'twitch':
      return (
        <svg className={iconClass} fill={getColor()} viewBox="0 0 24 24">
          <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/>
        </svg>
      )
    default:
      return null
  }
}

const SOCIAL_ICONS: { [key: string]: any } = {
  telegram: (props: any) => <SocialIcon platform="telegram" {...props} />,
  instagram: (props: any) => <SocialIcon platform="instagram" {...props} />,
  twitter: (props: any) => <SocialIcon platform="twitter" {...props} />,
  youtube: (props: any) => <SocialIcon platform="youtube" {...props} />,
  discord: (props: any) => <SocialIcon platform="discord" {...props} />,
  tiktok: (props: any) => <SocialIcon platform="tiktok" {...props} />,
  facebook: (props: any) => <SocialIcon platform="facebook" {...props} />,
  whatsapp: (props: any) => <SocialIcon platform="whatsapp" {...props} />,
  linkedin: (props: any) => <SocialIcon platform="linkedin" {...props} />,
  twitch: (props: any) => <SocialIcon platform="twitch" {...props} />
}

const SOCIAL_URLS: { [key: string]: (username: string) => string } = {
  telegram: (u) => u.startsWith('http') ? u : `https://t.me/${u}`,
  instagram: (u) => u.startsWith('http') ? u : `https://instagram.com/${u}`,
  twitter: (u) => u.startsWith('http') ? u : `https://twitter.com/${u}`,
  youtube: (u) => u.startsWith('http') ? u : `https://youtube.com/@${u}`,
  discord: (u) => u.startsWith('http') ? u : `https://discord.gg/${u}`,
  tiktok: (u) => u.startsWith('http') ? u : `https://tiktok.com/@${u}`,
  facebook: (u) => u.startsWith('http') ? u : `https://facebook.com/${u}`,
  whatsapp: (u) => u.startsWith('http') ? u : `https://wa.me/${u}`,
  linkedin: (u) => u.startsWith('http') ? u : `https://linkedin.com/in/${u}`,
  twitch: (u) => u.startsWith('http') ? u : `https://twitch.tv/${u}`
}

// ✅ FIX: Telegram detection - senkron kontrol için
function checkIsTelegram(): boolean {
  if (typeof window === 'undefined') return false
  return !!(
    (window as any).Telegram?.WebApp ||
    navigator.userAgent.includes('Telegram') ||
    window.location.href.includes('tgWebAppData')
  )
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null)
  const { theme } = useUserTheme()
  const { user, isAuthenticated } = useAuth()

  // ✅ FIX: Telegram detection - initial value senkron olarak hesapla
  const [isTelegram, setIsTelegram] = useState(() => {
    if (typeof window === 'undefined') return false
    return checkIsTelegram()
  })

  // ✅ Telegram WebApp ortamını client-side'da tekrar kontrol et
  useEffect(() => {
    setIsTelegram(checkIsTelegram())
  }, [])

  // ✅ OPTIMIZASYON: React Query hook - Her mount'ta fetch yerine cache kullan
  const { data: socialMedia = [] } = useSocialMedia()

  // ✅ FIX: Daha güvenilir navigasyon handler
  const handleNavigation = useCallback((e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    // Eğer zaten aynı sayfadaysak, hiçbir şey yapma
    if (pathname === href) {
      e.preventDefault()
      setIsMobileOpen(false)
      return
    }

    // Loading state'i göster
    setNavigatingTo(href)

    if (isTelegram) {
      // Telegram WebApp'te özel navigasyon
      e.preventDefault()
      e.stopPropagation()

      // Önce sidebar'ı kapat
      setIsMobileOpen(false)

      // Kısa bir gecikme ile navigasyon yap (UI güncellemesine izin ver)
      requestAnimationFrame(() => {
        const fullUrl = href.startsWith('http') ? href : `${window.location.origin}${href}`
        window.location.href = fullUrl
      })
    } else {
      // Normal tarayıcı - Next.js router kullan.
      // ✅ FIX: navigatingTo BURADA temizlenmiyor artık - eskiden hemen (aynı tık
      // içinde) temizleniyordu, bu yüzden spinner gerçek geçiş tamamlanmadan
      // kayboluyor ve kullanıcı "tıklama işe yaramadı" hissiyle tekrar tekrar
      // tıklıyordu. Artık sadece aşağıdaki effect (pathname gerçekten değişince)
      // ya da güvenlik zaman aşımı temizliyor.
      setIsMobileOpen(false)
      // Link bileşeni kendi navigasyonunu yapıyor; startTransition sadece
      // React'a bu state güncellemesinin düşük öncelikli olduğunu söylüyor.
      startTransition(() => {})
    }
  }, [isTelegram, pathname])

  // Navigasyon tamamlandığında loading state'i temizle
  useEffect(() => {
    if (navigatingTo && pathname === navigatingTo) {
      setNavigatingTo(null)
    }
  }, [pathname, navigatingTo])

  // ✅ FIX: Mobil menü açıkken arka plandaki sayfa kaymasın - hem daha temiz
  // bir davranış, hem de arka planın kayması yüzünden kapatma dokunuşunun
  // yanlış elemana denk gelme ihtimalini ortadan kaldırıyor.
  useEffect(() => {
    if (isMobileOpen) {
      const previousOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = previousOverflow
      }
    }
  }, [isMobileOpen])

  // ✅ FIX: Sayfa (pathname) her ne sebeple değişirse değişsin mobil menü
  // güvenlik ağı olarak kapansın - tek tıklama handler'ına bağımlı kalınmasın.
  useEffect(() => {
    setIsMobileOpen(false)
  }, [pathname])

  // ✅ FIX: Güvenlik zaman aşımı - navigasyon herhangi bir sebeple
  // tamamlanmazsa (yavaş ağ, hata vb.) spinner sonsuza kadar takılı kalmasın
  useEffect(() => {
    if (!navigatingTo) return
    const timeout = setTimeout(() => setNavigatingTo(null), 8000)
    return () => clearTimeout(timeout)
  }, [navigatingTo])

  const menuGroups = [
    {
      label: 'Genel',
      items: [
        { href: '/', label: 'Ana Sayfa', icon: Home, active: pathname === '/' },
      ],
    },
    {
      label: 'Kazan',
      items: [
        { href: '/cark', label: 'Çark', icon: Ticket, active: pathname === '/cark' },
        { href: '/gorevler', label: 'Görevler', icon: FileText, active: pathname === '/gorevler' },
        { href: '/market', label: 'Mağaza', icon: ShoppingBag, active: pathname === '/market' },
      ],
    },
    {
      label: 'Etkinlikler',
      items: [
        { href: '/etkinlikler', label: 'Etkinlikler', icon: Calendar, active: pathname === '/etkinlikler' },
        { href: '/biletler', label: 'Biletler', icon: TicketCheck, active: pathname === '/biletler' },
      ],
    },
    {
      label: 'Bonuslar',
      items: [
        { href: '/deneme-bonuslari', label: 'Deneme Bonusları', icon: Gift, active: pathname === '/deneme-bonuslari' },
        { href: '/promosyonlar', label: 'Promosyonlar', icon: Sparkles, active: pathname === '/promosyonlar' },
        { href: '/profil/sponsorlar', label: 'Aff Geçiş', icon: Repeat, active: pathname === '/profil/sponsorlar' },
      ],
    },
    {
      label: 'Topluluk',
      items: [
        { href: '/liderlik', label: 'Liderlik', icon: Trophy, active: pathname === '/liderlik' },
        { href: '/rehber', label: 'Rehber', icon: BookOpen, active: pathname === '/rehber' },
      ],
    },
  ]

  // ✅ FIX: transform: translateZ(0) buradan kaldırıldı. Bu inline style,
  // mobil sidebar'ın açılıp kapanmasını sağlayan Tailwind'in translate-x-0 /
  // -translate-x-full class'larıyla AYNI CSS özelliğini (transform) hedefliyordu.
  // Inline style her zaman class'ları ezdiği için mobil menü görsel olarak asla
  // gerçekten kapanmıyordu (translateZ(0) sabit kalıyor, translate-x class'ları
  // hiç uygulanamıyordu) - "menü kapanmıyor" şikayetinin asıl sebebi buydu.
  const sidebarStyle = {
    backgroundColor: `${theme.colors.background}f2`,
    borderRight: `1px solid ${theme.colors.border}40`,
    contain: 'paint' as const
  }

  // ✅ FIX: Loading indicator for navigation
  const isNavigating = (href: string) => navigatingTo === href || (isPending && navigatingTo === href)

  const rankIcon = (user as any)?.rank?.icon || (user as any)?.currentRank?.icon
  const rankName = (user as any)?.rank?.name || (user as any)?.currentRank?.name

  return (
    <>
      {/* Mobile Hamburger Button - Header'ın üstünde olmalı (z-[60]) */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="lg:hidden fixed top-4 left-3 z-[60] p-2 rounded-xl backdrop-blur-xl transition-all shadow-lg"
        style={{
          backgroundColor: `${theme.colors.backgroundSecondary}f2`,
          border: `1px solid ${theme.colors.border}50`,
          color: theme.colors.text
        }}
      >
        {isMobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Mobile Overlay - backdrop-blur BİLEREK yok: sidebar'ın kayma
          animasyonuyla aynı anda tüm ekranı bulanıklaştırmak mobilde ciddi
          bir kasmaya sebep oluyordu (özellikle zayıf GPU'larda). Sadece
          koyu ton yeterli, neredeyse hiç maliyeti yok. */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 z-30"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Desktop Sidebar - Starts Below Header */}
      <aside
        id="desktop-sidebar"
        className="hidden lg:flex fixed left-0 top-16 lg:top-20 h-[calc(100vh-4rem)] lg:h-[calc(100vh-5rem)] backdrop-blur-sm flex-col z-40 w-64"
        style={sidebarStyle}
      >
        <IdentityCard theme={theme} isAuthenticated={isAuthenticated} user={user} rankIcon={rankIcon} rankName={rankName} />
        <NavGroups theme={theme} menuGroups={menuGroups} isNavigating={isNavigating} handleNavigation={handleNavigation}>
          <SocialRow theme={theme} socialMedia={socialMedia} />
        </NavGroups>
      </aside>

      {/* Mobile Sidebar */}
      <aside
        className={`lg:hidden fixed left-0 top-0 h-screen w-64 backdrop-blur-sm flex flex-col z-40 transition-transform duration-300 ease-in-out ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ ...sidebarStyle, paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="pt-16" />
        <IdentityCard theme={theme} isAuthenticated={isAuthenticated} user={user} rankIcon={rankIcon} rankName={rankName} />
        <NavGroups theme={theme} menuGroups={menuGroups} isNavigating={isNavigating} handleNavigation={handleNavigation} onItemClick={() => setIsMobileOpen(false)}>
          <SocialRow theme={theme} socialMedia={socialMedia} onItemClick={() => setIsMobileOpen(false)} />
        </NavGroups>
      </aside>
    </>
  )
}

// ============================================================
// ✅ FIX: Aşağıdaki üç bileşen artık Sidebar() FONKSİYONUNUN DIŞINDA,
// modül seviyesinde tanımlı. Eskiden Sidebar'ın içinde tanımlıydılar -
// bu, Sidebar her re-render olduğunda (örn. bir menü linkine tıklayıp
// navigatingTo state'i değiştiğinde) bu bileşenlerin YENİ birer fonksiyon
// referansı olarak görülmesine yol açıyordu. React bunu "farklı bileşen
// türü" sayıp tüm menü DOM ağacını SÖKÜP YENİDEN KURUYORDU - tam da
// kullanıcının tıkladığı <Link> elementinin ortasında. Bu yüzden
// tıklama bazen navigasyonu tamamlayamadan kesiliyordu (ikon dönüyor,
// sayfa açılmıyordu). Modül seviyesinde tanımlı olduklarında referansları
// SABİT kalıyor, bu sorun ortadan kalkıyor.
// ============================================================

function IdentityCard({
  theme, isAuthenticated, user, rankIcon, rankName,
}: {
  theme: any
  isAuthenticated: boolean
  user: any
  rankIcon: string | undefined
  rankName: string | undefined
}) {
  if (!isAuthenticated || !user) return null

  return (
    <div
      className="mx-4 mt-4 mb-2 rounded-2xl p-3 flex items-center gap-3"
      style={{
        background: `linear-gradient(135deg, ${theme.colors.primary}22, ${theme.colors.accent}18)`,
        border: `1px solid ${theme.colors.primary}35`,
      }}
    >
      <div
        className="w-11 h-11 rounded-full flex items-center justify-center text-lg flex-shrink-0 shadow-lg"
        style={{
          background: `linear-gradient(135deg, ${theme.colors.gradientFrom}, ${theme.colors.gradientTo})`,
          boxShadow: `0 0 0 2px ${theme.colors.background}, 0 0 0 3.5px ${theme.colors.primary}55`,
        }}
      >
        {rankIcon || '⭐'}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold truncate font-display" style={{ color: theme.colors.text }}>
          {rankName || 'Üye'}
        </p>
        <p className="text-[11px] font-data" style={{ color: theme.colors.textMuted }}>
          {(user.points ?? 0).toLocaleString('tr-TR')} puan
        </p>
      </div>
    </div>
  )
}

function NavGroups({
  theme, menuGroups, isNavigating, handleNavigation, onItemClick, children,
}: {
  theme: any
  menuGroups: { label: string; items: { href: string; label: string; icon: any; active: boolean }[] }[]
  isNavigating: (href: string) => boolean
  handleNavigation: (e: React.MouseEvent<HTMLAnchorElement>, href: string) => void
  onItemClick?: () => void
  children?: React.ReactNode
}) {
  const router = useRouter()
  // 🚀 Sayfa açılır açılmaz TÜM linkleri önden yüklemek (prefetch) kasmaya
  // sebep oluyordu (bkz. eski not) - o yüzden kapatılmıştı. Ama tamamen
  // kapatınca da her tıklama sıfırdan yüklenip yavaş hissettiriyordu. Orta
  // yol: kullanıcı linkin üzerine gelince (mouse) ya da dokununca (mobil)
  // SADECE O linki önden yüklüyoruz - kasma yok (aynı anda hepsi değil),
  // ama tıklayınca da hızlı açılıyor (niyet belli olunca önceden hazır).
  const prefetchOnIntent = (href: string) => {
    router.prefetch(href)
  }

  return (
    <nav className="flex-1 min-h-0 px-3 py-2 space-y-5 overflow-y-auto" style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}>
      {menuGroups.map((group) => (
        <div key={group.label}>
          <p
            className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-wider"
            style={{ color: theme.colors.textMuted }}
          >
            {group.label}
          </p>
          <div className="space-y-1">
            {group.items.map((item) => {
              const Icon = item.icon
              const loading = isNavigating(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  onMouseEnter={() => prefetchOnIntent(item.href)}
                  onTouchStart={() => prefetchOnIntent(item.href)}
                  onClick={(e) => {
                    handleNavigation(e, item.href)
                    onItemClick?.()
                  }}
                  className={`relative flex items-center gap-3 pl-3 pr-3 py-2.5 rounded-lg transition-all duration-150 group ${loading ? 'opacity-70' : ''}`}
                  style={
                    item.active
                      ? { background: `${theme.colors.primary}15` }
                      : undefined
                  }
                  title={item.label}
                >
                  {loading ? (
                    <Loader2 className="w-[18px] h-[18px] animate-spin flex-shrink-0" style={{ color: item.active ? theme.colors.primary : theme.colors.textMuted }} />
                  ) : (
                    <Icon className="w-[18px] h-[18px] flex-shrink-0" style={{ color: item.active ? theme.colors.primary : theme.colors.textMuted }} />
                  )}
                  <span
                    className="font-medium text-sm whitespace-nowrap transition-colors"
                    style={{ color: item.active ? theme.colors.text : theme.colors.textSecondary }}
                  >
                    {item.label}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      ))}
      {children}
    </nav>
  )
}

function SocialRow({
  theme, socialMedia, onItemClick,
}: {
  theme: any
  socialMedia: SocialMedia[]
  onItemClick?: () => void
}) {
  if (socialMedia.length === 0) return null

  return (
    <div className="px-3 py-3 space-y-1" style={{ borderTop: `1px solid ${theme.colors.border}40` }}>
      {socialMedia.map((social) => {
        const Icon = SOCIAL_ICONS[social.platform]
        const url = SOCIAL_URLS[social.platform]?.(social.username) || '#'
        return (
          <a
            key={social.id}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onItemClick}
            className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition-colors hover:bg-white/5"
          >
            <span
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: theme.colors.card, border: `1px solid ${theme.colors.border}` }}
            >
              {Icon && <Icon className="w-3.5 h-3.5" />}
            </span>
            <span className="text-xs font-medium truncate" style={{ color: theme.colors.textSecondary }}>
              {social.name}
            </span>
          </a>
        )
      })}
    </div>
  )
}
