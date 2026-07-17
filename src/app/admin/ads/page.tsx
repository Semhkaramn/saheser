'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MonitorPlay, Share2 } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import BannerSettings from '@/components/admin/ads/BannerSettings'
import YatayBannerSettings from '@/components/admin/ads/YatayBannerSettings'
import SideBannerSettings from '@/components/admin/ads/SideBannerSettings'
import SocialMediaSettings from '@/components/admin/ads/SocialMediaSettings'
import PopupSettings from '@/components/admin/ads/PopupSettings'

// Bu sayfa eskiden ~1850 satırdı: 5 birbirinden bağımsız ayar paneli
// (Banner, Yatay Banner, Yan Banner, Sosyal Medya, Popup) tek dosyada
// üst üste tanımlıydı. Her biri artık kendi dosyasında
// (src/components/admin/ads/*.tsx) - bu sayfa sadece sekme kabuğu.
export default function AdminAdsPage() {
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (!token) {
      router.push('/admin')
    }
  }, [])

  return (
    <div className="admin-page-container">
      <div className="admin-page-inner">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="admin-page-title flex items-center gap-2">
              <MonitorPlay className="w-8 h-8" />
              Reklam Alanı Yönetimi
            </h1>
            <p className="admin-page-subtitle">Sponsor banner, sosyal medya ve popup yönetimi</p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="banner" className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 bg-white/5 h-auto gap-1 p-1">
            <TabsTrigger value="banner" className="text-xs sm:text-sm py-2">Kayan Banner</TabsTrigger>
            <TabsTrigger value="yataybanner" className="text-xs sm:text-sm py-2">Yatay Banner</TabsTrigger>
            <TabsTrigger value="sidebanner" className="text-xs sm:text-sm py-2">Yan Bannerlar</TabsTrigger>
            <TabsTrigger value="social" className="text-xs sm:text-sm py-2">
              <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2 flex-shrink-0" />
              Sosyal Medya
            </TabsTrigger>
            <TabsTrigger value="popup" className="text-xs sm:text-sm py-2">Popup Ayarları</TabsTrigger>
          </TabsList>

          {/* Banner Tab */}
          <TabsContent value="banner" className="space-y-6 mt-6">
            <BannerSettings />
          </TabsContent>

          {/* Yatay Banner Tab */}
          <TabsContent value="yataybanner" className="space-y-6 mt-6">
            <YatayBannerSettings />
          </TabsContent>

          {/* Side Banner Tab */}
          <TabsContent value="sidebanner" className="space-y-6 mt-6">
            <SideBannerSettings />
          </TabsContent>

          {/* Social Media Tab */}
          <TabsContent value="social" className="space-y-6 mt-6">
            <SocialMediaSettings />
          </TabsContent>

          {/* Popup Tab */}
          <TabsContent value="popup" className="space-y-6 mt-6">
            <PopupSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
