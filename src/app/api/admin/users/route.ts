import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/admin-middleware'

export async function GET(request: NextRequest) {
  try {
    // Admin authentication and permission check
    const authResult = await requirePermission(request, 'canAccessUsers')
    if (authResult.error) {
      return authResult.error
    }

    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''

    const skip = (page - 1) * limit

    const where = search
      ? {
          OR: [
            { siteUsername: { contains: search, mode: 'insensitive' as const } },
            { telegramUsername: { contains: search, mode: 'insensitive' as const } },
            { firstName: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
            { telegramId: { contains: search } }
          ]
        }
      : {}

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          telegramUsername: true,
          siteUsername: true,
          email: true,
          emailVerified: true,
          points: true,
          _count: {
            select: {
              wheelSpins: true,
              purchases: true
            }
          },
          isBanned: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.user.count({ where })
    ])

    // Transform the data to include totalSpins and totalPurchases
    const transformedUsers = users.map(user => ({
      id: user.id,
      telegramUsername: user.telegramUsername,
      siteUsername: user.siteUsername,
      email: user.email,
      emailVerified: user.emailVerified,
      points: user.points,
      totalSpins: user._count.wheelSpins,
      totalPurchases: user._count.purchases,
      isBanned: user.isBanned,
      createdAt: user.createdAt
    }))

    return NextResponse.json({
      users: transformedUsers,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    })
  } catch (error) {
    console.error('Get users error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, points, xp } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'userId required' },
        { status: 400 }
      )
    }

    const updateData: any = {}
    if (typeof points === 'number') updateData.points = points
    if (typeof xp === 'number') updateData.xp = xp

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      include: { rank: true }
    })

    return NextResponse.json({ user })
  } catch (error) {
    console.error('Update user error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
