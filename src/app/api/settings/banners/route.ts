import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCachedData, CacheTags, CacheTTL } from '@/lib/enhanced-cache'

interface BannerData {
  imageUrl: string
  sponsorId: string
  sponsor?: {
    id: string
    name: string
    websiteUrl: string | null
  }
}

interface BannersResponse {
  left: BannerData | null
  right: BannerData | null
}

/**
 * GET /api/settings/banners
 * ✅ OPTIMIZE: Homepage banner'larını tek API çağrısında döndür (sponsor bilgileriyle birlikte)
 */
export async function GET() {
  try {
    // ✅ Enhanced cache kullan
    const response = await getCachedData(
      'settings:banners',
      async () => {
        // Banner ayarlarını al
        const settings = await prisma.settings.findMany({
          where: {
            key: { in: ['left_banner_data', 'right_banner_data'] }
          }
        })

        const leftBanner = settings.find(s => s.key === 'left_banner_data')
        const rightBanner = settings.find(s => s.key === 'right_banner_data')

        // Banner verilerini parse et
        let leftBannerData: BannerData | null = null
        let rightBannerData: BannerData | null = null

        if (leftBanner?.value) {
          try {
            const parsed = JSON.parse(leftBanner.value)
            // ✅ enabled kontrolü eklendi - sadece aktif banner'ları döndür
            if (parsed.enabled && parsed.imageUrl && parsed.sponsorId) {
              leftBannerData = {
                imageUrl: parsed.imageUrl,
                sponsorId: parsed.sponsorId
              }
            }
          } catch (e) {
            console.warn('Left banner parse error:', e)
          }
        }

        if (rightBanner?.value) {
          try {
            const parsed = JSON.parse(rightBanner.value)
            // ✅ enabled kontrolü eklendi - sadece aktif banner'ları döndür
            if (parsed.enabled && parsed.imageUrl && parsed.sponsorId) {
              rightBannerData = {
                imageUrl: parsed.imageUrl,
                sponsorId: parsed.sponsorId
              }
            }
          } catch (e) {
            console.warn('Right banner parse error:', e)
          }
        }

        // Sponsor bilgilerini paralel olarak çek
        const [leftSponsor, rightSponsor] = await Promise.all([
          leftBannerData ? prisma.sponsor.findUnique({
            where: { id: leftBannerData.sponsorId },
            select: { id: true, name: true, websiteUrl: true }
          }) : null,
          rightBannerData ? prisma.sponsor.findUnique({
            where: { id: rightBannerData.sponsorId },
            select: { id: true, name: true, websiteUrl: true }
          }) : null
        ])

        // Response oluştur
        const result: BannersResponse = {
          left: leftBannerData && leftSponsor ? {
            ...leftBannerData,
            sponsor: leftSponsor
          } : null,
          right: rightBannerData && rightSponsor ? {
            ...rightBannerData,
            sponsor: rightSponsor
          } : null
        }

        return result
      },
      {
        ttl: CacheTTL.LONG, // 30 dakika
        tags: [CacheTags.SETTINGS]
      }
    )

    return NextResponse.json(response, {
      headers: {
        // 30 dakika cache (banner'lar sık değişmez)
        'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600'
      }
    })
  } catch (error) {
    console.error('Banner fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch banners' },
      { status: 500 }
    )
  }
}
