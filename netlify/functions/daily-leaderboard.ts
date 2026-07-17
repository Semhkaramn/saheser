import { schedule } from '@netlify/functions'
import { getPrisma, disconnectPrisma, withTimeout } from './lib/prisma'

/**
 * Telegram API ile mesaj gönder (with timeout)
 */
async function sendTelegramMessage(chatId: string, text: string): Promise<boolean> {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    if (!botToken) {
      console.error('❌ TELEGRAM_BOT_TOKEN not configured')
      return false
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true }
      }),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    const data = await response.json()
    if (!data.ok) {
      console.error(`❌ Telegram API error: ${data.description}`)
      return false
    }

    return true
  } catch (error) {
    console.error('❌ Error sending telegram message:', error)
    return false
  }
}

/**
 * Kullanıcı mention oluştur (username varsa @username, yoksa mention link)
 */
function formatUserMention(telegramId: string, username: string | null, firstName: string | null): string {
  if (username) {
    return `@${username}`
  }
  const name = firstName || 'Kullanıcı'
  return `<a href="tg://user?id=${telegramId}">${name}</a>`
}

/**
 * Bugün Pazar mı kontrol et (Türkiye saatine göre)
 * Pazar günü haftalık sıralama gönderilir
 */
function isSundayInTurkey(): boolean {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Istanbul',
    weekday: 'short'
  })
  const dayName = formatter.format(now)
  return dayName === 'Sun'
}

/**
 * Bugün ayın son günü mü kontrol et (Türkiye saatine göre)
 * Ayın son günü aylık sıralama gönderilir
 */
function isLastDayOfMonthInTurkey(): boolean {
  const now = new Date()

  // Türkiye saatine göre bugünün tarihini al
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })

  const parts = formatter.formatToParts(now)
  const values: Record<string, number> = {}

  for (const part of parts) {
    if (part.type !== 'literal') {
      values[part.type] = Number.parseInt(part.value)
    }
  }

  const currentDay = values.day
  const currentMonth = values.month
  const currentYear = values.year

  // Bu ayın son gününü bul
  // Sonraki ayın 0. günü = bu ayın son günü
  const lastDayOfMonth = new Date(currentYear, currentMonth, 0).getDate()

  return currentDay === lastDayOfMonth
}

/**
 * Leaderboard mesajı oluştur
 */
function formatLeaderboard(
  title: string,
  users: Array<{ telegramId: string; username: string | null; firstName: string | null; count: number }>,
  period: 'daily' | 'weekly' | 'monthly'
): string {
  if (users.length === 0) {
    return `${title}\n\n📭 Bu dönemde henüz mesaj yazan yok.`
  }

  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟']

  const lines = users.map((user, index) => {
    const medal = medals[index] || `${index + 1}.`
    const mention = formatUserMention(user.telegramId, user.username, user.firstName)
    return `${medal} ${mention} — <b>${user.count.toLocaleString()}</b> mesaj`
  })

  return `${title}\n\n${lines.join('\n')}`
}

/**
 * Cron Job: Her gün 20:59 UTC (Türkiye saati 23:59) çalışır
 *
 * ⚠️ ÖNEMLİ: Bu job task-reset.ts'den (21:00 UTC) ÖNCE çalışır!
 * Önce sıralama gönderilir, sonra mesaj sayıları sıfırlanır.
 *
 * 📋 ÇALIŞMA MANTIĞI (ÖNCELİK SIRASI):
 * 1. Ayın son günü: SADECE aylık leaderboard gönderir (haftalık ve günlük atlanır)
 * 2. Pazar: SADECE haftalık leaderboard gönderir (günlük atlanır)
 * 3. Diğer günler: SADECE günlük leaderboard gönderir
 *
 * Her gün YALNIZCA BİR leaderboard gönderilir!
 */
const handler = schedule('59 20 * * *', async () => {
  const prisma = getPrisma()

  try {
    const activityGroupId = process.env.ACTIVITY_GROUP_ID
    if (!activityGroupId) {
      return {
        statusCode: 200,
        body: JSON.stringify({ success: false, reason: 'No activity group configured' })
      }
    }

    const isSunday = isSundayInTurkey()
    const isLastDayOfMonth = isLastDayOfMonthInTurkey()
    let userCount = 0
    let messagesSent: string[] = []

    // Ayın son günü ise SADECE aylık leaderboard gönder (haftalık ve günlük atlanır)
    if (isLastDayOfMonth) {
      const monthlyUsers = await withTimeout(
        prisma.telegramGroupUser.findMany({
          where: {
            monthlyMessageCount: { gt: 0 }
          },
          orderBy: { monthlyMessageCount: 'desc' },
          take: 10,
          select: {
            telegramId: true,
            username: true,
            firstName: true,
            monthlyMessageCount: true
          }
        }),
        6000,
        'Monthly leaderboard query'
      )

      const monthlyMessage = formatLeaderboard(
        '📅 <b>Ayın En Aktif Üyeleri</b>',
        monthlyUsers.map(u => ({
          telegramId: u.telegramId,
          username: u.username,
          firstName: u.firstName,
          count: u.monthlyMessageCount
        })),
        'monthly'
      )

      await sendTelegramMessage(activityGroupId, monthlyMessage)
      userCount = monthlyUsers.length
      messagesSent.push('monthly')
      // Ayın son günü sadece aylık gönderilir, haftalık ve günlük atlanır
    } else if (isSunday) {
      // Pazar ise SADECE haftalık gönder (günlük atlanır)
      const weeklyUsers = await withTimeout(
        prisma.telegramGroupUser.findMany({
          where: {
            weeklyMessageCount: { gt: 0 }
          },
          orderBy: { weeklyMessageCount: 'desc' },
          take: 10,
          select: {
            telegramId: true,
            username: true,
            firstName: true,
            weeklyMessageCount: true
          }
        }),
        6000,
        'Weekly leaderboard query'
      )

      const weeklyMessage = formatLeaderboard(
        '📈 <b>Haftanın En Aktif Üyeleri</b>',
        weeklyUsers.map(u => ({
          telegramId: u.telegramId,
          username: u.username,
          firstName: u.firstName,
          count: u.weeklyMessageCount
        })),
        'weekly'
      )

      await sendTelegramMessage(activityGroupId, weeklyMessage)
      userCount = weeklyUsers.length
      messagesSent.push('weekly')
      // Pazar günü sadece haftalık gönderilir, günlük atlanır
    } else {
      // Normal gün - sadece günlük leaderboard gönder
      const dailyUsers = await withTimeout(
        prisma.telegramGroupUser.findMany({
          where: {
            dailyMessageCount: { gt: 0 }
          },
          orderBy: { dailyMessageCount: 'desc' },
          take: 10,
          select: {
            telegramId: true,
            username: true,
            firstName: true,
            dailyMessageCount: true
          }
        }),
        6000,
        'Daily leaderboard query'
      )

      const dailyMessage = formatLeaderboard(
        '📊 <b>Günün En Aktif Üyeleri</b>',
        dailyUsers.map(u => ({
          telegramId: u.telegramId,
          username: u.username,
          firstName: u.firstName,
          count: u.dailyMessageCount
        })),
        'daily'
      )

      await sendTelegramMessage(activityGroupId, dailyMessage)
      userCount = dailyUsers.length
      messagesSent.push('daily')
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: `Leaderboard gönderildi: ${messagesSent.join(', ')}`,
        userCount,
        isSunday,
        isLastDayOfMonth,
        messagesSent
      })
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const isTimeout = errorMessage.includes('timed out')

    console.error('❌ Leaderboard gönderme hatası:', isTimeout ? 'Operation timed out' : errorMessage)

    return {
      statusCode: 200, // Return 200 to prevent retries
      body: JSON.stringify({
        error: isTimeout ? 'Operation timeout' : 'Leaderboard gönderme başarısız',
        message: errorMessage
      })
    }
  } finally {
    await disconnectPrisma()
  }
})

export { handler }
