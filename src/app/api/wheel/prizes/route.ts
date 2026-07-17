import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCachedData, CacheKeys, CacheTags, CacheTTL } from '@/lib/enhanced-cache'

// ✅ OPTIMIZASYON: Cache revalidation - 10 dakika
export const revalidate = 600

export async function GET(request: NextRequest) {
  try {
    // 🚀 OPTIMIZATION: Enhanced cache ekle - wheel prizes sık değişmez
    const prizes = await getCachedData(
      CacheKeys.WHEEL_PRIZES(),
      async () => {
        return await prisma.wheelPrize.findMany({
          where: { isActive: true },
          orderBy: { order: 'asc' }
        })
      },
      {
        ttl: CacheTTL.LONG, // 30 dakika
        tags: [CacheTags.WHEEL]
      }
    )

    return NextResponse.json(
      { prizes },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200'
        }
      }
    )
  } catch (error) {
    console.error('Get wheel prizes error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
