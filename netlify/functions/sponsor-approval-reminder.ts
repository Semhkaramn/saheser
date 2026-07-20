import { schedule } from '@netlify/functions'
import { getPrisma, disconnectPrisma, withTimeout } from './lib/prisma'

const FIELD_TYPE_LABEL: Record<string, string> = { username: 'Kullanıcı Adı', id: 'Telegram ID', email: 'E-posta' }
// 6 saat boyunca hiç işlem görmeyen bekleyen kayıtlar hatırlatma olarak
// yeniden gönderilir - eski mesaj silinip yerine taze bir tane atılır ki
// admin grubunda kaybolmuş olmasın, tekrar en üste/görünür yere gelsin.
const REMINDER_AFTER_MS = 6 * 60 * 60 * 1000

async function deleteTelegramMessage(chatId: string, messageId: string): Promise<void> {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    if (!botToken) return
    await fetch(`https://api.telegram.org/bot${botToken}/deleteMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: Number(messageId) }),
      signal: AbortSignal.timeout(5000),
    })
  } catch {
    // Mesaj zaten silinmiş/bulunamıyor olabilir - önemli değil, devam et
  }
}

async function sendApprovalCard(
  chatId: string,
  entryId: string,
  identifier: string,
  sponsorName: string,
  fieldType: string,
  siteUsername: string
): Promise<string | null> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) return null

  const fieldLabel = FIELD_TYPE_LABEL[fieldType] || fieldType
  const text = [
    '⏰ <b>Hatırlatma</b> - uzun süredir yanıt bekliyor',
    '',
    `🔗 <b>Yeni Referans Bildirimi</b>`,
    '',
    `Sponsor: <b>${sponsorName}</b>`,
    `Site üyesi: <b>${siteUsername}</b>`,
    `${fieldLabel}: <code>${identifier}</code>`,
    '',
    'Durumu seçin:',
  ].join('\n')

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Onay', callback_data: `sponsor_action:${entryId}:approved` },
              { text: '❌ Red', callback_data: `sponsor_action:${entryId}:rejected` },
            ],
            [{ text: '💰 Yatırım Sonrası', callback_data: `sponsor_action:${entryId}:post_deposit` }],
            [{ text: `❗ ${fieldLabel} Hatalı`, callback_data: `sponsor_action:${entryId}:incorrect` }],
          ],
        },
      }),
      signal: AbortSignal.timeout(5000),
    })
    const data = await res.json()
    if (!data.ok) {
      console.error('❌ Sponsor hatırlatma gönderilemedi:', data.description)
      return null
    }
    return String(data.result.message_id)
  } catch (error) {
    console.error('❌ Sponsor hatırlatma hatası:', error)
    return null
  }
}

/**
 * Cron Job: Her 6 saatte bir çalışır (00:00, 06:00, 12:00, 18:00 UTC)
 * 6 saatten uzun süredir yanıt bekleyen sponsor onay kayıtlarını bulur,
 * eski mesajı siler, yenisini gönderir - admin grubunda unutulmasın diye.
 */
const handler = schedule('0 */6 * * *', async () => {
  const prisma = getPrisma()

  try {
    const cutoff = new Date(Date.now() - REMINDER_AFTER_MS)

    const pending: Array<{
      id: string
      identifier: string
      telegramChatId: string | null
      telegramMessageId: string | null
      sponsor: { name: string; identifierType: string }
      user: { siteUsername: string | null; telegramUsername: string | null }
    }> = await withTimeout(
      prisma.userSponsorInfo.findMany({
        where: {
          status: 'pending',
          telegramChatId: { not: null },
          OR: [
            { lastReminderAt: null, createdAt: { lt: cutoff } },
            { lastReminderAt: { lt: cutoff } },
          ],
        },
        include: {
          sponsor: { select: { name: true, identifierType: true } },
          user: { select: { siteUsername: true, telegramUsername: true } },
        },
        take: 50, // tek seferde çok fazla mesaj basmamak için üst sınır
      }),
      8000,
      'Pending sponsor info query'
    )

    let remindedCount = 0

    for (const entry of pending) {
      if (!entry.telegramChatId) continue

      // Eski mesajı sil (varsa)
      if (entry.telegramMessageId) {
        await deleteTelegramMessage(entry.telegramChatId, entry.telegramMessageId)
      }

      const newMessageId = await sendApprovalCard(
        entry.telegramChatId,
        entry.id,
        entry.identifier,
        entry.sponsor.name,
        entry.sponsor.identifierType,
        entry.user.siteUsername || entry.user.telegramUsername || 'Bilinmiyor'
      )

      if (newMessageId) {
        await prisma.userSponsorInfo.update({
          where: { id: entry.id },
          data: { telegramMessageId: newMessageId, lastReminderAt: new Date() },
        })
        remindedCount++
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, remindedCount, checked: pending.length }),
    }
  } catch (error) {
    console.error('❌ Sponsor onay hatırlatma cron hatası:', error)
    return { statusCode: 500, body: JSON.stringify({ success: false }) }
  } finally {
    await disconnectPrisma()
  }
})

export { handler }
