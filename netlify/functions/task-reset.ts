import { schedule } from '@netlify/functions'
import { getPrisma, disconnectPrisma, withTimeout } from './lib/prisma'

/**
 * ✅ FIX: Türkiye saatine göre bugünün başlangıcını UTC olarak döndürür
 */
const getTurkeyToday = (): Date => {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const parts = formatter.formatToParts(now)
  const values: Record<string, number> = {}

  for (const part of parts) {
    if (part.type !== 'literal') {
      values[part.type] = Number.parseInt(part.value)
    }
  }

  const testDate = new Date(Date.UTC(values.year, values.month - 1, values.day, 12, 0, 0))
  const turkeyHourStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Istanbul',
    hour: '2-digit',
    hour12: false
  }).format(testDate)
  const turkeyHour = Number.parseInt(turkeyHourStr)
  const offset = turkeyHour - 12
  const midnightUTC = new Date(Date.UTC(values.year, values.month - 1, values.day, 0 - offset, 0, 0))

  return midnightUTC
}

/**
 * ✅ FIX: Türkiye saatine göre bu haftanın başlangıcını (Pazartesi 00:00) UTC olarak döndürür
 */
const getTurkeyWeekStart = (): Date => {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const parts = formatter.formatToParts(now)
  const values: Record<string, number> = {}

  for (const part of parts) {
    if (part.type !== 'literal') {
      values[part.type] = Number.parseInt(part.value)
    }
  }

  const dayFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Istanbul',
    weekday: 'short'
  })
  const dayName = dayFormatter.format(now)
  const dayMap: Record<string, number> = {
    'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
  }
  const turkeyDayOfWeek = dayMap[dayName] || 0

  const turkeyDate = new Date(Date.UTC(values.year, values.month - 1, values.day))
  const diff = turkeyDayOfWeek === 0 ? -6 : 1 - turkeyDayOfWeek

  const mondayDate = new Date(turkeyDate)
  mondayDate.setUTCDate(turkeyDate.getUTCDate() + diff)

  const testDate = new Date(Date.UTC(mondayDate.getUTCFullYear(), mondayDate.getUTCMonth(), mondayDate.getUTCDate(), 12, 0, 0))
  const turkeyHourStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Istanbul',
    hour: '2-digit',
    hour12: false
  }).format(testDate)
  const offset = Number.parseInt(turkeyHourStr) - 12

  return new Date(Date.UTC(mondayDate.getUTCFullYear(), mondayDate.getUTCMonth(), mondayDate.getUTCDate(), 0 - offset, 0, 0))
}

/**
 * ✅ Türkiye saatine göre bugün Pazartesi mi kontrol et
 */
const isTurkeyMonday = (): boolean => {
  const now = new Date()
  const dayFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Istanbul',
    weekday: 'short'
  })
  return dayFormatter.format(now) === 'Mon'
}

/**
 * ✅ Türkiye saatine göre bugün ayın 1. günü mü kontrol et
 * Ayın 1. günü aylık mesaj sayıları sıfırlanır
 */
const isTurkeyFirstDayOfMonth = (): boolean => {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Istanbul',
    day: '2-digit'
  })
  const dayStr = formatter.format(now)
  return Number.parseInt(dayStr) === 1
}

/**
 * Cron Job: Her gün 21:01 UTC (Türkiye saati 00:01) çalışır
 *
 * ✅ GÜNLÜK SIFIRLAMA:
 * - Tüm TelegramGroupUser.dailyMessageCount = 0
 * - Günlük görevler için eski UserTaskReward kayıtlarını sil
 * - Çark streak: Dün çevirmeyen kullanıcıların streak'ini sıfırla
 *
 * ✅ HAFTALIK SIFIRLAMA (Pazartesi):
 * - Tüm TelegramGroupUser.weeklyMessageCount = 0
 * - Haftalık görevler için eski UserTaskReward kayıtlarını sil
 *
 * ✅ AYLIK SIFIRLAMA (Ayın 1. günü):
 * - Tüm TelegramGroupUser.monthlyMessageCount = 0
 */
const handler = schedule('1 21 * * *', async () => {
  const prisma = getPrisma()

  try {
    const now = new Date()
    const todayStart = getTurkeyToday()
    const weekStart = getTurkeyWeekStart()
    const isMonday = isTurkeyMonday()
    const isFirstDayOfMonth = isTurkeyFirstDayOfMonth()

    // Dünün başlangıcı (streak kontrolü için)
    const yesterdayStart = new Date(todayStart)
    yesterdayStart.setDate(yesterdayStart.getDate() - 1)

    console.log('🔄 Task Reset Job başladı:', {
      now: now.toISOString(),
      todayStart: todayStart.toISOString(),
      weekStart: weekStart.toISOString(),
      isMonday,
      isFirstDayOfMonth
    })

    // ========== 1. TELEGRAM GROUP USER MESAJ SAYISI SIFIRLAMA ==========

    const resetDailyMessages = await withTimeout(
      prisma.telegramGroupUser.updateMany({
        data: {
          dailyMessageCount: 0,
          lastDailyReset: now
        }
      }),
      5000,
      'Reset daily messages'
    )
    console.log(`✅ Günlük mesaj sayıları sıfırlandı: ${resetDailyMessages.count} kullanıcı`)

    let resetWeeklyMessages = { count: 0 }
    if (isMonday) {
      resetWeeklyMessages = await withTimeout(
        prisma.telegramGroupUser.updateMany({
          data: {
            weeklyMessageCount: 0,
            lastWeeklyReset: now
          }
        }),
        5000,
        'Reset weekly messages'
      )
      console.log(`✅ Haftalık mesaj sayıları sıfırlandı: ${resetWeeklyMessages.count} kullanıcı`)
    }

    let resetMonthlyMessages = { count: 0 }
    if (isFirstDayOfMonth) {
      resetMonthlyMessages = await withTimeout(
        prisma.telegramGroupUser.updateMany({
          data: {
            monthlyMessageCount: 0,
            lastMonthlyReset: now
          }
        }),
        5000,
        'Reset monthly messages'
      )
      console.log(`✅ Aylık mesaj sayıları sıfırlandı: ${resetMonthlyMessages.count} kullanıcı`)
    }

    // ========== 2. GÜNLÜK GÖREV ÖDÜL KAYITLARI ==========
    // ✅ NOT: Eski kayıtlar artık SİLİNMİYOR - tüm görev geçmişi saklanıyor
    // Bunun yerine task-service.ts'de periyod bazlı kontrol yapılıyor
    console.log('ℹ️ Günlük görev ödül kayıtları saklanıyor (silinmiyor)')
    const deletedDaily = 0

    // ========== 3. HAFTALIK GÖREV ÖDÜL KAYITLARI ==========
    // ✅ NOT: Eski kayıtlar artık SİLİNMİYOR - tüm görev geçmişi saklanıyor
    console.log('ℹ️ Haftalık görev ödül kayıtları saklanıyor (silinmiyor)')
    const deletedWeekly = 0

    // ========== 4. ÇARK STREAK SIFIRLAMA ==========
    // Dün çark çevirmeyen kullanıcıların streak'ini sıfırla

    // Dün çark çeviren kullanıcı ID'lerini bul
    const usersWhoSpunYesterday = await withTimeout(
      prisma.wheelSpin.findMany({
        where: {
          spunAt: {
            gte: yesterdayStart,
            lt: todayStart
          }
        },
        select: { userId: true },
        distinct: ['userId']
      }),
      5000,
      'Find yesterday wheel spins'
    )
    const activeUserIds = usersWhoSpunYesterday.map(u => u.userId)

    // Streak'i olan ama dün çevirmeyen kullanıcıları sıfırla
    const resetStreak = await withTimeout(
      prisma.user.updateMany({
        where: {
          weeklyWheelStreak: { gt: 0 },
          id: { notIn: activeUserIds }
        },
        data: {
          weeklyWheelStreak: 0
        }
      }),
      5000,
      'Reset wheel streak'
    )
    console.log(`✅ Çark streak sıfırlandı: ${resetStreak.count} kullanıcı`)

    console.log('✅ Task Reset Job tamamlandı:', {
      dailyMessagesReset: resetDailyMessages.count,
      weeklyMessagesReset: resetWeeklyMessages.count,
      monthlyMessagesReset: resetMonthlyMessages.count,
      deletedDaily,
      deletedWeekly,
      streakReset: resetStreak.count
    })

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Görevler ve mesaj sayıları sıfırlandı',
        timestamp: now.toISOString(),
        isMonday,
        isFirstDayOfMonth,
        dailyMessagesReset: resetDailyMessages.count,
        weeklyMessagesReset: resetWeeklyMessages.count,
        monthlyMessagesReset: resetMonthlyMessages.count,
        deletedDaily,
        deletedWeekly,
        streakReset: resetStreak.count
      })
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const isTimeout = errorMessage.includes('timed out')

    console.error('❌ Görev sıfırlama hatası:', isTimeout ? 'Operation timed out' : errorMessage)

    return {
      statusCode: 200, // Return 200 to prevent retries
      body: JSON.stringify({
        error: isTimeout ? 'Operation timeout' : 'Görev sıfırlama başarısız',
        message: errorMessage
      })
    }
  } finally {
    await disconnectPrisma()
  }
})

export { handler }
