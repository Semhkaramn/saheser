import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCachedData, CacheKeys, CacheTags, CacheTTL } from '@/lib/enhanced-cache'

export async function GET(request: NextRequest) {
  try {
    // ✅ Enhanced cache kullan
    const sponsors = await getCachedData(
      CacheKeys.SPONSORS(),
      async () => {
        return await prisma.sponsor.findMany({
          where: { isActive: true },
          orderBy: { order: 'asc' }
        })
      },
      {
        ttl: CacheTTL.VERY_LONG, // 1 saat
        tags: [CacheTags.SPONSORS]
      }
    )

    // ✅ OPTIMIZASYON: Cache-Control header'ları ekle
    return NextResponse.json(
      { sponsors },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200'
        }
      }
    )
  } catch (error) {
    console.error('Get sponsors error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
