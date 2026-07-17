import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCachedData, CacheKeys, CacheTags, CacheTTL } from '@/lib/enhanced-cache'

export async function GET() {
  try {
    // ✅ Cache ekle - recent winners sık değişmez
    const winners = await getCachedData(
      CacheKeys.WHEEL_WINNERS(),
      async () => {
        return await prisma.wheelSpin.findMany({
          include: {
            user: {
              select: {
                siteUsername: true,
                avatar: true
              }
            },
            prize: {
              select: {
                name: true,
              }
            }
          },
          orderBy: { spunAt: 'desc' },
          take: 5
        })
      },
      {
        ttl: CacheTTL.SHORT, // 1 dakika (sık güncellensin)
        tags: [CacheTags.WHEEL]
      }
    )

    return NextResponse.json({ winners }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
      }
    })
  } catch (error) {
    console.error('Error fetching recent winners:', error)
    return NextResponse.json(
      { error: 'Son kazananlar alınamadı' },
      { status: 500 }
    )
  }
}
