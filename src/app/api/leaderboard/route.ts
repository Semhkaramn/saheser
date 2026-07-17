import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCachedData, CacheKeys, CacheTags, CacheTTL } from '@/lib/enhanced-cache'

// ✅ Force dynamic rendering due to searchParams usage
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId') // Opsiyonel - sadece kendi sıralamasını görmek için
    const sortBy = searchParams.get('sortBy') || 'points' // 'points' veya 'xp'

    const leaderboardData = await getCachedData(
      CacheKeys.LEADERBOARD(sortBy),
      async () => {
        // Sıralamayı belirle
        const orderBy = sortBy === 'xp'
          ? [{ xp: 'desc' as const }, { points: 'desc' as const }]
          : [{ points: 'desc' as const }, { xp: 'desc' as const }]

        console.log('🔍 Veritabanından kullanıcılar getiriliyor...')

        // ✅ FIX: Banlı kullanıcıları filtrele
        const users = await prisma.user.findMany({
          where: {
            isBanned: false // Sadece banlı OLMAYAN kullanıcılar
          },
          select: {
            id: true,
            telegramId: true,
            siteUsername: true,
            firstName: true,
            lastName: true,
            avatar: true,
            points: true,
            xp: true,
            rank: {
              select: {
                name: true,
                icon: true,
              }
            }
          },
          orderBy,
          take: 20
        })

        console.log(`✅ ${users.length} kullanıcı bulundu (banlı olmayanlar)`)

        return users.map((user, index) => ({
          ...user,
          position: index + 1
        }))
      },
      {
        ttl: CacheTTL.MEDIUM, // 5 minutes cache
        tags: [CacheTags.LEADERBOARD]
      }
    )

    console.log(`📊 Leaderboard data: ${leaderboardData.length} kullanıcı`)

    // Mevcut kullanıcının pozisyonunu bul
    let currentUser = null
    if (userId) {
      const userIndex = leaderboardData.findIndex((u: any) => u.id === userId)
      if (userIndex !== -1) {
        currentUser = leaderboardData[userIndex]
      } else {
        // 🚀 FIX: Kullanıcı pozisyonunu cache'le
        const userPositionData = await getCachedData(
          `user-position:${userId}:${sortBy}`,
          async () => {
            // Kullanıcı top 20'de değilse, ayrıca getir
            const user = await prisma.user.findUnique({
              where: { id: userId },
              select: {
                id: true,
                siteUsername: true,
                firstName: true,
                lastName: true,
                avatar: true,
                points: true,
                xp: true,
                isBanned: true,
                rank: {
                  select: {
                    name: true,
                    icon: true,
                  }
                }
              }
            })

            if (!user || user.isBanned) {
              return null
            }

            // Pozisyon hesapla
            const higherRankedCount = sortBy === 'xp'
              ? await prisma.user.count({
                  where: {
                    isBanned: false,
                    OR: [
                      { xp: { gt: user.xp } },
                      {
                        AND: [
                          { xp: user.xp },
                          { points: { gt: user.points } }
                        ]
                      }
                    ]
                  }
                })
              : await prisma.user.count({
                  where: {
                    isBanned: false,
                    OR: [
                      { points: { gt: user.points } },
                      {
                        AND: [
                          { points: user.points },
                          { xp: { gt: user.xp } }
                        ]
                      }
                    ]
                  }
                })

            return {
              ...user,
              position: higherRankedCount + 1
            }
          },
          { ttl: CacheTTL.SHORT } // 60 saniye cache
        )

        currentUser = userPositionData
      }
    }

    return NextResponse.json({
      leaderboard: leaderboardData,
      currentUser,
      totalUsers: leaderboardData.length
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
      }
    })
  } catch (error) {
    console.error('❌ Leaderboard API hatası:', error)
    console.error('Hata detayı:', error instanceof Error ? error.message : 'Bilinmeyen hata')
    console.error('Stack trace:', error instanceof Error ? error.stack : 'Yok')

    return NextResponse.json(
      {
        error: 'Liderlik tablosu alınamadı',
        details: error instanceof Error ? error.message : 'Bilinmeyen hata'
      },
      { status: 500 }
    )
  }
}
