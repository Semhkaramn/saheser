import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { enhancedCache, CacheTags } from '@/lib/enhanced-cache'
import { revalidatePath } from 'next/cache'
import { requirePermission } from '@/lib/admin-middleware'
import { getTurkeyToday, getTurkeyWeekStart } from '@/lib/utils'

// GET - Tüm görevleri listele
export async function GET(request: NextRequest) {
  const authCheck = await requirePermission(request, 'canAccessTasks')
  if (authCheck.error) return authCheck.error

  try {
    const todayStart = getTurkeyToday()
    const weekStart = getTurkeyWeekStart()

    const tasks = await prisma.task.findMany({
      orderBy: [
        { category: 'asc' },
        { order: 'asc' }
      ],
      include: {
        _count: {
          select: { rewards: true }
        },
        rewards: {
          select: {
            claimedAt: true
          }
        }
      }
    })

    // Periyod bazlı ödül sayısı hesapla
    const tasksWithCounts = tasks.map(task => {
      let periodRewardCount = 0

      if (task.category === 'daily') {
        // Günlük görevler: Sadece bugün alınan ödüller
        periodRewardCount = task.rewards.filter(r =>
          r.claimedAt && r.claimedAt >= todayStart
        ).length
      } else if (task.category === 'weekly') {
        // Haftalık görevler: Sadece bu hafta alınan ödüller
        periodRewardCount = task.rewards.filter(r =>
          r.claimedAt && r.claimedAt >= weekStart
        ).length
      } else if (task.category === 'streak') {
        // Seri görevler: Toplam tamamlama sayısı (her seri tamamlandığında bir ödül)
        periodRewardCount = task._count.rewards
      } else if (task.category === 'permanent') {
        // Kalıcı görevler: Toplam tamamlama sayısı
        periodRewardCount = task._count.rewards
      }

      const { rewards, ...taskWithoutRewards } = task

      return {
        ...taskWithoutRewards,
        _count: {
          completions: periodRewardCount,
          totalCompletions: task._count.rewards
        }
      }
    })

    return NextResponse.json(tasksWithCounts)
  } catch (error) {
    console.error('Get tasks error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Yeni görev oluştur
export async function POST(request: NextRequest) {
  const authCheck = await requirePermission(request, 'canAccessTasks')
  if (authCheck.error) return authCheck.error

  try {
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

    const task = await prisma.task.create({
      data: {
        title,
        description,
        category: taskCategory,
        taskType: taskTypeValue,
        targetValue: parsedTargetValue,
        xpReward: parsedXpReward,
        pointsReward: parsedPointsReward,
        isActive: isActive !== false,
        order: parseInt(order) || 0
      }
    })

    // Cache invalidation
    enhancedCache.invalidateByTag(CacheTags.TASKS)
    revalidatePath('/tasks')
    revalidatePath('/api/task')

    return NextResponse.json(task)
  } catch (error) {
    console.error('Create task error:', error)
    return NextResponse.json(
      { error: 'Görev oluşturulurken bir hata oluştu' },
      { status: 500 }
    )
  }
}
