import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { requireAuth } from '@/lib/auth'
import { getTurkeyDate, getTurkeyToday } from '@/lib/utils'
import { getCachedData, CacheKeys, CacheTags, CacheTTL, invalidateCache } from '@/lib/enhanced-cache'
import { logWheelSpin, extractRequestInfo } from '@/lib/services/activity-log-service'
import { autoClaimAllEligibleTasks } from '@/lib/services/task-service'

export async function POST(request: NextRequest) {
  try {
    // Session kontrolü
    const session = await requireAuth(request)
    const userId = session.userId

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID required' },
        { status: 400 }
      )
    }

    // Transaction ile race condition koruması
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Get user with current spin count (within transaction)
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          dailySpinsLeft: true,
          points: true,
          xp: true,
          weeklyWheelStreak: true,
          lastWheelSpinDate: true
        }
      })

      if (!user) {
        throw new Error('USER_NOT_FOUND')
      }

      // Check spin count (within transaction to prevent race condition)
      if (user.dailySpinsLeft <= 0) {
        throw new Error('NO_SPINS_LEFT')
      }

      // Get prizes
      const prizes = await tx.wheelPrize.findMany({
        where: { isActive: true },
        orderBy: { order: 'asc' }
      })

      if (prizes.length === 0) {
        throw new Error('NO_PRIZES')
      }

      // Select prize based on probability
      const totalProbability = prizes.reduce((sum: number, prize) => sum + prize.probability, 0)
      let random = Math.random() * totalProbability
      let selectedPrize = prizes[0]

      for (const prize of prizes) {
        random -= prize.probability
        if (random <= 0) {
          selectedPrize = prize
          break
        }
      }

      const selectedIndex = prizes.findIndex(p => p.id === selectedPrize.id)
      console.log(`✅ Kazanılan: ${selectedPrize.name} (${selectedPrize.points} puan)`)

      const turkeyNow = getTurkeyDate()
      const todayStart = getTurkeyToday()
      const yesterdayStart = new Date(todayStart)
      yesterdayStart.setDate(yesterdayStart.getDate() - 1)

      // ✅ STREAK HESABI
      let newStreak = user.weeklyWheelStreak
      const lastSpinDate = user.lastWheelSpinDate ? new Date(user.lastWheelSpinDate) : null
      const isFirstSpinToday = !lastSpinDate || lastSpinDate < todayStart

      // Dün çevirmediyse streak sıfırla
      if (lastSpinDate && lastSpinDate < yesterdayStart) {
        newStreak = 0
      }

      if (isFirstSpinToday) {
        // Bugün ilk çevirme - streak'i artır
        newStreak = newStreak + 1
        console.log(`✅ Streak artırıldı: ${user.weeklyWheelStreak} -> ${newStreak}`)
      }

      // Update user points, spin count, and streak
      const updateData: any = {
        dailySpinsLeft: { decrement: 1 },
        points: { increment: selectedPrize.points },
        lastWheelSpinDate: turkeyNow
      }

      // Streak'i güncelle (sadece bugün ilk çevirme ise)
      if (isFirstSpinToday) {
        updateData.weeklyWheelStreak = newStreak
      }

      await tx.user.update({
        where: { id: userId },
        data: updateData
      })

      // Create spin record
      const wheelSpin = await tx.wheelSpin.create({
        data: {
          userId,
          prizeId: selectedPrize.id,
          pointsWon: selectedPrize.points,
          spunAt: turkeyNow
        }
      })

      // Create point history for wheel win
      await tx.pointHistory.create({
        data: {
          userId,
          amount: selectedPrize.points,
          type: 'wheel_win',
          description: `Çarktan ${selectedPrize.name} kazanıldı`,
          relatedId: wheelSpin.id,
          createdAt: turkeyNow
        }
      })

      return {
        success: true,
        prize: {
          id: selectedPrize.id,
          name: selectedPrize.name,
          points: selectedPrize.points,
          color: selectedPrize.color,
          order: selectedPrize.order
        },
        prizeId: selectedPrize.id,
        pointsWon: selectedPrize.points,
        prizeName: selectedPrize.name,
        prizeIndex: selectedIndex,
        dailySpinsLeft: user.dailySpinsLeft - 1,
        // Streak bilgileri
        streak: {
          current: newStreak,
          isFirstSpinToday: isFirstSpinToday
        },
        wheelSpinId: wheelSpin.id
      }
    })

    // ✅ Cache invalidation
    invalidateCache.leaderboard()
    console.log('🔄 Leaderboard cache temizlendi (çark çevirme)')

    // Activity log
    const requestInfo = extractRequestInfo(request)
    await logWheelSpin(
      userId,
      result.prizeName,
      result.pointsWon,
      result.wheelSpinId,
      requestInfo
    )

    // Çark görevlerini otomatik kontrol et - tamamlandıysa ödülü hemen ver.
    autoClaimAllEligibleTasks(userId, 'spin_wheel').catch((err) =>
      console.error('Otomatik görev ödülü hatası:', err)
    )

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json(
          { error: 'Oturum geçersiz. Lütfen tekrar giriş yapın.' },
          { status: 401 }
        )
      }
      if (error.message === 'USER_NOT_FOUND') {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        )
      }
      if (error.message === 'NO_SPINS_LEFT') {
        return NextResponse.json(
          { error: 'No spins left today' },
          { status: 400 }
        )
      }
      if (error.message === 'NO_PRIZES') {
        return NextResponse.json(
          { error: 'No prizes available' },
          { status: 400 }
        )
      }
    }
    console.error('Wheel spin error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
