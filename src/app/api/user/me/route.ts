import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { checkAndResetWheelSpins } from '@/lib/services/wheel-service'
import { SiteConfig } from '@/lib/site-config'
import { getCachedData, CacheTTL, CacheKeys, CacheStrategy } from '@/lib/enhanced-cache'

// 🚀 OPTIMIZATION: Timeout promise helper
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Database query timeout')), ms)
    )
  ])
}

const DB_TIMEOUT = 6000 // 6 saniye timeout

export async function GET(request: NextRequest) {
  try {
    // Session kontrolü
    const session = await requireAuth(request)

    // 🚀 OPTIMIZATION: Tek bir cache key ile user data'yı cache'le
    const cacheKey = CacheKeys.USER_STATS(session.userId)

    // 🚀 OPTIMIZATION: Rütbe listesi neredeyse hiç değişmiyor ama eskiden
    // "her zaman taze" gruba dahildi, her /api/user/me çağrısında yeniden
    // sorgulanıyordu. Ayrı, uzun ömürlü bir cache'e taşıdık - bu, veritabanı
    // zorlandığında en çok çağrılan endpoint'in üzerindeki yükü azaltıyor.
    const allRanksPromise = getCachedData(
      'all-ranks',
      () => prisma.rank.findMany({ orderBy: { minXp: 'asc' } }),
      { ttl: CacheTTL.LONG, strategy: CacheStrategy.STALE_WHILE_REVALIDATE }
    )

    const userData = await getCachedData(
      cacheKey,
      async () => {
        // 🚀 OPTIMIZATION: Tüm verileri Promise.all ile paralel getir + TIMEOUT
        const [user, currentRank, nextRank, allRanks, telegramGroupUser, leaderboardPosition] = await withTimeout(
          Promise.all([
            // User bilgileri + pointHistory
            prisma.user.findUnique({
              where: { id: session.userId },
              include: {
                rank: true,
                pointHistory: {
                  orderBy: { createdAt: 'desc' },
                  take: 50
                }
              }
            }),

            // Current rank - user XP'sine göre
            prisma.$queryRaw<Array<{ id: string; name: string; minXp: number; icon: string; color: string; order: number }>>`
              SELECT id, name, "minXp", icon, color, "order"
              FROM "Rank"
              WHERE "minXp" <= (SELECT xp FROM "User" WHERE id = ${session.userId})
              ORDER BY "minXp" DESC
              LIMIT 1
            `,

            // Next rank
            prisma.$queryRaw<Array<{ id: string; name: string; minXp: number; icon: string; color: string; order: number }>>`
              SELECT id, name, "minXp", icon, color, "order"
              FROM "Rank"
              WHERE "minXp" > (SELECT xp FROM "User" WHERE id = ${session.userId})
              ORDER BY "minXp" ASC
              LIMIT 1
            `,

            // All ranks - artık ayrı, uzun ömürlü cache'den geliyor
            allRanksPromise,

            // Telegram group user data
            prisma.$queryRaw<Array<{ messageCount: number; dailyMessageCount: number; weeklyMessageCount: number; monthlyMessageCount: number }>>`
              SELECT "messageCount", "dailyMessageCount", "weeklyMessageCount", "monthlyMessageCount"
              FROM "TelegramGroupUser"
              WHERE "telegramId" = (SELECT "telegramId" FROM "User" WHERE id = ${session.userId})
              LIMIT 1
            `,

            // Leaderboard position - will be calculated after getting user
            Promise.resolve(0)
          ]),
          DB_TIMEOUT
        )

        if (!user) {
          throw new Error('User not found')
        }

        // Ban kontrolü
        if (user.isBanned) {
          return {
            banned: true,
            banReason: user.banReason || 'Sistem kurallarını ihlal ettiniz.',
            bannedAt: user.bannedAt,
            bannedBy: user.bannedBy
          }
        }

        const currentRankData = currentRank[0] || user.rank
        const nextRankData = nextRank[0] || null
        const telegramData = telegramGroupUser[0] || null

        // Message stats
        const messageStats = {
          daily: telegramData?.dailyMessageCount || 0,
          weekly: telegramData?.weeklyMessageCount || 0,
          monthly: telegramData?.monthlyMessageCount || 0,
          total: telegramData?.messageCount || 0
        }

        // Calculate leaderboard position - timeout ile
        const leaderboardPos = await withTimeout(
          prisma.user.count({
            where: {
              points: { gt: user.points },
              isBanned: false
            }
          }),
          3000 // 3 saniye timeout
        ).catch(() => 0) // Timeout durumunda 0 döndür

        return {
          id: user.id,
          email: user.email,
          siteUsername: user.siteUsername,
          telegramId: user.telegramId,
          telegramUsername: user.telegramUsername,
          firstName: user.firstName,
          lastName: user.lastName,
          emailVerified: user.emailVerified,
          points: user.points,
          xp: user.xp,
          rank: currentRankData,
          nextRank: nextRankData,
          allRanks: allRanks,
          dailySpinsLeft: user.dailySpinsLeft,
          lastSpinReset: user.lastSpinReset,
          isBanned: user.isBanned,
          trc20WalletAddress: user.trc20WalletAddress,
          leaderboardRank: leaderboardPos + 1,
          messageStats: messageStats,
          pointHistory: user.pointHistory,
          totalMessages: messageStats.total,
          createdAt: user.createdAt,
          avatar: user.avatar,
          banned: false
        }
      },
      { ttl: CacheTTL.SHORT, strategy: CacheStrategy.NETWORK_FIRST } // Always fetch fresh data for user profile
    )

    // Ban kontrolü sonucu
    if (userData.banned) {
      return NextResponse.json({
        banned: true,
        banReason: userData.banReason,
        bannedAt: userData.bannedAt,
        bannedBy: userData.bannedBy
      }, { status: 403 })
    }

    // 🚀 OPTIMIZATION: Wheel reset ENV'den okur (DB sorgusu yok)
    const wheelConfig = SiteConfig

    try {
      // 🚀 FIX: checkAndResetWheelSpins artık dailySpinsLeft döndürüyor - ikinci sorgu kaldırıldı
      const wheelResult = await Promise.race([
        checkAndResetWheelSpins(
          session.userId,
          wheelConfig.wheelResetTime,
          wheelConfig.dailyWheelSpins
        ),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)) // 2s timeout
      ])

      if (wheelResult) {
        userData.dailySpinsLeft = wheelResult.dailySpinsLeft
      }
    } catch (wheelResetError) {
      console.error('Wheel reset error:', wheelResetError)
    }

    return NextResponse.json(userData)

  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Oturum geçersiz. Lütfen tekrar giriş yapın.' },
        { status: 401 }
      )
    }

    // 🚀 FIX: Timeout hatasını yakala
    if (error instanceof Error && error.message === 'Database query timeout') {
      console.error('User info timeout - returning cached or empty response')
      return NextResponse.json(
        { error: 'Sunucu meşgul, lütfen tekrar deneyin.' },
        { status: 503 }
      )
    }

    console.error('User info error:', error)
    return NextResponse.json(
      { error: 'Kullanıcı bilgileri alınırken hata oluştu' },
      { status: 500 }
    )
  }
}
