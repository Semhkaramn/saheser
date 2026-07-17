import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendTelegramMessage, deleteTelegramMessage } from '../core'
import { SiteConfig } from '@/lib/site-config'
import { getRedisClient } from '../utils/redis-client'
import { GENEL, ISTATISTIK, formatMention } from '../taslaklar'
import { isAnonymousAdmin } from '../utils/anonymous-admin'

/**
 * .me, !me, /me komutu handler
 * Kullanıcının mesaj istatistiklerini gösterir
 * - Botu başlatmışsa: Özel mesajla gönder
 * - Botu başlatmamışsa: Grupta etiketleyerek butonlu mesaj gönder
 *
 * 🔒 ANONİM ADMİN DESTEĞİ:
 * - Anonim adminler için istatistik gösterilemez (gerçek kullanıcı ID'si bilinmiyor)
 */
export async function handleMeCommand(message: any) {
  const chatId = message.chat.id
  const chatType = message.chat.type

  // Sadece gruplarda çalışsın
  if (chatType === 'private') {
    return NextResponse.json({ ok: true })
  }

  // 🔒 ANONİM ADMİN KONTROLÜ
  // Anonim adminlerin gerçek ID'si bilinmediği için istatistik gösterilemez
  if (isAnonymousAdmin(message)) {
    await sendTelegramMessage(
      chatId,
      '👤 <b>Anonim Admin</b>\n\nAnonim olarak mesaj gönderdiğiniz için istatistiklerinizi göremiyorum.\n\n💡 İstatistiklerinizi görmek için kendi hesabınızdan (anonim olmadan) bu komutu kullanın.'
    )
    return NextResponse.json({ ok: true })
  }

  const userId = String(message.from.id)
  const username = message.from.username
  const firstName = message.from.first_name || 'Kullanıcı'

  try {
    // TelegramGroupUser kaydını bul
    const telegramUser = await prisma.telegramGroupUser.findUnique({
      where: { telegramId: userId }
    })

    if (!telegramUser) {
      // Kullanıcı hiç mesaj atmamış
      const mention = formatMention(userId, username, firstName)
      await sendTelegramMessage(
        chatId,
        ISTATISTIK.KAYIT_YOK(mention)
      )
      return NextResponse.json({ ok: true })
    }

    const stats = {
      dailyMessageCount: telegramUser.dailyMessageCount,
      weeklyMessageCount: telegramUser.weeklyMessageCount,
      monthlyMessageCount: telegramUser.monthlyMessageCount,
      messageCount: telegramUser.messageCount
    }

    // ✅ Randy (çekiliş) katılım/kazanma istatistikleri - .ben komutunda da
    // görünsün istendi. RandyParticipant/RandyWinner doğrudan telegramId
    // ile tutuluyor, site hesabına bağlı olmasına gerek yok.
    const [randyParticipationCount, randyWinCount] = await Promise.all([
      prisma.randyParticipant.count({ where: { telegramId: userId } }),
      prisma.randyWinner.count({ where: { telegramId: userId } }),
    ])
    const randyStats = { participated: randyParticipationCount, won: randyWinCount }

    // Siteye bağlıysa (email/şifre ile kayıt olup Telegram'ı bağlamışsa)
    // site verilerini de (puan, rütbe, XP, çark hakkı) aynı mesaja ekle.
    const siteUser = await prisma.user.findUnique({
      where: { telegramId: userId },
      include: { rank: true },
    })
    const siteStats = siteUser
      ? {
          points: siteUser.points,
          xp: siteUser.xp,
          rankName: siteUser.rank?.name || null,
          dailySpinsLeft: siteUser.dailySpinsLeft,
          isBanned: siteUser.isBanned,
        }
      : null

    // Kullanıcı botu başlatmış mı? (hadStart kontrolü)
    if (telegramUser.hadStart) {
      // Botu başlatmış - özel mesajla gönder
      try {
        await sendTelegramMessage(
          userId, // Private mesaj
          ISTATISTIK.FORMAT(firstName, stats, siteStats, randyStats)
        )

        // Grupta da bilgi ver - tıklanabilir link olarak (mention olmadan)
        const botUsername = SiteConfig.telegramBotUsername || 'bot'

        await sendTelegramMessage(
          chatId,
          ISTATISTIK.OZELDEN_GONDERILDI(botUsername)
        )
      } catch (error) {
        // Özel mesaj gönderilemedi (kullanıcı engellemiş olabilir)
        console.error('Failed to send private stats message:', error)
        const mention = formatMention(userId, username, firstName)
        await sendTelegramMessage(
          chatId,
          `${mention}\n\n${ISTATISTIK.FORMAT(firstName, stats, siteStats, randyStats)}`
        )
      }
    } else {
      // Botu başlatmamış - grupta butonlu mesaj gönder
      const mention = formatMention(userId, username, firstName)
      const botUsername = await getBotUsername()

      const keyboard = {
        inline_keyboard: [
          [
            {
              text: ISTATISTIK.ISTATISTIK_BUTONU,
              url: `https://t.me/${botUsername}?start=stats_${userId}`
            }
          ]
        ]
      }

      const result = await sendTelegramMessage(
        chatId,
        ISTATISTIK.BUTONA_TIKLA(mention),
        keyboard
      )

      // Mesaj bilgilerini Redis'e kaydet (kullanıcı botu başlattığında silmek için)
      if (result && result.message_id) {
        const redis = getRedisClient()
        if (redis) {
          const key = `pending_stats_msg:${userId}`
          await redis.setex(key, 3600, JSON.stringify({
            chatId: String(chatId),
            messageId: result.message_id
          }))
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Me command error:', error)
    return NextResponse.json({ ok: true })
  }
}

/**
 * Bot username'ini al (cached)
 */
let cachedBotUsername = ''

async function getBotUsername(): Promise<string> {
  if (cachedBotUsername) {
    return cachedBotUsername
  }

  try {
    const { getTelegramBotToken } = await import('@/lib/site-config')
    const token = getTelegramBotToken()

    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`)
    const data = await response.json()

    if (data.ok && data.result.username) {
      cachedBotUsername = data.result.username
      return cachedBotUsername
    }
  } catch (error) {
    console.error('Failed to get bot username:', error)
  }

  // Fallback - ENV'den oku
  return SiteConfig.telegramBotUsername || 'bot'
}

/**
 * Stats callback handler - kullanıcı butona basıp botu başlattığında çağrılır
 */
export async function handleStatsStart(message: any, targetUserId: string) {
  const userId = String(message.from.id)
  const chatId = message.chat.id
  const firstName = message.from.first_name || 'Kullanıcı'
  const username = message.from.username
  const lastName = message.from.last_name

  // Güvenlik: Sadece kendi istatistiklerini görebilsin
  if (userId !== targetUserId) {
    await sendTelegramMessage(
      chatId,
      ISTATISTIK.BASKASININ_ISTATISTIGI
    )
    return NextResponse.json({ ok: true })
  }

  try {
    // Gruptaki eski mesajı sil (Redis'ten bilgileri al)
    const redis = getRedisClient()
    if (redis) {
      const key = `pending_stats_msg:${userId}`
      const pendingData = await redis.get(key)
      if (pendingData) {
        try {
          // pendingData string veya obje olabilir (Upstash otomatik parse edebilir)
          const data = typeof pendingData === 'string' ? JSON.parse(pendingData) : pendingData
          const { chatId: groupChatId, messageId } = data as { chatId: number; messageId: number }
          await deleteTelegramMessage(groupChatId, messageId)
          await redis.del(key)
        } catch (e) {
          console.error('Failed to delete pending stats message:', e)
        }
      }
    }

    // TelegramGroupUser kaydını bul veya oluştur
    let telegramUser = await prisma.telegramGroupUser.findUnique({
      where: { telegramId: userId }
    })

    if (!telegramUser) {
      // Kullanıcı grupta hiç mesaj atmamış ama butona bastı
      telegramUser = await prisma.telegramGroupUser.create({
        data: {
          telegramId: userId,
          username: username || null,
          firstName: firstName || null,
          lastName: lastName || null,
          hadStart: true,
          messageCount: 0,
          dailyMessageCount: 0,
          weeklyMessageCount: 0,
          monthlyMessageCount: 0
        }
      })
    } else {
      // hadStart'ı güncelle
      await prisma.telegramGroupUser.update({
        where: { telegramId: userId },
        data: {
          hadStart: true,
          username: username || telegramUser.username,
          firstName: firstName || telegramUser.firstName,
          lastName: lastName || telegramUser.lastName
        }
      })
    }

    const stats = {
      dailyMessageCount: telegramUser.dailyMessageCount,
      weeklyMessageCount: telegramUser.weeklyMessageCount,
      monthlyMessageCount: telegramUser.monthlyMessageCount,
      messageCount: telegramUser.messageCount
    }

    const siteUserForStart = await prisma.user.findUnique({
      where: { telegramId: userId },
      include: { rank: true },
    })
    const siteStats = siteUserForStart
      ? {
          points: siteUserForStart.points,
          xp: siteUserForStart.xp,
          rankName: siteUserForStart.rank?.name || null,
          dailySpinsLeft: siteUserForStart.dailySpinsLeft,
          isBanned: siteUserForStart.isBanned,
        }
      : null

    const [randyParticipationCountStart, randyWinCountStart] = await Promise.all([
      prisma.randyParticipant.count({ where: { telegramId: userId } }),
      prisma.randyWinner.count({ where: { telegramId: userId } }),
    ])
    const randyStats = { participated: randyParticipationCountStart, won: randyWinCountStart }

    // İstatistikleri gönder
    await sendTelegramMessage(
      chatId,
      ISTATISTIK.FORMAT(firstName, stats, siteStats, randyStats)
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Stats start error:', error)
    await sendTelegramMessage(
      chatId,
      GENEL.HATA_GENEL
    )
    return NextResponse.json({ ok: true })
  }
}
