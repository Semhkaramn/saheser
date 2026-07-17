import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { enhancedCache, CacheTags } from '@/lib/enhanced-cache'
import { revalidatePath } from 'next/cache'
import { requirePermission } from '@/lib/admin-middleware'

// PUT - Görevi güncelle
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ✅ Yetki kontrolü
  const authCheck = await requirePermission(request, 'canAccessTasks')
  if (authCheck.error) return authCheck.error

  try {
    const { id } = await params
    const body = await request.json()
    const {
      title,
      description,
      category,
      taskType,
      targetValue,
      xpReward,
      pointsReward,
      isActive,
      order
    } = body

    // Validation
    if (!title || title.trim().length === 0) {
      return NextResponse.json(
        { error: 'Görev başlığı gerekli' },
        { status: 400 }
      )
    }

    const parsedTargetValue = parseInt(targetValue) || 1
    const parsedXpReward = parseInt(xpReward) || 0
    const parsedPointsReward = parseInt(pointsReward) || 0

    if (parsedTargetValue <= 0) {
      return NextResponse.json(
        { error: 'Hedef değer 0\'dan büyük olmalı' },
        { status: 400 }
      )
    }

    // Kategori kontrolü (daily, weekly, streak, permanent)
    const validCategories = ['daily', 'weekly', 'streak', 'permanent']
    const taskCategory = validCategories.includes(category) ? category : 'daily'

    // Task tipi kontrolü
    const validTaskTypes = ['send_messages', 'spin_wheel']
    const taskTypeValue = validTaskTypes.includes(taskType) ? taskType : 'send_messages'

    // Streak kategorisi sadece spin_wheel olabilir
    if (taskCategory === 'streak' && taskTypeValue !== 'spin_wheel') {
      return NextResponse.json(
        { error: 'Seri görevler sadece çark çevirme türünde olabilir' },
        { status: 400 }
      )
    }

    const task = await prisma.task.update({
      where: { id },
      data: {
        title,
        description,
        category: taskCategory,
        taskType: taskTypeValue,
        targetValue: parsedTargetValue,
        xpReward: parsedXpReward,
        pointsReward: parsedPointsReward,
        isActive,
        order: parseInt(order) || 0
      }
    })

    // Cache invalidation
    enhancedCache.invalidateByTag(CacheTags.TASKS)
    revalidatePath('/tasks')
    revalidatePath('/api/task')

    return NextResponse.json(task)
  } catch (error) {
    console.error('Update task error:', error)
    return NextResponse.json(
      { error: 'Görev güncellenirken bir hata oluştu' },
      { status: 500 }
    )
  }
}

// DELETE - Görevi sil
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ✅ Yetki kontrolü
  const authCheck = await requirePermission(request, 'canAccessTasks')
  if (authCheck.error) return authCheck.error

  try {
    const { id } = await params

    await prisma.task.delete({
      where: { id }
    })

    // Cache invalidation
    enhancedCache.invalidateByTag(CacheTags.TASKS)
    revalidatePath('/tasks')
    revalidatePath('/api/task')

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete task error:', error)
    return NextResponse.json(
      { error: 'Görev silinirken bir hata oluştu' },
      { status: 500 }
    )
  }
}
