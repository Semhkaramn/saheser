import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTurkeyToday, getTurkeyDateAgo } from '@/lib/utils'
import { checkAndResetWheelSpins } from '@/lib/services/wheel-service'
import { requireAuth } from '@/lib/auth'
import { SiteConfig } from '@/lib/site-config'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // Session kontrolü - artık URL parametresi yerine session kullanıyoruz
    const session = await requireAuth(request)
    const userId = session.userId

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        rank: true,
        pointHistory: {
          orderBy: { createdAt: 'desc' },
          take: 50
        }
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Ban kontrolü - Banlı kullanıcılar uygulamayı kullanamaz
    if (user.isBanned) {
      return NextResponse.json({
        banned: true,
        banReason: user.banReason || 'Sistem kurallarını ihlal ettiniz.',
        bannedAt: user.bannedAt,
        bannedBy: user.bannedBy
      })
    }

    // Çark haklarını kontrol et ve gerekirse sıfırla
    // 🚀 OPTIMIZED: Wheel config from ENV (no DB queries)
    try {
      await checkAndResetWheelSpins(
        userId,
        SiteConfig.wheelResetTime,
        SiteConfig.dailyWheelSpins
      )

      // Güncellenmiş kullanıcıyı tekrar al
      const updatedUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { dailySpinsLeft: true }
      })
      if (updatedUser) {
        user.dailySpinsLeft = updatedUser.dailySpinsLeft
      }
    } catch (wheelResetError) {
      console.error('Wheel reset error:', wheelResetError)
      // Hata olsa bile devam et
    }

    // ========== ✅ TELEGRAM GRUP KULLANICISI BİLGİLERİNİ ÇEK (günlük/haftalık/aylık dahil) ==========

    // Kullanıcının telegram bilgilerini al
    const telegramGroupUser = user.telegramId
      ? await prisma.telegramGroupUser.findUnique({
          where: { telegramId: user.telegramId },
          select: {
            messageCount: true,
            dailyMessageCount: true,
            weeklyMessageCount: true,
            monthlyMessageCount: true
          }
        })
      : null

    const totalMessages = telegramGroupUser?.messageCount || 0

    // Kullanıcının XP'sine göre rütbesini güncelle
    const currentRank = await prisma.rank.findFirst({
      where: { minXp: { lte: user.xp } },
      orderBy: { minXp: 'desc' }
    })

    if (currentRank && user.rankId !== currentRank.id) {
      await prisma.user.update({
        where: { id: userId },
        data: { rankId: currentRank.id }
      })
    }

    // Bir sonraki rütbeyi bul
    const nextRank = await prisma.rank.findFirst({
      where: { minXp: { gt: user.xp } },
      orderBy: { minXp: 'asc' }
    })

    // Tüm rank listesini al
    const allRanks = await prisma.rank.findMany({
      orderBy: { minXp: 'asc' }
    })

    // Leaderboard sıralamasını hesapla (Puana göre, eşitlikte XP'ye göre)
    const higherRankedCount = await prisma.user.count({
      where: {
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
    const leaderboardRank = higherRankedCount + 1

    return NextResponse.json({
      id: user.id,
      telegramId: user.telegramId,
      telegramUsername: user.telegramUsername,
      firstName: user.firstName,
      lastName: user.lastName,
      points: user.points,
      xp: user.xp,
      messageStats: {
        daily: telegramGroupUser?.dailyMessageCount || 0,
        weekly: telegramGroupUser?.weeklyMessageCount || 0,
        monthly: telegramGroupUser?.monthlyMessageCount || 0,
        total: totalMessages
      },
      dailySpinsLeft: user.dailySpinsLeft,
      rank: currentRank || user.rank,
      nextRank,
      allRanks,
      leaderboardRank,
      pointHistory: user.pointHistory,
      createdAt: user.createdAt
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Oturum geçersiz. Lütfen tekrar giriş yapın.' },
        { status: 401 }
      )
    }
    console.error('Get user error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
