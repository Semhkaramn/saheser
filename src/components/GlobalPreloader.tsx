'use client'
import { useEffect, useState, useLayoutEffect } from 'react'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { SITE_CONFIG } from '@/lib/site-config'
import { getActiveTheme } from '@/config/themes'

/**
 * Global Preloader - Sadece ilk site yüklemesinde gösterilir
 *
 * - Admin sayfalarında gösterilmez
 * - Session boyunca sadece 1 kez gösterilir
 * - Logo animasyonlu splash screen
 * - ✅ FIX: contentReady event beklemek yerine daha hızlı bir yaklaşım
 */
export default function GlobalPreloader() {
  const [isLoading, setIsLoading] = useState(true)
  // FIX: Başlangıçta true - preloader varsayılan olarak gösterilir
  const [shouldShow, setShouldShow] = useState(true)
  const pathname = usePathname()
  const theme = getActiveTheme()

  // ✅ FIX: Daha kısa minimum süre (daha hızlı yükleme hissi)
  const MINIMUM_LOADING_TIME = 500 // 0.5 saniye minimum (0.8'den düşürüldü)

  useLayoutEffect(() => {
    // Admin sayfalarında preloader gösterme
    if (pathname?.startsWith('/admin')) {
      setIsLoading(false)
      setShouldShow(false)
      return
    }

    // Session'da daha önce yüklendi mi kontrol et
    try {
      const hasLoaded = sessionStorage.getItem('site_preloader_shown')
      if (hasLoaded) {
        // Daha önce yüklendi, preloader gösterme
        setIsLoading(false)
        setShouldShow(false)
        return
      }
    } catch {
      // sessionStorage erişim hatası (örn. private mode)
      setIsLoading(false)
      setShouldShow(false)
      return
    }

    // İlk yükleme - preloader göster (shouldShow zaten true)
    const startTime = Date.now()
    // Sadece ana sayfa (/) 'contentReady' gönderiyor (sponsor logoları + banner
    // görselleri gerçekten yüklenince). Başka bir sayfadan ilk giriş yapıldıysa
    // (örn. derin link ile /profile) bu event hiç gelmeyecek - o yüzden sadece
    // ana sayfadayken bunu zorunlu tutuyoruz, diğer sayfalarda eskisi gibi
    // sadece window 'load' yeterli.
    const needsContentReady = pathname === '/'
    let loadFired = false
    let contentReady = !needsContentReady
    let hidden = false

    const hidePreloader = () => {
      if (hidden) return
      hidden = true
      const elapsedTime = Date.now() - startTime
      const remainingTime = Math.max(0, MINIMUM_LOADING_TIME - elapsedTime)

      // Minimum süre dolana kadar bekle, sonra kapat
      setTimeout(() => {
        setIsLoading(false)
        // Session'a kaydet - bu oturumda tekrar gösterme
        try {
          sessionStorage.setItem('site_preloader_shown', 'true')
        } catch {
          // sessionStorage yazma hatası - yoksay
        }
      }, remainingTime)
    }

    // ✅ İki koşul birden sağlanmadan splash kapanmaz:
    //   1) window 'load' - tüm ilk HTML/CSS/JS/resimler tarayıcı seviyesinde bitti
    //   2) 'contentReady' - sayfanın kendisi (örn. ana sayfa) sponsor logoları +
    //      banner görselleri dahil GERÇEKTEN her şeyin yüklendiğini bildirdi.
    // Böylece splash kapandığında kaydırırken hiçbir görsel "sonradan" gelmiyor.
    // Ana sayfa dışında bir sayfa ilk açılışsa (contentReady hiç gelmeyebilir),
    // aşağıdaki fallback zamanlayıcı sonsuza kadar beklemeyi engelliyor.
    const maybeHide = () => {
      if (loadFired && contentReady) hidePreloader()
    }

    const handleContentReady = () => {
      contentReady = true
      maybeHide()
    }
    window.addEventListener('contentReady', handleContentReady)

    if (document.readyState === 'complete') {
      loadFired = true
      maybeHide()
    } else {
      const handleLoad = () => {
        loadFired = true
        maybeHide()
      }
      window.addEventListener('load', handleLoad)

      // Fallback: maksimum 5 saniye sonra zorla kapat - contentReady hiç
      // gelmeyen sayfalarda (ana sayfa olmayan ilk giriş) sonsuza kadar
      // beklememesi için.
      const fallbackTimer = setTimeout(() => {
        hidePreloader()
      }, 5000)

      return () => {
        window.removeEventListener('load', handleLoad)
        window.removeEventListener('contentReady', handleContentReady)
        clearTimeout(fallbackTimer)
      }
    }

    // document.readyState zaten 'complete' ise ve contentReady hiç gelmezse
    // (ana sayfa dışı ilk giriş) yine 5sn'yi geçmeyelim.
    const fallbackTimer = setTimeout(() => {
      hidePreloader()
    }, 5000)

    return () => {
      window.removeEventListener('contentReady', handleContentReady)
      clearTimeout(fallbackTimer)
    }
    // ✅ FIX: Bağımlılık dizisi bilerek [] - bu bileşen root layout'ta TEK SEFER
    // mount oluyor ve sayfa geçişlerinde yeniden mount olmuyor. Eskiden [pathname]
    // idi; bu yüzden HER sayfa geçişinde bu efekt yeniden tetikleniyor, splash
    // ekranı (pointerEvents:'auto', tüm ekranı kaplayan bir overlay) kısa süreliğine
    // yeniden beliriyor ve menüden bir sayfaya tıklayınca "ikon dönüyor ama sayfa
    // açılmıyor" hissi veriyordu - aslında sayfa açılıyordu ama üstünde görünmez/yarı
    // saydam bir overlay kalıyordu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Admin sayfası veya daha önce gösterildi
  if (!shouldShow || !isLoading) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{
        background: `linear-gradient(135deg, ${theme.colors.background} 0%, ${theme.colors.backgroundSecondary} 50%, ${theme.colors.background} 100%)`,
        opacity: isLoading ? 1 : 0,
        transition: 'opacity 0.3s ease-out',
        pointerEvents: isLoading ? 'auto' : 'none'
      }}
    >
      {/* Animated background glow effects */}
      <div
        className="absolute w-[500px] h-[500px] md:w-[600px] md:h-[600px] rounded-full blur-[100px] animate-pulse"
        style={{
          backgroundColor: `${theme.colors.primary}15`,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)'
        }}
      />

      {/* Secondary glow */}
      <div
        className="absolute w-64 h-64 md:w-80 md:h-80 rounded-full blur-[80px] opacity-50"
        style={{
          backgroundColor: `${theme.colors.accent || theme.colors.primary}20`,
          top: '45%',
          left: '55%',
          transform: 'translate(-50%, -50%)',
          animation: 'pulse 2s ease-in-out infinite alternate'
        }}
      />

      {/* Logo Container */}
      <div className="relative flex flex-col items-center gap-8 md:gap-10">
        {/* Logo + dönen halka */}
        <div className="relative w-24 h-24 md:w-32 md:h-32 flex items-center justify-center">
          <svg className="absolute inset-0 w-full h-full animate-spin" style={{ animationDuration: '1.4s' }} viewBox="0 0 100 100">
            <circle
              cx="50" cy="50" r="44"
              fill="none"
              stroke={`${theme.colors.primary}20`}
              strokeWidth="4"
            />
            <circle
              cx="50" cy="50" r="44"
              fill="none"
              stroke={theme.colors.primary}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray="60 216"
            />
          </svg>
          <div className="relative w-14 h-14 md:w-20 md:h-20">
            <Image
              src={SITE_CONFIG.siteLogo}
              alt="Logo"
              fill
              className="object-contain relative z-10"
              priority
              sizes="80px"
            />
          </div>
        </div>

        {/* Loading text + ilerleme çubuğu */}
        <div className="flex flex-col items-center gap-3 w-40 md:w-48">
          <p
            className="text-sm md:text-base font-semibold tracking-wide"
            style={{ color: theme.colors.text }}
          >
            Yükleniyor...
          </p>
          <div
            className="w-full h-1 rounded-full overflow-hidden"
            style={{ background: `${theme.colors.primary}15` }}
          >
            <div
              className="h-full rounded-full"
              style={{
                background: `linear-gradient(90deg, ${theme.colors.gradientFrom}, ${theme.colors.gradientTo})`,
                animation: 'loadingBar 1.2s ease-in-out infinite'
              }}
            />
          </div>
        </div>
      </div>

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes loadingBar {
          0% { transform: translateX(-100%); width: 40%; }
          50% { width: 60%; }
          100% { transform: translateX(250%); width: 40%; }
        }
      `}</style>
    </div>
  )
}
