'use client'

import { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import Header from './Header'
import SponsorBanner from './SponsorBanner'
import YatayBanner from './YatayBanner'
import SideBanners from './SideBanners'
import Footer from './Footer'
import { ThemeStyleInjector } from './providers/user-theme-provider'

interface DashboardLayoutProps {
  children: ReactNode
  // Artık opsiyonel: verilmezse pathname'e göre otomatik hesaplanır.
  // (dashboard) route grubu ortak layout kullandığı için sayfa bazlı
  // prop geçmeye gerek kalmadı, ama geriye dönük uyumluluk için duruyor.
  showSponsorBanner?: boolean
  showYatayBanner?: boolean
}

// Sponsor banner'ı sadece ana sayfada gösterilir
const SPONSOR_BANNER_PATHS = ['/']

// ✅ FIX: Yatay banner artık TÜM dashboard sayfalarında gösteriliyor (detay
// sayfaları dahil) - eskiden sadece belirli üst seviye sayfalarda gösterilip
// diğerlerinde gizleniyordu, bu da sayfalar arası geçişte banner'ın sürekli
// unmount/mount olup "her seferinde yeniden yükleniyor" hissi vermesine
// sebep oluyordu. Artık hep aynı DOM'da kalıyor, hiç unmount olmuyor.
const YATAY_BANNER_PATHS: string[] | null = null // null = her sayfada göster

// ✅ FIX: UserThemeProvider kaldırıldı - zaten layout.tsx'de var (duplicate provider sorunu)
export default function DashboardLayout({ children, showSponsorBanner, showYatayBanner }: DashboardLayoutProps) {
  const pathname = usePathname()

  const resolvedShowSponsorBanner = showSponsorBanner ?? SPONSOR_BANNER_PATHS.includes(pathname)
  const resolvedShowYatayBanner = showYatayBanner ?? (YATAY_BANNER_PATHS === null ? true : YATAY_BANNER_PATHS.includes(pathname))

  return (
    <>
      <ThemeStyleInjector />
      <div className="min-h-screen flex flex-col overflow-x-hidden max-w-full">
        <Header />
        <Sidebar />

        {/* Header fixed olduğu için içeriğe padding-top ekliyoruz */}
        <div className="flex-1 flex flex-col transition-all duration-300 overflow-x-hidden pt-16 lg:pt-20">
          {/* Banner'lar sidebar'ın sağında görünecek şekilde */}
          {resolvedShowSponsorBanner && <SponsorBanner />}
          {resolvedShowYatayBanner && <YatayBanner />}

          <main className="flex-1 flex flex-col relative lg:ml-64 overflow-x-hidden max-w-full">
            {/* Content - yan bannerlar artık ana sayfa gibi HER sayfada sarıyor */}
            <div className="relative z-10 flex-1 flex flex-col">
              <div className="flex-1">
                <SideBanners>
                  {children}
                </SideBanners>
              </div>
              <Footer />
            </div>
          </main>
        </div>
      </div>
    </>
  )
}
