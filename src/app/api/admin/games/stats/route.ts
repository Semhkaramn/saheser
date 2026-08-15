import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/admin-middleware'

export async function GET(request: NextRequest) {
  const authCheck = await requirePermission(request, 'canAccessGames')
  if (authCheck.error) return authCheck.error

  try {
    const gameTypes = ['mines', 'dice', 'roulette', 'blackjack'] as const

    const stats = await Promise.all(
      gameTypes.map(async (gameType) => {
        const [aggregate, totalPlays, wins] = await Promise.all([
          prisma.gamePlay.aggregate({
            where: { gameType, result: { not: 'pending' } },
            _sum: { betAmount: true, payout: true },
          }),
          prisma.gamePlay.count({ where: { gameType, result: { not: 'pending' } } }),
          prisma.gamePlay.count({ where: { gameType, result: { in: ['win', 'cashout'] } } }),
        ])

        const totalBet = aggregate._sum.betAmount || 0
        const totalPayout = aggregate._sum.payout || 0

        return {
          gameType,
          totalPlays,
          wins,
          losses: totalPlays - wins,
          totalBet,
          totalPayout,
          netHouseResult: totalBet - totalPayout, // pozitif = site lehine, negatif = kullanıcılar lehine
          rtp: totalBet > 0 ? (totalPayout / totalBet) * 100 : 0,
        }
      })
    )

    const last24h = await prisma.gamePlay.count({
      where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    })

    return NextResponse.json({ stats, last24hPlays: last24h })
  } catch (error) {
    console.error('Admin game stats error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
