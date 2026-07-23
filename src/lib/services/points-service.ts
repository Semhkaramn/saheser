import { prisma } from '@/lib/prisma'
import { getTurkeyDate, getTurkeyToday, getTurkeyWeekStart, getTurkeyMonthStart } from '@/lib/utils'
import { SiteConfig, getDynamicSettings } from '@/lib/site-config'
import { checkCooldown, setCooldown } from '@/lib/telegram/utils/cooldown-check'
import { invalidateCache } from '@/lib/enhanced-cache'
import { sendTelegramMessage } from '@/lib/telegram/core'
import { RUTBE } from '@/lib/telegram/taslaklar'
import { logActivity } from '@/lib/services/activity-log-service'
import { GROUP_ANONYMOUS_BOT_ID, TELEGRAM_SERVICE_ACCOUNT_ID } from '@/lib/telegram/utils/anonymous-admin'
import { autoClaimAllEligibleTasks } from '@/lib/services/task-service'

// Types
export interface MessageRewardInput {
  userId: string
  username?: string
  firstName?: string
  lastName?: string
  messageText: string
  isMediaMessage?: boolean
  chatId: number
}

export interface MessageRewardResult {
  success: boolean
  reason?: string
  pointsAdded?: number
  xpAdded?: number
  newLevel?: string
}

/**
 * Level up bildirimi gönder
 */
async function notifyLevelUp(
  userId: string,
  displayName: string,
  rankInfo: { icon: string; name: string; xp: number }
): Promise<boolean> {
  try {
    console.log(`🎯 Level up notification attempt: userId=${userId}, rank=${rankInfo.name}, xp=${rankInfo.xp}`)

    // 🚀 OPTIMIZED: Check notification setting from DB/cache
    const settings = await getDynamicSettings()

    // Check if level up notifications are enabled
    if (settings.notifyLevelUp === false) {
      console.log('⏭️ Level up notifications disabled in settings')
      return false
    }

    const groupChatId = SiteConfig.activityGroupId

    if (!groupChatId) {
      console.error('❌ Group chat ID (ACTIVITY_GROUP_ID) not set in ENV')
      return false
    }

    console.log(`📤 Sending level up message to group: ${groupChatId}`)

    // Merkezi mesaj şablonunu kullan (taslaklar.ts)
    const message = RUTBE.SEVIYE_ATLADI(rankInfo.icon, rankInfo.name, rankInfo.xp, userId, displayName)

    const result = await sendTelegramMessage(groupChatId, message)
    console.log(`✅ Level up notification sent successfully:`, result)
    return true
  } catch (error) {
    console.error('❌ Error sending level up notification:', error)
    return false
  }
}

/**
 * Throttled leaderboard cache invalidation
 */
async function invalidateLeaderboardCacheThrottled() {
  invalidateCache.leaderboardThrottled()
}

export async function processMessageReward(
  input: MessageRewardInput
): Promise<MessageRewardResult> {
  const { userId, username, firstName, lastName, messageText, isMediaMessage, chatId } = input

  // 🔒 CRITICAL: Anonim admin ve Telegram servis hesabını veritabanına KAYDETME!
  // Bu hesaplar puan kazanmamalı ve leaderboard'a eklenmemeli
  const userIdNum = Number(userId)
  if (userIdNum === GROUP_ANONYMOUS_BOT_ID) {
    console.log(`🚫 Anonim admin (GroupAnonymousBot) - veritabanına kaydedilmiyor: ${userId}`)
    return { success: false, reason: 'Anonymous admin - not tracked' }
  }
  if (userIdNum === TELEGRAM_SERVICE_ACCOUNT_ID) {
    console.log(`🚫 Telegram servis hesabı - veritabanına kaydedilmiyor: ${userId}`)
    return { success: false, reason: 'Telegram service account - not tracked' }
  }

  // 1️⃣ Ayarları ENV'den al (DB sorgusu YOK - daha hızlı!)
  const minMessageLength = SiteConfig.minMessageLength
  const messageCooldown = SiteConfig.messageCooldownSeconds
  const pointsPerMessage = SiteConfig.pointsPerMessage
  const xpPerMessage = SiteConfig.xpPerMessage
  const messagesForXp = SiteConfig.messagesForXp

  // 2️⃣ Türkiye zaman bilgileri
  const turkeyNow = getTurkeyDate()
  const todayStart = getTurkeyToday()
  const weekStart = getTurkeyWeekStart()
  const monthStart = getTurkeyMonthStart()

  // 3️⃣ 🚀 FIX: Tüm DB işlemlerini tek transaction içinde yap
  const result = await prisma.$transaction(async (tx) => {
    // TelegramGroupUser'ı al (reset kontrolü için)
    const existingTgUser = await tx.telegramGroupUser.findUnique({
      where: { telegramId: userId },
      select: {
        lastDailyReset: true,
        lastWeeklyReset: true,
        lastMonthlyReset: true,
        messageCount: true,
        linkedUserId: true,
        linkedUser: {
          select: {
            id: true,
            siteUsername: true,
            email: true,
            points: true,
            xp: true,
            rankId: true,
            isBanned: true,
            telegramUsername: true,
            firstName: true,
            lastName: true,
            rank: {
              select: {
                id: true,
                name: true,
                icon: true,
                minXp: true
              }
            }
          }
        }
      }
    })

    // TelegramGroupUser güncelle - MESAJ SAYISI HER ZAMAN ARTIRILIR
    // NOT: Günlük/Haftalık/Aylık reset'ler cron job ile yapılıyor (task-reset.ts)
    const telegramGroupUser = await tx.telegramGroupUser.upsert({
      where: { telegramId: userId },
      update: {
        username: username || undefined,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        messageCount: { increment: 1 },
        dailyMessageCount: { increment: 1 },
        weeklyMessageCount: { increment: 1 },
        monthlyMessageCount: { increment: 1 },
        lastMessageAt: turkeyNow,
        lastGroupId: chatId ? String(chatId) : undefined,
        hadStart:
          messageText === '/start' || messageText.startsWith('/start ')
            ? true
            : undefined
      },
      create: {
        telegramId: userId,
        username: username || null,
        firstName: firstName || null,
        lastName: lastName || null,
        messageCount: 1,
        dailyMessageCount: 1,
        weeklyMessageCount: 1,
        monthlyMessageCount: 1,
        lastMessageAt: turkeyNow,
        lastGroupId: chatId ? String(chatId) : null,
        lastDailyReset: turkeyNow,
        lastWeeklyReset: turkeyNow,
        lastMonthlyReset: turkeyNow,
        hadStart:
          messageText === '/start' || messageText.startsWith('/start ')
      }
    })

    return {
      existingTgUser,
      telegramGroupUser
    }
  })

  const { existingTgUser, telegramGroupUser } = result

  // 4️⃣ Mesaj uzunluğu kontrolü - SADECE PUAN/XP İÇİN
  if (!isMediaMessage && messageText.length < minMessageLength) {
    return { success: false, reason: 'Message too short' }
  }

  // 5️⃣ Cooldown kontrolü (REDIS'ten) - SADECE PUAN/XP İÇİN
  const cooldownRemaining = await checkCooldown(userId, messageCooldown)
  if (cooldownRemaining > 0) {
    return { success: false, reason: 'Cooldown active' }
  }

  // 6️⃣ linkedUserId kontrolü
  if (!existingTgUser?.linkedUserId) {
    return { success: false, reason: 'User not linked to website' }
  }

  // 🚀 OPTIMIZATION: Use linkedUser from previous query (no additional DB query!)
  const user = existingTgUser.linkedUser

  if (!user) {
    return { success: false, reason: 'User not found' }
  }

  // 🔄 Telegram bilgileri DEĞİŞTİYSE User tablosunda güncelle
  // Kullanıcı Telegram profilini değiştirdiyse, sitedeki bilgiler de güncellensin
  // 🚀 OPTIMIZATION: Sadece gerçekten değişen bilgileri güncelle (her mesajda güncelleme yapma!)
  const needsTelegramInfoUpdate =
    (username && user.telegramUsername !== username) ||
    (firstName && user.firstName !== firstName) ||
    (lastName && user.lastName !== lastName)

  if (needsTelegramInfoUpdate) {
    console.log(`🔄 User telegram info changed - updating: userId=${user.id}, username=${username}, firstName=${firstName}`)

    // Sadece değişen alanları güncelle
    const updateData: Record<string, string> = {}
    if (username && user.telegramUsername !== username) {
      updateData.telegramUsername = username
    }
    if (firstName && user.firstName !== firstName) {
      updateData.firstName = firstName
    }
    if (lastName && user.lastName !== lastName) {
      updateData.lastName = lastName
    }

    // Async olarak güncelle (ana akışı bloklama)
    prisma.user.update({
      where: { id: user.id },
      data: updateData
    }).catch(err => console.error('User telegram info update error:', err))
  }

  // 7️⃣ XP verilecek mi?
  const currentMessageCount = telegramGroupUser.messageCount
  const shouldGiveXp = currentMessageCount % messagesForXp === 0

  // 8️⃣ 🚀 FIX: Puan, XP ve Rank güncellemesini tek transaction'da yap
  const rewardResult = await prisma.$transaction(async (tx) => {
    // Puan ve XP ekle
    const updatedUser = await tx.user.update({
      where: { id: user.id },
      data: {
        points: { increment: pointsPerMessage },
        xp: shouldGiveXp ? { increment: xpPerMessage } : undefined
      }
    })

    // ✅ FIX: Her XP güncellemesinde seviye kontrolü yap (milestone kontrolü kaldırıldı)
    // Bu sayede hiçbir seviye atlama kaçırılmaz
    let newRank = null
    let rankPointsAwarded = 0
    if (shouldGiveXp) {
      // Yeni rank kontrolü - kullanıcının XP'sine uygun en yüksek rank
      const currentRank = await tx.rank.findFirst({
        where: { minXp: { lte: updatedUser.xp } },
        orderBy: { minXp: 'desc' },
        select: {
          id: true,
          name: true,
          icon: true,
          color: true,
          minXp: true,
          pointsReward: true
        }
      })

      // Rank değişti mi kontrol et
      if (currentRank && user.rankId !== currentRank.id) {
        console.log(`🆙 Rank change detected: userId=${user.id}, oldRankId=${user.rankId}, newRankId=${currentRank.id}, xp=${updatedUser.xp}`)

        // ✅ Rütbe yükselme ödülü - pointsReward varsa puan ekle
        if (currentRank.pointsReward && currentRank.pointsReward > 0) {
          rankPointsAwarded = currentRank.pointsReward

          await tx.user.update({
            where: { id: user.id },
            data: {
              rankId: currentRank.id,
              points: { increment: currentRank.pointsReward }
            }
          })

          // Puan geçmişine kaydet
          await tx.pointHistory.create({
            data: {
              userId: user.id,
              amount: currentRank.pointsReward,
              type: 'rank_up',
              description: `${currentRank.name} rütbesine yükseldi`,
              relatedId: currentRank.id
            }
          })

          console.log(`💰 Rank reward added: userId=${user.id}, rank=${currentRank.name}, points=${currentRank.pointsReward}`)
        } else {
          await tx.user.update({
            where: { id: user.id },
            data: { rankId: currentRank.id }
          })
        }

        newRank = currentRank
      }
    }

    return { updatedUser, newRank, rankPointsAwarded }
  })

  // 9️⃣ Cooldown ayarla (REDIS'e)
  await setCooldown(userId, messageCooldown)

  // 🔟 Leaderboard cache'i throttled şekilde temizle
  await invalidateLeaderboardCacheThrottled()

  // 1️⃣1️⃣ Seviye atlama bildirimi (transaction dışında - async)
  if (rewardResult.newRank) {
    notifyLevelUp(
      userId,
      firstName || username || 'Kullanıcı',
      {
        icon: rewardResult.newRank.icon,
        name: rewardResult.newRank.name,
        xp: rewardResult.updatedUser.xp
      }
    ).catch(err => console.error('Level up notification error:', err))

    // 1️⃣2️⃣ Rütbe yükselme aktivite log'u
    logActivity({
      userId: existingTgUser.linkedUserId!,
      actionType: 'rank_up',
      actionTitle: `${rewardResult.newRank.name} rütbesine yükseldi`,
      actionDescription: rewardResult.rankPointsAwarded > 0
        ? `+${rewardResult.rankPointsAwarded} puan ödülü kazanıldı`
        : undefined,
      newValue: rewardResult.newRank.name,
      relatedId: rewardResult.newRank.id,
      relatedType: 'rank',
      metadata: {
        rankName: rewardResult.newRank.name,
        rankIcon: rewardResult.newRank.icon,
        pointsReward: rewardResult.rankPointsAwarded,
        newXp: rewardResult.updatedUser.xp
      }
    }).catch(err => console.error('Rank up log error:', err))
  }

  // 1️⃣3️⃣ Mesaj sayısı görevlerini otomatik kontrol et - tamamlandıysa ödülü
  // hemen ver, kullanıcının "ödülü al" butonuna basmasını beklemeden.
  autoClaimAllEligibleTasks(existingTgUser.linkedUserId!, 'send_messages').catch((err) =>
    console.error('Otomatik görev ödülü hatası:', err)
  )

  return {
    success: true,
    pointsAdded: pointsPerMessage,
    xpAdded: shouldGiveXp ? xpPerMessage : 0
  }
}
