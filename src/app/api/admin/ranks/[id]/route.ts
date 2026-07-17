import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { invalidateCache } from '@/lib/enhanced-cache'
import { revalidatePath } from 'next/cache'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, minXp, icon, color, order, pointsReward } = body

    const updateData: any = {}
    if (name) updateData.name = name
    if (typeof minXp === 'number') updateData.minXp = minXp
    if (icon) updateData.icon = icon
    if (color) updateData.color = color
    if (typeof order === 'number') updateData.order = order
    if (typeof pointsReward === 'number') updateData.pointsReward = pointsReward

    const rank = await prisma.rank.update({
      where: { id },
      data: updateData
    })

    // ✅ Cache invalidation - rütbe değişikliği leaderboard'u etkiler
    invalidateCache.leaderboard()
    revalidatePath('/leaderboard')
    console.log('🔄 Leaderboard cache temizlendi (rütbe güncellendi)')

    return NextResponse.json({ rank })
  } catch (error) {
    console.error('Update rank error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    await prisma.rank.delete({
      where: { id }
    })

    // ✅ Cache invalidation - rütbe değişikliği leaderboard'u etkiler
    invalidateCache.leaderboard()
    revalidatePath('/leaderboard')
    console.log('🔄 Leaderboard cache temizlendi (rütbe silindi)')

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete rank error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
