import { PrismaClient } from '@prisma/client'
import { notifyWheelReset } from '../src/lib/notifications'

const prisma = new PrismaClient()

async function notifyWheelReset() {
  try {
    console.log('🔄 Çark hakkı yenilenme bildirimi başlıyor...')

    // ✅ Bildirim ayarını ENV'den kontrol et
    const wheelResetNotificationEnabled = process.env.WHEEL_RESET_NOTIFICATION_ENABLED !== 'false'

    if (!wheelResetNotificationEnabled) {
      console.log('⏭️ Bildirim ayarı kapalı (ENV), işlem atlanıyor')
      return
    }

    // ✅ Günlük çark hakkı sayısını ENV'den al
    const dailySpins = Number.parseInt(process.env.DAILY_WHEEL_SPINS || '3')

    // Tüm aktif kullanıcıları al (banlı olmayanlar)
    const users = await prisma.user.findMany({
      where: {
        isBanned: false
      },
      select: {
        telegramId: true,
        firstName: true,
        username: true
      }
    })

    console.log(`📊 ${users.length} kullanıcıya bildirim gönderilecek`)

    let successCount = 0
    let failCount = 0

    // Kullanıcılara batch halinde mesaj gönder (Telegram rate limit'ini aşmamak için)
    for (let i = 0; i < users.length; i++) {
      const user = users[i]

      if (user.telegramId) {
        const success = await notifyWheelReset(user.telegramId, dailySpins)

        if (success) {
          successCount++
        } else {
          failCount++
        }

        // Her 30 mesajda bir 1 saniye bekle (Telegram rate limit)
        if ((i + 1) % 30 === 0) {
          console.log(`⏳ ${i + 1}/${users.length} mesaj gönderildi, kısa mola...`)
          await new Promise(resolve => setTimeout(resolve, 1000))
        } else if (i < users.length - 1) {
          // Normal delay - rate limit koruması
          await new Promise(resolve => setTimeout(resolve, 35))
        }
      }
    }

    console.log(`✅ Bildirim tamamlandı: ${successCount} başarılı, ${failCount} başarısız`)
  } catch (error) {
    console.error('❌ Çark hakkı yenilenme bildirimi hatası:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Script doğrudan çalıştırılırsa
if (require.main === module) {
  notifyWheelReset()
}

export { notifyWheelReset }
