import { SiteConfig, getDynamicSettings } from './site-config'
import { sendTelegramMessage } from './telegram/core'
import { renderTemplateByKey } from './message-templates'

// Kullanıcıya özel mesaj gönder
export async function sendUserNotification(telegramId: string, text: string): Promise<boolean> {
  try {
    console.log(`📤 Telegram mesajı gönderiliyor: ${telegramId}`)

    const result = await sendTelegramMessage(telegramId, text)

    if (!result) {
      console.error(`❌ Telegram API hatası (${telegramId})`)
      return false
    }

    console.log(`✅ Telegram mesajı başarıyla gönderildi: ${telegramId}`)
    return true
  } catch (error) {
    console.error('❌ Telegram mesaj gönderme hatası:', error)
    return false
  }
}

// Gruba mesaj gönder (mention ile)
export async function sendGroupNotification(
  groupId: string,
  text: string,
  mentionUserId?: string,
  mentionName?: string
): Promise<boolean> {
  try {
    // Mention ekle
    let messageText = text
    if (mentionUserId && mentionName) {
      messageText = `<a href="tg://user?id=${mentionUserId}">${mentionName}</a>\n\n${text}`
    }

    const result = await sendTelegramMessage(groupId, messageText)

    if (!result) {
      console.error(`Failed to send group notification to ${groupId}`)
      return false
    }

    return true
  } catch (error) {
    console.error('Error sending group notification:', error)
    return false
  }
}

// Sipariş durumu değişikliği bildirimi
export async function notifyOrderStatusChange(
  userId: string,
  telegramId: string,
  orderDetails: {
    itemName: string
    pointsSpent: number
    status: string
    deliveryInfo?: string
  }
): Promise<boolean> {
  // 🚀 OPTIMIZED: Dynamic settings from cache/DB
  const settings = await getDynamicSettings()

  // Check if order notifications are enabled
  if (settings.notifyOrderApproved === false) {
    console.log('❌ Order notifications are disabled (notify_order_approved = false)')
    return false
  }

  console.log(`📦 Sipariş bildirimi gönderiliyor: ${telegramId} - Status: ${orderDetails.status}`)

  let message = ''

  // Duruma göre şablon anahtarı ve teslimat/not bloğunu seç
  switch (orderDetails.status) {
    case 'completed': {
      const teslimatBlok = orderDetails.deliveryInfo ? `📝 Teslimat Bilgisi:\n${orderDetails.deliveryInfo}\n\n` : ''
      message = await renderTemplateByKey('siparis_tamamlandi', {
        itemName: orderDetails.itemName,
        pointsSpent: orderDetails.pointsSpent.toLocaleString(),
        teslimatBlok,
      })
      break
    }
    case 'processing': {
      const teslimatBlok = orderDetails.deliveryInfo ? `📝 Not:\n${orderDetails.deliveryInfo}\n\n` : ''
      message = await renderTemplateByKey('siparis_islemde', {
        itemName: orderDetails.itemName,
        pointsSpent: orderDetails.pointsSpent.toLocaleString(),
        teslimatBlok,
      })
      break
    }
    case 'cancelled': {
      const teslimatBlok = orderDetails.deliveryInfo ? `📝 İptal Nedeni:\n${orderDetails.deliveryInfo}\n\n` : ''
      message = await renderTemplateByKey('siparis_iptal', {
        itemName: orderDetails.itemName,
        pointsSpent: orderDetails.pointsSpent.toLocaleString(),
        teslimatBlok,
      })
      break
    }
    case 'pending':
      message = await renderTemplateByKey('siparis_beklemede', {
        itemName: orderDetails.itemName,
        pointsSpent: orderDetails.pointsSpent.toLocaleString(),
      })
      break

    default:
      message = `🔔 <b>Sipariş Durumu: ${orderDetails.status}</b>\n\n📦 Ürün: ${orderDetails.itemName}\n💰 Fiyat: ${orderDetails.pointsSpent.toLocaleString()} puan${orderDetails.deliveryInfo ? `\n\n📝 Not:\n${orderDetails.deliveryInfo}` : ''}`
  }

  // Mesajı hemen gönder
  const result = await sendUserNotification(telegramId, message)

  if (result) {
    console.log(`✅ Market bildirimi başarıyla gönderildi: ${telegramId}`)
  } else {
    console.error(`❌ Market bildirimi gönderilemedi: ${telegramId}`)
  }

  return result
}

// Rütbe atlaması bildirimi (SADECE GRUPTA, MENTION İLE)
export async function notifyLevelUp(
  telegramId: string,
  userName: string,
  rankDetails: {
    icon: string
    name: string
    xp: number
  }
): Promise<boolean> {
  // 🚀 OPTIMIZED: Dynamic settings from cache/DB
  const settings = await getDynamicSettings()

  // Check if level up notifications are enabled
  if (settings.notifyLevelUp === false) {
    console.log('❌ Level up notifications are disabled (notify_level_up = false)')
    return false
  }

  // Get activity group ID from ENV
  const activityGroupId = SiteConfig.activityGroupId
  if (!activityGroupId) {
    console.log('Activity group not configured')
    return false
  }

  // Merkezi mesaj şablonunu kullan - mention dahil
  const mention = `<a href="tg://user?id=${telegramId}">${userName}</a>`
  const message = await renderTemplateByKey('rutbe_seviye_atladi', {
    mention,
    icon: rankDetails.icon,
    isim: rankDetails.name,
    xp: rankDetails.xp.toLocaleString(),
  })

  // Grupta bildirim gönder (mention artık mesajın içinde)
  return await sendGroupNotification(
    activityGroupId,
    message,
    telegramId,
    userName
  )
}

// Toplu bildirim gönder (rate limit ile)
export async function sendBulkNotifications(
  notifications: Array<{ telegramId: string; message: string }>,
  delayMs: number = 35
): Promise<{ success: number; failed: number }> {
  let successCount = 0
  let failCount = 0

  for (let i = 0; i < notifications.length; i++) {
    const { telegramId, message } = notifications[i]
    const success = await sendUserNotification(telegramId, message)

    if (success) {
      successCount++
    } else {
      failCount++
    }

    // Rate limit koruma - Her 30 mesajda bir 1 saniye bekle
    if ((i + 1) % 30 === 0) {
      console.log(`⏳ ${i + 1}/${notifications.length} mesaj gönderildi, kısa mola...`)
      await new Promise(resolve => setTimeout(resolve, 1000))
    } else if (i < notifications.length - 1) {
      // Normal delay
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }

  return { success: successCount, failed: failCount }
}
