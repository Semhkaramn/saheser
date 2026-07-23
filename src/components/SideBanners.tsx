'use client'

import { useQuery } from '@tanstack/react-query'
import Image from 'next/image'
import { useUserTheme } from './providers/user-theme-provider'
import { ensureAbsoluteUrl } from '@/lib/utils'

interface BannerData {
  imageUrl: string
  sponsorId: string
  enabled: boolean
}

interface BannerSponsor {
  id: string
  name: string
  websiteUrl?: string
}

interface BannerConfig {
  leftBanner: BannerData | null
  leftSponsor: BannerSponsor | null
  rightBanner: BannerData | null
  rightSponsor: BannerSponsor | null
}

async function fetchBanners(): Promise<BannerConfig> {
  try {
    const bannersRes = await fetch('/api/settings/banners')
    const bannersData = await bannersRes.json()

    return {
      leftBanner: bannersData.left ? {
        enabled: true,
        imageUrl: bannersData.left.imageUrl,
        sponsorId: bannersData.left.sponsorId
      } : null,
      leftSponsor: bannersData.left?.sponsor || null,
      rightBanner: bannersData.right ? {
        enabled: true,
        imageUrl: bannersData.right.imageUrl,
        sponsorId: bannersData.right.sponsorId
      } : null,
      rightSponsor: bannersData.right?.sponsor || null
    }
  } catch (error) {
    console.error('Error loading banners:', error)
    return { leftBanner: null, leftSponsor: null, rightBanner: null, rightSponsor: null }
  }
}

function optimizeBannerImage(url: string): string {
  if (!url) return url
  if (url.toLowerCase().endsWith('.gif')) return url
  if (url.includes('cloudinary.com')) {
    return url.replace('/upload/', '/upload/f_auto,q_auto/')
  }
  return url
}

/**
 * Sol/sağ yan bannerlar - eskiden sadece ana sayfada gösteriliyordu, artık
 * yatay banner gibi TÜM sayfalarda gösteriliyor. İçeriği (children) ortada
 * bırakıp bannerları iki yana yerleştirir - her sayfanın kendi genişlik
 * tercihine (max-w-*) karışmaz, sadece etrafını sarar.
 */
export default function SideBanners({ children }: { children: React.ReactNode }) {
  const { theme } = useUserTheme()

  const { data: bannerConfig } = useQuery({
    queryKey: ['sideBanners'],
    queryFn: fetchBanners,
    staleTime: 60000,
    gcTime: 300000,
    refetchInterval: 120000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })

  const { leftBanner, leftSponsor, rightBanner, rightSponsor } = bannerConfig || {}

  function handleBannerClick(sponsor: BannerSponsor | null | undefined) {
    if (!sponsor?.websiteUrl) return
    if (sponsor.id) {
      const data = JSON.stringify({ sponsorId: sponsor.id })
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
    window.open(ensureAbsoluteUrl(sponsor.websiteUrl), '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="flex justify-center gap-2 px-2 max-w-full overflow-x-hidden">
      {/* Sol Banner */}
      {leftBanner && leftSponsor && (
        <div
          className="hidden md:block flex-shrink-0 w-[110px] lg:w-[140px] xl:w-[160px] 2xl:w-[200px] cursor-pointer pt-4"
          onClick={() => handleBannerClick(leftSponsor)}
        >
          <div
            className="sticky top-4 h-[calc(100vh-32px)] rounded-2xl overflow-hidden shadow-2xl"
            style={{ border: `1px solid ${theme.colors.border}` }}
          >
            <Image
              src={optimizeBannerImage(leftBanner.imageUrl)}
              alt={leftSponsor.name}
              width={200}
              height={800}
              className="object-cover w-full h-full"
              priority
              quality={85}
              unoptimized
            />
          </div>
        </div>
      )}

      <div className="flex-1 min-w-0">
        {children}
      </div>

      {/* Sağ Banner */}
      {rightBanner && rightSponsor && (
        <div
          className="hidden md:block flex-shrink-0 w-[110px] lg:w-[140px] xl:w-[160px] 2xl:w-[200px] cursor-pointer pt-4"
          onClick={() => handleBannerClick(rightSponsor)}
        >
          <div
            className="sticky top-4 h-[calc(100vh-32px)] rounded-2xl overflow-hidden shadow-2xl"
            style={{ border: `1px solid ${theme.colors.border}` }}
          >
            <Image
              src={optimizeBannerImage(rightBanner.imageUrl)}
              alt={rightSponsor.name}
              width={200}
              height={800}
              className="object-cover w-full h-full"
              priority
              quality={85}
              unoptimized
            />
          </div>
        </div>
      )}
    </div>
  )
}
