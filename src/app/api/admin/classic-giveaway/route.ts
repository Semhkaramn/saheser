import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/admin-middleware'

export async function GET(request: NextRequest) {
  const authCheck = await requirePermission(request, 'canAccessSettings')
  if (authCheck.error) return authCheck.error

  try {
    const groups = await prisma.telegramGroup.findMany({
      where: { isActive: true },
      orderBy: { title: 'asc' },
    })

    const active = await prisma.classicGiveaway.findMany({
      where: { status: 'active' },
      include: {
        winTimes: { orderBy: { slotNumber: 'asc' } },
        _count: { select: { winTimes: true } },
      },
      orderBy: { startedAt: 'desc' },
    })

    const past = await prisma.classicGiveaway.findMany({
      where: { status: { in: ['ended', 'cancelled'] } },
      include: {
        winTimes: { orderBy: { slotNumber: 'asc' } },
        _count: { select: { winTimes: true } },
      },
      orderBy: { startedAt: 'desc' },
      take: 20,
    })

    const groupTitleMap = new Map(groups.map((g: { groupId: string; title: string | null }) => [g.groupId, g.title]))

    function serialize(g: any) {
      const wonSlots = g.winTimes.filter((w: any) => w.isWon)
      return {
        id: g.id,
        groupId: g.groupId,
        groupTitle: groupTitleMap.get(g.groupId) || g.groupId,
        prizeText: g.prizeText,
        status: g.status,
        startedAt: g.startedAt,
        endsAt: g.endsAt,
        endedAt: g.endedAt,
        totalSlots: g._count.winTimes,
        wonCount: wonSlots.length,
        winners: wonSlots.map((w: any) => ({
          name: w.winnerUsername ? `@${w.winnerUsername}` : w.winnerFirstName || 'Bilinmiyor',
          wonAt: w.wonAt,
        })),
        // Tüm anlar (geçmiş + gelecek) - admin talebiyle her zaman gösteriliyor.
        allSlots: g.winTimes.map((w: any) => ({
          slotNumber: w.slotNumber,
          winTime: w.winTime,
          isWon: w.isWon,
          winnerName: w.isWon ? (w.winnerUsername ? `@${w.winnerUsername}` : w.winnerFirstName || 'Bilinmiyor') : null,
          wonAt: w.wonAt,
        })),
      }
    }

    return NextResponse.json({
      active: active.map(serialize),
      past: past.map(serialize),
    })
  } catch (error) {
    console.error('Classic giveaway status error:', error)
    return NextResponse.json({ error: 'Yüklenemedi' }, { status: 500 })
  }
}
