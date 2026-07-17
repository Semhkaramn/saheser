import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { enhancedCache, CacheTags, invalidateCache } from '@/lib/enhanced-cache'
import { revalidatePath } from 'next/cache'
import { requirePermission } from '@/lib/admin-middleware'

export async function GET(request: NextRequest) {
  const authCheck = await requirePermission(request, 'canAccessRanks')
  if (authCheck.error) return authCheck.error

  try {
    const ranks = await prisma.rank.findMany({
      orderBy: { minXp: 'asc' },
      include: {
        _count: {
          select: { users: true }
        }
      }
    })

    return NextResponse.json({ ranks })
  } catch (error) {
    console.error('Get ranks error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const authCheck = await requirePermission(request, 'canAccessRanks')
  if (authCheck.error) return authCheck.error

  try {
    const body = await request.json()
    const { name, minXp, icon, color, order, pointsReward } = body

    if (!name || typeof minXp !== 'number') {
      return NextResponse.json(
        { error: 'name and minXp required' },
        { status: 400 }
      )
    }

    const rank = await prisma.rank.create({
      data: {
        name,
        minXp,
        icon: icon || '⭐',
        color: color || '#FFD700',
        order: order || 0,
        pointsReward: pointsReward || 0
      }
    })

    // ✅ Cache invalidation - rütbe değişikliği leaderboard'u etkiler
    invalidateCache.leaderboard()
    revalidatePath('/leaderboard')
    console.log('🔄 Leaderboard cache temizlendi (yeni rütbe oluşturuldu)')

    return NextResponse.json({ rank })
  } catch (error) {
    console.error('Create rank error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
