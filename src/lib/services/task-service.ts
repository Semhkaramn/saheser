/**
 * 🎯 Task Service Layer - TÜM GEÇMİŞ SAKLANIR VERSİYONU
 *
 * ✅ Günlük görevler: dailyMessageCount/dailyWheelSpins ile karşılaştırılır
 *    - Gün 00:00'da yeni periyod başlar, aynı görev tekrar yapılabilir
 *
 * ✅ Haftalık görevler: weeklyMessageCount/weeklyWheelSpins ile karşılaştırılır
 *    - Pazartesi 00:00'da yeni periyod başlar, aynı görev tekrar yapılabilir
 *
 * ✅ Seri görevler: weeklyWheelStreak ile karşılaştırılır
 *    - Ardışık gün çark çevirme serisi
 *    - Gün atlanırsa seri sıfırlanır
 *    - 7 gün tamamlanırsa ödül alınabilir ve seri sıfırlanır
 *
 * ✅ Kalıcı görevler: Bir kez tamamlanabilir, süresiz
 *
 * ✅ Mantık:
 *    - currentValue >= targetValue ise görev tamamlandı
 *    - UserTaskReward kaydı periyod bazlı kontrol edilir (claimedAt)
 *    - Tüm ödül kayıtları saklanır, silinmez - TAM GEÇMİŞ
 */

import { prisma } from '@/lib/prisma'
import { getTurkeyDate, getTurkeyToday, getTurkeyWeekStart } from '@/lib/utils'
import { getCachedData, CacheTTL, CacheTags } from '@/lib/enhanced-cache'
import { logTaskComplete } from '@/lib/services/activity-log-service'

/**
 * ✅ Kullanıcının görevlerini getir
 */
export async function getUserTasks(userId: string | null) {
  const now = getTurkeyDate()
  const todayStart = getTurkeyToday()
  const weekStart = getTurkeyWeekStart()

  // Tüm aktif görevleri cache'den getir
  const allTasks = await getCachedData(
    'tasks:all',
    async () => {
      return await prisma.task.findMany({
        where: { isActive: true },
        orderBy: [
          { category: 'asc' },
          { order: 'asc' }
        ]
      })
    },
    {
      ttl: CacheTTL.LONG,
      tags: [CacheTags.TASKS]
    }
  )

  // Kullanıcı yoksa progress 0
  if (!userId) {
    return {
      dailyTasks: formatTasksForGuest(allTasks.filter(t => t.category === 'daily')),
      weeklyTasks: formatTasksForGuest(allTasks.filter(t => t.category === 'weekly')),
      streakTasks: formatTasksForGuest(allTasks.filter(t => t.category === 'streak')),
      permanentTasks: formatTasksForGuest(allTasks.filter(t => t.category === 'permanent')),
      taskHistory: [],
      isAuthenticated: false
    }
  }

  // Kullanıcı bilgilerini getir (streak için)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      telegramId: true,
      points: true,
      xp: true,
      weeklyWheelStreak: true,
      lastWheelSpinDate: true
    }
  })

  if (!user) {
    throw new Error('Kullanıcı bulunamadı')
  }

  // ✅ Streak kontrolü - dün çevirmemişse sıfırla (sadece görüntüleme için, DB güncellemesi cron job'da yapılır)
  const yesterdayStart = new Date(todayStart)
  yesterdayStart.setDate(yesterdayStart.getDate() - 1)

  let currentStreak = user.weeklyWheelStreak
  const lastSpinDate = user.lastWheelSpinDate ? new Date(user.lastWheelSpinDate) : null

  // Eğer son çevirme dünden önce ise ve streak > 0 ise, görüntüleme için sıfırla
  if (currentStreak > 0 && lastSpinDate && lastSpinDate < yesterdayStart) {
    currentStreak = 0
  }

  // ✅ Mesaj sayılarını al
  let dailyMessages = 0
  let weeklyMessages = 0
  let totalMessages = 0

  if (user.telegramId) {
    const telegramUser = await prisma.telegramGroupUser.findUnique({
      where: { telegramId: user.telegramId },
      select: {
        messageCount: true,
        dailyMessageCount: true,
        weeklyMessageCount: true,
        lastDailyReset: true,
        lastWeeklyReset: true
      }
    })

    if (telegramUser) {
      totalMessages = telegramUser.messageCount || 0
      const lastDailyReset = telegramUser.lastDailyReset ? new Date(telegramUser.lastDailyReset) : null
      if (lastDailyReset && lastDailyReset >= todayStart) {
        dailyMessages = telegramUser.dailyMessageCount || 0
      }
      const lastWeeklyReset = telegramUser.lastWeeklyReset ? new Date(telegramUser.lastWeeklyReset) : null
      if (lastWeeklyReset && lastWeeklyReset >= weekStart) {
        weeklyMessages = telegramUser.weeklyMessageCount || 0
      }
    }
  }

  // ✅ Çark çevirme sayılarını al
  const [dailyWheelSpins, weeklyWheelSpins, totalWheelSpins] = await Promise.all([
    prisma.wheelSpin.count({ where: { userId, spunAt: { gte: todayStart } } }),
    prisma.wheelSpin.count({ where: { userId, spunAt: { gte: weekStart } } }),
    prisma.wheelSpin.count({ where: { userId } })
  ])

  // ✅ Kullanıcının MEVCUT PERİYOD'da aldığı ödülleri getir
  const [dailyClaimedRewards, weeklyClaimedRewards, streakClaimedRewards, permanentClaimedRewards] = await Promise.all([
    prisma.userTaskReward.findMany({
      where: { userId, task: { category: 'daily' }, claimedAt: { gte: todayStart } },
      select: { taskId: true, claimedAt: true }
    }),
    prisma.userTaskReward.findMany({
      where: { userId, task: { category: 'weekly' }, claimedAt: { gte: weekStart } },
      select: { taskId: true, claimedAt: true }
    }),
    prisma.userTaskReward.findMany({
      where: { userId, task: { category: 'streak' } },
      select: { taskId: true, claimedAt: true },
      orderBy: { claimedAt: 'desc' }
    }),
    prisma.userTaskReward.findMany({
      where: { userId, task: { category: 'permanent' } },
      select: { taskId: true, claimedAt: true }
    })
  ])

  // Periyod bazlı claimed task ID'leri oluştur
  const claimedTaskIds = new Set<string>()

  for (const reward of dailyClaimedRewards) claimedTaskIds.add(reward.taskId)
  for (const reward of weeklyClaimedRewards) claimedTaskIds.add(reward.taskId)
  for (const reward of permanentClaimedRewards) claimedTaskIds.add(reward.taskId)

  // ✅ Seri görevler için özel kontrol - DÜZELTME
  // Bugün alınan streak ödülleri de claimed olarak işaretlenmeli
  const lastSpinForCheck = user.lastWheelSpinDate ? new Date(user.lastWheelSpinDate) : null

  for (const reward of streakClaimedRewards) {
    const rewardClaimedAt = new Date(reward.claimedAt)

    // ✅ DÜZELTME: Bugün alınan streak ödülleri her zaman claimed olarak işaretle
    // (ödül alındıktan sonra streak sıfırlandığı için currentStreak = 0 olabilir)
    if (rewardClaimedAt >= todayStart) {
      claimedTaskIds.add(reward.taskId)
      continue
    }

    // Önceki ödüller için: yeni bir seri başlamış mı kontrol et
    if (currentStreak > 0) {
      const isNewStreak = lastSpinForCheck && lastSpinForCheck > rewardClaimedAt
      if (!isNewStreak) {
        claimedTaskIds.add(reward.taskId)
      }
    }
  }

  // ✅ Görevleri formatla
  const formatTask = (task: any) => {
    let currentValue = 0

    if (task.category === 'streak') {
      currentValue = currentStreak
    } else if (task.category === 'permanent') {
      if (task.taskType === 'send_messages') currentValue = totalMessages
      else if (task.taskType === 'spin_wheel') currentValue = totalWheelSpins
    } else if (task.taskType === 'send_messages') {
      currentValue = task.category === 'daily' ? dailyMessages : weeklyMessages
    } else if (task.taskType === 'spin_wheel') {
      currentValue = task.category === 'daily' ? dailyWheelSpins : weeklyWheelSpins
    }

    const isCompleted = currentValue >= task.targetValue
    const rewardClaimed = claimedTaskIds.has(task.id)

    return {
      id: task.id,
      title: task.title,
      description: task.description,
      category: task.category,
      taskType: task.taskType,
      targetValue: task.targetValue,
      currentProgress: Math.min(currentValue, task.targetValue),
      xpReward: task.xpReward,
      pointsReward: task.pointsReward,
      progress: `${Math.min(currentValue, task.targetValue)}/${task.targetValue}`,
      completed: isCompleted,
      rewardClaimed: rewardClaimed,
      canClaim: isCompleted && !rewardClaimed
    }
  }

  const dailyTasks = allTasks.filter(t => t.category === 'daily').map(formatTask)
  const weeklyTasks = allTasks.filter(t => t.category === 'weekly').map(formatTask)
  const streakTasks = allTasks.filter(t => t.category === 'streak').map(formatTask)
  const permanentTasks = allTasks.filter(t => t.category === 'permanent').map(formatTask)

  // ✅ Görev geçmişi (son 100 ödül) - TÜM GEÇMİŞ
  const taskHistory = await prisma.userTaskReward.findMany({
    where: { userId },
    include: { task: true },
    orderBy: { claimedAt: 'desc' },
    take: 100
  })

  const formattedHistory = taskHistory.map(reward => ({
    id: reward.id,
    taskId: reward.taskId,
    title: reward.task.title,
    category: reward.task.category,
    xpReward: reward.xpEarned || reward.task.xpReward,
    pointsReward: reward.pointsEarned || reward.task.pointsReward,
    claimedAt: reward.claimedAt
  }))

  return {
    dailyTasks,
    weeklyTasks,
    streakTasks,
    permanentTasks,
    taskHistory: formattedHistory,
    isAuthenticated: true
  }
}

/**
 * ✅ Görev ödülünü talep et
 */
export async function claimTaskReward(userId: string, taskId: string) {
  const now = getTurkeyDate()
  const todayStart = getTurkeyToday()
  const weekStart = getTurkeyWeekStart()

  const task = await prisma.task.findUnique({ where: { id: taskId } })
  if (!task || !task.isActive) throw new Error('Görev bulunamadı veya aktif değil')

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, telegramId: true, points: true, xp: true, weeklyWheelStreak: true, lastWheelSpinDate: true }
  })
  if (!user) throw new Error('Kullanıcı bulunamadı')

  const yesterdayStart = new Date(todayStart)
  yesterdayStart.setDate(yesterdayStart.getDate() - 1)

  let currentStreak = user.weeklyWheelStreak
  const lastSpinDate = user.lastWheelSpinDate ? new Date(user.lastWheelSpinDate) : null

  if (currentStreak > 0 && lastSpinDate && lastSpinDate < yesterdayStart) {
    currentStreak = 0
  }

  // ✅ Seri görevleri için özel kontrol
  if (task.category === 'streak') {
    if (currentStreak < task.targetValue) throw new Error('Görev henüz tamamlanmadı')

    const lastStreakReward = await prisma.userTaskReward.findFirst({
      where: { userId, taskId },
      orderBy: { claimedAt: 'desc' }
    })

    if (lastStreakReward) {
      const rewardClaimedAt = new Date(lastStreakReward.claimedAt)
      const isNewStreak = lastSpinDate && lastSpinDate > rewardClaimedAt
      if (!isNewStreak) throw new Error('Bu görevin ödülü zaten alındı. Yeni bir seri başlatmanız gerekiyor.')
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { points: { increment: task.pointsReward }, xp: { increment: task.xpReward }, weeklyWheelStreak: 0 }
      })

      await tx.userTaskReward.create({
        data: { userId, taskId, claimedAt: now, pointsEarned: task.pointsReward, xpEarned: task.xpReward }
      })

      if (task.pointsReward > 0) {
        await tx.pointHistory.create({
          data: { userId, amount: task.pointsReward, type: 'streak_bonus', description: `${task.targetValue} günlük çark serisi bonusu`, relatedId: taskId, createdAt: now }
        })
      }

      return updatedUser
    })

    await logTaskComplete(userId, taskId, task.title, task.pointsReward, task.xpReward)

    return { success: true, rewards: { points: task.pointsReward, xp: task.xpReward }, pointsEarned: task.pointsReward, xpEarned: task.xpReward, newPoints: result.points, newXp: result.xp, streakReset: true }
  }

  // ✅ Normal görevler için periyod bazlı kontrol
  let existingReward = null

  if (task.category === 'permanent') {
    existingReward = await prisma.userTaskReward.findFirst({ where: { userId, taskId } })
  } else {
    const periodStart = task.category === 'daily' ? todayStart : weekStart
    existingReward = await prisma.userTaskReward.findFirst({
      where: { userId, taskId, claimedAt: { gte: periodStart } }
    })
  }

  if (existingReward) throw new Error('Bu görevin ödülü bu periyodda zaten alındı')

  // ✅ Görev tamamlandı mı kontrol et
  let currentValue = 0

  if (task.taskType === 'send_messages') {
    if (user.telegramId) {
      const telegramUser = await prisma.telegramGroupUser.findUnique({
        where: { telegramId: user.telegramId },
        select: { messageCount: true, dailyMessageCount: true, weeklyMessageCount: true, lastDailyReset: true, lastWeeklyReset: true }
      })

      if (telegramUser) {
        if (task.category === 'permanent') {
          currentValue = telegramUser.messageCount || 0
        } else if (task.category === 'daily') {
          const lastReset = telegramUser.lastDailyReset ? new Date(telegramUser.lastDailyReset) : null
          if (lastReset && lastReset >= todayStart) currentValue = telegramUser.dailyMessageCount || 0
        } else {
          const lastReset = telegramUser.lastWeeklyReset ? new Date(telegramUser.lastWeeklyReset) : null
          if (lastReset && lastReset >= weekStart) currentValue = telegramUser.weeklyMessageCount || 0
        }
      }
    }
  } else if (task.taskType === 'spin_wheel') {
    if (task.category === 'permanent') {
      currentValue = await prisma.wheelSpin.count({ where: { userId } })
    } else {
      const spinStart = task.category === 'daily' ? todayStart : weekStart
      currentValue = await prisma.wheelSpin.count({ where: { userId, spunAt: { gte: spinStart } } })
    }
  }

  if (currentValue < task.targetValue) throw new Error('Görev henüz tamamlanmadı')

  // ✅ Transaction ile ödül ver - CREATE (upsert değil!)
  const result = await prisma.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: { points: { increment: task.pointsReward }, xp: { increment: task.xpReward } }
    })

    await tx.userTaskReward.create({
      data: { userId, taskId, claimedAt: now, pointsEarned: task.pointsReward, xpEarned: task.xpReward }
    })

    if (task.pointsReward > 0) {
      await tx.pointHistory.create({
        data: { userId, amount: task.pointsReward, type: 'task_reward', description: `Görev tamamlandı: ${task.title}`, relatedId: taskId, createdAt: now }
      })
    }

    return updatedUser
  })

  await logTaskComplete(userId, taskId, task.title, task.pointsReward, task.xpReward)

  return { success: true, rewards: { points: task.pointsReward, xp: task.xpReward }, pointsEarned: task.pointsReward, xpEarned: task.xpReward, newPoints: result.points, newXp: result.xp }
}

// ========== HELPER FUNCTIONS ==========

function formatTasksForGuest(tasks: any[]) {
  return tasks.map(task => ({
    id: task.id,
    title: task.title,
    description: task.description,
    category: task.category,
    taskType: task.taskType,
    targetValue: task.targetValue,
    currentProgress: 0,
    xpReward: task.xpReward,
    pointsReward: task.pointsReward,
    progress: `0/${task.targetValue}`,
    completed: false,
    rewardClaimed: false,
    canClaim: false
  }))
}
