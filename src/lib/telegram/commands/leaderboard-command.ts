import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendTelegramMessage, checkTelegramAdmin } from '@/lib/telegram/core'
import { isAnonymousAdmin, canAnonymousAdminUseCommands } from '../utils/anonymous-admin'

/**
 * Günlük, haftalık veya aylık mesaj liderlik tablosu komutu
 *
 * .günlük - Günlük mesaj sayısına göre ilk 10 kullanıcı
 * .haftalık - Haftalık mesaj sayısına göre ilk 10 kullanıcı
 * .aylık - Aylık mesaj sayısına göre ilk 10 kullanıcı
 *
 * ⚠️ SADECE ADMİNLER kullanabilir
 * ⚠️ SADECE Activity Group'ta çalışır
 *
 * 🔒 ANONİM ADMİN DESTEĞİ:
 * - Anonim adminler (GroupAnonymousBot) bu komutu kullanabilir
 */
export async function handleLeaderboardCommand(message: any, type: 'daily' | 'weekly' | 'monthly') {
  const chatId = message.chat.id

  // 🔒 ANONİM ADMİN KONTROLÜ
  const isAnonymous = isAnonymousAdmin(message)
  const userId = isAnonymous ? null : message.from?.id

  // Anonim değilse ve userId yoksa çık
  if (!isAnonymous && !userId) {
    return NextResponse.json({ ok: true })
  }

  try {
    // Admin kontrolü - anonim veya normal
    let isAdmin = false
    if (isAnonymous) {
      // Anonim admin kontrolü
      isAdmin = canAnonymousAdminUseCommands(message)
    } else {
      // Normal admin kontrolü
      isAdmin = await checkTelegramAdmin(chatId, userId)
    }

    if (!isAdmin) {
      // Admin değilse sessizce çık
      console.log(`⛔ Non-admin tried leaderboard command: userId=${userId || 'anonymous'}`)
      return NextResponse.json({ ok: true })
    }

    // Leaderboard verilerini al
    const orderField = type === 'daily'
      ? 'dailyMessageCount'
      : type === 'weekly'
        ? 'weeklyMessageCount'
        : 'monthlyMessageCount'

    const topUsers = await prisma.telegramGroupUser.findMany({
      where: {
        [orderField]: { gt: 0 }
      },
      orderBy: {
        [orderField]: 'desc'
      },
      take: 10,
      select: {
        telegramId: true,
        username: true,
        firstName: true,
        lastName: true,
        dailyMessageCount: true,
        weeklyMessageCount: true,
        monthlyMessageCount: true
      }
    })

    if (topUsers.length === 0) {
      const noDataMessage = type === 'daily'
        ? '📊 <b>Günlük Mesaj Sıralaması</b>\n\n⚠️ Henüz bugün mesaj atan kullanıcı yok.'
        : type === 'weekly'
          ? '📊 <b>Haftalık Mesaj Sıralaması</b>\n\n⚠️ Henüz bu hafta mesaj atan kullanıcı yok.'
          : '📅 <b>Aylık Mesaj Sıralaması</b>\n\n⚠️ Henüz bu ay mesaj atan kullanıcı yok.'

      await sendTelegramMessage(chatId, noDataMessage, { parseMode: 'HTML' })
      return NextResponse.json({ ok: true })
    }

    // Sıralama mesajını oluştur
    const title = type === 'daily'
      ? '📊 <b>Günlük Mesaj Sıralaması</b>'
      : type === 'weekly'
        ? '📊 <b>Haftalık Mesaj Sıralaması</b>'
        : '📅 <b>Aylık Mesaj Sıralaması</b>'

    const periodText = type === 'daily' ? 'Bugünkü' : type === 'weekly' ? 'Bu hafta' : 'Bu ay'

    let leaderboardText = `${title}\n\n`

    const medals = ['🥇', '🥈', '🥉']

    topUsers.forEach((user, index) => {
      const medal = medals[index] || `${index + 1}.`
      const displayName = user.username
        ? `@${user.username}`
        : user.firstName
          ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}`
          : `Kullanıcı ${user.telegramId.slice(-4)}`

      const messageCount = type === 'daily'
        ? user.dailyMessageCount
        : type === 'weekly'
          ? user.weeklyMessageCount
          : user.monthlyMessageCount

      leaderboardText += `${medal} ${displayName} — <b>${messageCount}</b> mesaj\n`
    })

    leaderboardText += `\n💬 ${periodText} en aktif ${topUsers.length} kullanıcı`

    await sendTelegramMessage(chatId, leaderboardText, { parseMode: 'HTML' })

    console.log(`✅ Leaderboard sent: type=${type}, chatId=${chatId}, by admin=${userId}`)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('❌ Leaderboard command error:', error)
    return NextResponse.json({ ok: true })
  }
}
