import { prisma } from '@/lib/prisma'
import { sendTelegramMessage, shiftEntitiesForEmbeddedText } from '../core'
import { isBotSystemEnabled } from '../bot-system-check'

interface SendBroadcastInput {
  message: string
  entities?: any[]
  adminTelegramId?: string
  adminUsername?: string
}

interface SendBroadcastResult {
  success: boolean
  queuedCount: number
  skippedCount: number
  totalUsers: number
  broadcastId?: string
  error?: string
}

/**
 * Tüm site kullanıcılarına (botu başlatmış olan) toplu mesaj gönderir.
 * Hem eski web formundan hem de bot DM panelinden çağrılabilir.
 *
 * ✅ FIX: Eskiden bir "kuyruk" tablosuna yazıp, kendi kendine (await
 * edilmeden) bir HTTP isteği atarak kuyruğu işlemesi için ayrı bir
 * fonksiyonu tetikliyordu. Serverless ortamda bu await edilmeyen
 * kendi-kendini-tetikleme isteği güvenilir değildi - bazen hiç
 * tamamlanmadan fonksiyon sonlanıyor, mesajlar kuyrukta öylece kalıp asla
 * gönderilmiyordu ("tüm üyelere mesaj gitmiyor" şikayetinin sebebi).
 * 50-100 kişilik bir liste için kuyruğa hiç gerek yok - doğrudan, tek
 * istek içinde, aralarına kısa bir bekleme koyarak (Telegram limiti
 * aşılmasın diye) gönderiyoruz. Bu, sonucu (kaç kişiye ulaştığı) da
 * anında, güvenilir şekilde biliyoruz.
 */
export async function sendBroadcastToAllUsers({
  message,
  entities,
  adminTelegramId,
  adminUsername,
}: SendBroadcastInput): Promise<SendBroadcastResult> {
  if (!message || !message.trim()) {
    return { success: false, queuedCount: 0, skippedCount: 0, totalUsers: 0, error: 'Mesaj boş olamaz' }
  }

  if (!(await isBotSystemEnabled('broadcast'))) {
    return { success: false, queuedCount: 0, skippedCount: 0, totalUsers: 0, error: 'Toplu mesaj sistemi şu anda kapalı' }
  }

  const telegramUsers = await prisma.telegramGroupUser.findMany({
    where: { hadStart: true },
    select: {
      id: true,
      telegramId: true,
      username: true,
      firstName: true,
      linkedUser: { select: { isBanned: true } },
    },
  })

  const validUsers = telegramUsers.filter(u => u.telegramId && !u.linkedUser?.isBanned)
  const skippedCount = telegramUsers.length - validUsers.length

  if (validUsers.length === 0) {
    return { success: false, queuedCount: 0, skippedCount, totalUsers: telegramUsers.length, error: 'Mesaj gönderilecek kullanıcı bulunamadı' }
  }

  const batchId = `broadcast_${Date.now()}`

  const broadcastHistory = await prisma.broadcastHistory.create({
    data: {
      message,
      sendToAll: true,
      targetUserCount: telegramUsers.length,
      status: 'processing',
      queuedCount: validUsers.length,
      sentCount: 0,
      failedCount: skippedCount,
      batchId,
      adminId: adminTelegramId ? `tg:${adminTelegramId}` : null,
      adminUsername: adminUsername || null,
      startedAt: new Date(),
    },
  })

  let sentCount = 0
  let failedCount = skippedCount

  for (const user of validUsers) {
    const personalizedMessage = message
      .replace(/{username}/g, user.username ? `@${user.username}` : (user.firstName || 'Kullanıcı'))
      .replace(/{firstname}/g, user.firstName || user.username || 'Kullanıcı')
    // {username}/{firstname} yer tutucusu yoksa mesaj birebir aynı kalır ve
    // entities (premium emoji dahil) doğrudan geçerli olur. Yer tutucu
    // kullanıldıysa ve metin artık birebir eşleşmiyorsa entities güvenle
    // atlanır (parse_mode HTML'e düşer) - hatalı konumda emoji göstermektense.
    const personalizedEntities = shiftEntitiesForEmbeddedText(personalizedMessage, message, entities)

    try {
      const result = await sendTelegramMessage(
        user.telegramId!,
        personalizedMessage,
        personalizedEntities ? { entities: personalizedEntities } : undefined
      )
      if (result) sentCount++
      else failedCount++
    } catch {
      failedCount++
    }

    // Telegram rate limitini aşmamak için mesajlar arası kısa bekleme
    await new Promise((r) => setTimeout(r, 40))
  }

  await prisma.broadcastHistory.update({
    where: { id: broadcastHistory.id },
    data: { status: 'completed', sentCount, failedCount, completedAt: new Date() },
  }).catch(() => {})

  return {
    success: true,
    queuedCount: sentCount,
    skippedCount: failedCount,
    totalUsers: telegramUsers.length,
    broadcastId: broadcastHistory.id,
  }
}
