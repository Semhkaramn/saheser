import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/admin-middleware'

export async function GET(request: NextRequest) {
  const authCheck = await requirePermission(request, 'canAccessGames')
  if (authCheck.error) return authCheck.error

  try {
    const { searchParams } = new URL(request.url)
    const gameType = searchParams.get('gameType') || undefined
    const result = searchParams.get('result') || undefined
    const userQuery = searchParams.get('user') || undefined
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const pageSize = Math.min(100, Number(searchParams.get('pageSize') || 25))

    const where: any = {
      ...(gameType ? { gameType } : {}),
      ...(result ? { result } : {}),
      ...(userQuery
        ? {
            user: {
              OR: [
                { siteUsername: { contains: userQuery, mode: 'insensitive' } },
                { email: { contains: userQuery, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    }

    const [items, total] = await Promise.all([
      prisma.gamePlay.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: { select: { id: true, siteUsername: true, email: true } },
        },
      }),
      prisma.gamePlay.count({ where }),
    ])

    return NextResponse.json({ items, total, page, pageSize })
  } catch (error) {
    console.error('Admin game history error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
