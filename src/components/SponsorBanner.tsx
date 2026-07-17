'use client'

import { useEffect, useLayoutEffect, useState, useCallback, useRef } from 'react'
import Image from 'next/image'
import { optimizeCloudinaryImage, ensureAbsoluteUrl } from '@/lib/utils'
import { useSponsors } from '@/lib/hooks/useSponsors'
import { useQuery } from '@tanstack/react-query'
import { useUserTheme } from '@/components/providers/user-theme-provider'

interface Sponsor {
  id: string
  name: string
  logoUrl?: string
  websiteUrl?: string
  category: string
  isActive: boolean
  order: number
  showInBanner?: boolean
}

async function fetchBannerEnabled(): Promise<boolean> {
  try {
    const res = await fetch('/api/settings/sponsor-banner-enabled')
    const data = await res.json()
    return data.enabled === true
  } catch {
    return false
  }
}

export default function SponsorBanner() {
  const { theme } = useUserTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const { data: sponsorsData } = useSponsors()

  const { data: isEnabled } = useQuery({
    queryKey: ['sponsorBannerEnabled'],
    queryFn: fetchBannerEnabled,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  })

  const [isPaused, setIsPaused] = useState(false)
  const [isClient, setIsClient] = useState(false)
  const [isReady, setIsReady] = useState(false) // Animasyon hazır mı?
  const [contentWidth, setContentWidth] = useState(0)
  const [containerWidth, setContainerWidth] = useState(0)

  useEffect(() => {
    setIsClient(true)
  }, [])

  // Genişlikleri hesapla - useLayoutEffect ile boyama öncesi senkron hesaplanır,
  // böylece banner önce görünmez (opacity:0) sonra aniden görünür (yanıp sönme) hissi vermez
  useLayoutEffect(() => {
    if (!scrollRef.current || !containerRef.current || !isClient) return

    const updateWidths = () => {
      if (scrollRef.current && containerRef.current) {
        // Sadece bir set sponsor'un genişliğini al (ilk yarı)
        const children = scrollRef.current.children
        let singleSetWidth = 0
        const halfLength = Math.floor(children.length / 2)

        for (let i = 0; i < halfLength; i++) {
          const child = children[i] as HTMLElement
          singleSetWidth += child.offsetWidth
        }

        const newContainerWidth = containerRef.current.offsetWidth

        // Sadece geçerli değerler varsa güncelle
        if (singleSetWidth > 0 && newContainerWidth > 0) {
          setContentWidth(singleSetWidth)
          setContainerWidth(newContainerWidth)
          // Değerler hazır, animasyonu göster
          setIsReady(true)
        }
      }
    }

    // Boyama öncesi hemen hesapla - gecikme yok
    updateWidths()

    window.addEventListener('resize', updateWidths)
    return () => {
      window.removeEventListener('resize', updateWidths)
    }
  }, [sponsorsData, isClient])

  const handleSponsorClick = useCallback((sponsorId: string, websiteUrl?: string) => {
    if (!websiteUrl) return
    window.open(ensureAbsoluteUrl(websiteUrl), '_blank', 'noopener,noreferrer')
    fetch('/api/sponsors/click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sponsorId })
    }).catch(console.error)
  }, [])

  const sponsors = (sponsorsData || [])
    .filter((s: Sponsor) => s.isActive !== false && s.logoUrl && s.showInBanner !== false)
    .sort((a: Sponsor, b: Sponsor) => (a.order || 0) - (b.order || 0))

  if (!isClient || isEnabled === false || sponsors.length === 0) {
    return null
  }

  // Animasyon süresi: sponsor sayısına ve içerik genişliğine göre
  // Daha uzun içerik = daha uzun süre (sabit hız için)
  const baseSpeed = 50 // piksel/saniye
  const totalDistance = containerWidth + contentWidth
  const animationDuration = Math.max(8, totalDistance / baseSpeed)

  const renderSponsorItem = (sponsor: Sponsor, index: number, keyPrefix: string) => (
    <div
      key={`${keyPrefix}-${sponsor.id}-${index}`}
      onClick={() => handleSponsorClick(sponsor.id, sponsor.websiteUrl)}
      className="flex-shrink-0 px-4 md:px-6 lg:px-8 cursor-pointer group/item"
      title={`${sponsor.name} - Tıklayın`}
    >
      <div
        className="relative h-12 sm:h-14 md:h-16 lg:h-20 transition-all duration-300 ease-out group-hover/item:scale-110"
        style={{ width: 'auto' }}
      >
        {sponsor.logoUrl ? (
          <Image
            src={optimizeCloudinaryImage(sponsor.logoUrl, 240, 120)}
            unoptimized
            alt={sponsor.name}
            width={160}
            height={80}
            className="object-contain h-full w-auto max-w-[120px] sm:max-w-[140px] md:max-w-[160px] lg:max-w-[180px]"
            priority={index < 3}
            loading="eager"
            style={{
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
            }}
          />
        ) : (
          <div
            className="flex items-center justify-center h-full px-4 text-xs md:text-sm font-semibold text-center whitespace-nowrap"
            style={{ color: theme.colors.textMuted }}
          >
            {sponsor.name}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div
      ref={containerRef}
      className="w-full lg:w-[calc(100%-16rem)] lg:ml-64 overflow-hidden py-3 md:py-4 transition-opacity duration-300"
      style={{
        background: `linear-gradient(135deg, ${theme.colors.backgroundSecondary}ee, ${theme.colors.background}dd, ${theme.colors.backgroundSecondary}ee)`,
        borderBottom: `1px solid ${theme.colors.border}40`,
        backdropFilter: 'blur(8px)',
        opacity: isReady ? 1 : 0, // Hazır olana kadar gizle
      }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="relative overflow-hidden">
        {/* Sol fade efekti */}
        <div
          className="absolute left-0 top-0 bottom-0 w-12 md:w-20 lg:w-24 z-10 pointer-events-none"
          style={{
            background: `linear-gradient(to right, ${theme.colors.backgroundSecondary}, transparent)`
          }}
        />

        {/* Sağ fade efekti */}
        <div
          className="absolute right-0 top-0 bottom-0 w-12 md:w-20 lg:w-24 z-10 pointer-events-none"
          style={{
            background: `linear-gradient(to left, ${theme.colors.backgroundSecondary}, transparent)`
          }}
        />

        {/* Kayan içerik */}
        <div
          ref={scrollRef}
          className={`flex items-center ${isReady ? 'sponsor-marquee' : ''}`}
          style={{
            '--animation-duration': `${animationDuration}s`,
            '--content-width': `${contentWidth}px`,
            '--container-width': `${containerWidth}px`,
            animationPlayState: isPaused ? 'paused' : 'running',
            // Hazır değilse animasyonu başlatma, görünmez tut
            visibility: isReady ? 'visible' : 'hidden',
          } as React.CSSProperties}
        >
          {/* İlk set - sağdan başlayacak */}
          {sponsors.map((sponsor: Sponsor, index: number) =>
            renderSponsorItem(sponsor, index, 'set1')
          )}
          {/* İkinci set - seamless loop için */}
          {sponsors.map((sponsor: Sponsor, index: number) =>
            renderSponsorItem(sponsor, index, 'set2')
          )}
        </div>
      </div>

      <style jsx>{`
        .sponsor-marquee {
          animation: marqueeScroll var(--animation-duration, 15s) linear infinite;
          will-change: transform;
        }

        @keyframes marqueeScroll {
          0% {
            /* Ekranın sağından başla */
            transform: translateX(var(--container-width, 100vw));
          }
          100% {
            /* Tüm içerik geçene kadar sola kay */
            transform: translateX(calc(var(--content-width, 0px) * -1));
          }
        }

        .sponsor-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  )
}
