'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Image from 'next/image'
import { useUserTheme } from '@/components/providers/user-theme-provider'
import { ensureAbsoluteUrl, optimizeCloudinaryImage } from '@/lib/utils'

interface BannerData {
  enabled: boolean
  imageUrl: string
  mobileImageUrl?: string
  sponsorId: string
  sponsor: {
    id: string
    name: string
    websiteUrl?: string
  } | null
}

export default function YatayBanner() {
  const { theme } = useUserTheme()
  const [isClient, setIsClient] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  const { data: bannerData, isLoading } = useQuery({
    queryKey: ['yatayBanner'],
    queryFn: async (): Promise<BannerData> => {
      const res = await fetch('/api/settings/yatay-banner')
      return res.json()
    },
    staleTime: 1000 * 60 * 5, // 5 dakika - diğer banner/sponsor sorgularıyla tutarlı
  })

  useEffect(() => {
    setIsClient(true)

    // Ekran boyutunu kontrol et
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024) // lg breakpoint
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)

    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  function handleClick() {
    if (!bannerData?.sponsor?.websiteUrl) return

    // Tracking
    if (bannerData.sponsor.id) {
      const data = JSON.stringify({ sponsorId: bannerData.sponsor.id })

      if (navigator.sendBeacon) {
        const blob = new Blob([data], { type: 'application/json' })
        navigator.sendBeacon('/api/sponsors/click', blob)
      } else {
        fetch('/api/sponsors/click', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: data,
          keepalive: true
        }).catch(() => {})
      }
    }

    window.open(ensureAbsoluteUrl(bannerData.sponsor.websiteUrl), '_blank', 'noopener,noreferrer')
  }

  // Return null while loading - GlobalPreloader handles the loading UI
  if (!isClient || isLoading || !bannerData?.enabled || !bannerData?.imageUrl) {
    return null
  }

  // Mobilde mobileImageUrl varsa onu kullan, yoksa imageUrl kullan
  const currentImageUrl = isMobile && bannerData.mobileImageUrl
    ? bannerData.mobileImageUrl
    : bannerData.imageUrl

  const isGif = currentImageUrl.toLowerCase().endsWith('.gif')

  return (
    <div
      className="w-full lg:w-[calc(100%-16rem)] lg:ml-64"
      style={{
        background: `linear-gradient(to right, ${theme.colors.background}, ${theme.colors.backgroundSecondary}, ${theme.colors.background})`,
        borderBottomWidth: 1,
        borderColor: theme.colors.border
      }}
    >
      <div
        onClick={handleClick}
        className={`relative w-full h-16 sm:h-20 md:h-24 overflow-hidden ${bannerData.sponsor?.websiteUrl ? 'cursor-pointer' : ''}`}
        title={bannerData.sponsor?.name ? `${bannerData.sponsor.name} - Tıklayın` : ''}
        style={isGif ? { willChange: 'transform', transform: 'translateZ(0)', contain: 'paint' } : undefined}
      >
        <Image
          src={isGif ? currentImageUrl : optimizeCloudinaryImage(currentImageUrl, 1600, 200)}
          alt={bannerData.sponsor?.name || 'Sponsor Banner'}
          fill
          className="object-contain"
          priority
          unoptimized
        />
      </div>
    </div>
  )
}
