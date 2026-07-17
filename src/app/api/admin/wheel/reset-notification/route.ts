import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { SiteConfig, getDynamicSettings } from '@/lib/site-config'
import { sendTelegramMessage } from '@/lib/telegram/core'
import { renderTemplateByKey } from '@/lib/message-templates'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    // Cron secret kontrolü
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || 'default-cron-secret-change-this'

    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 🚀 OPTIMIZATION: ENV'den ayarları al
    const dailySpins = SiteConfig.dailyWheelSpins
    const siteName = SiteConfig.siteName

    // 🚀 Check if notifications are enabled from DATABASE
    const settings = await getDynamicSettings()
    if (settings.notifyWheelReset === false) {
      console.log('⚠️ Wheel reset notifications are disabled (notify_wheel_reset = false in DB)')
      return NextResponse.json({
        success: true,
        message: 'Notifications disabled in database',
        totalUsers: 0,
        successCount: 0,
        errorCount: 0
      })
    }

    // Hard start yapmış VE site kullanıcısı olan kullanıcıları al
    const usersWithStart = await prisma.telegramGroupUser.findMany({
      where: {
        hadStart: true,
        linkedUserId: {
          not: null // Siteye kayıtlı olanlar
        }
      },
      select: {
        telegramId: true,
        firstName: true,
      }
    })

    console.log(`📢 ${usersWithStart.length} kullanıcıya çark sıfırlama bildirimi gönderiliyor...`)

    let successCount = 0
    let errorCount = 0

    // Her kullanıcıya bildirim gönder
    for (const tgUser of usersWithStart) {
      if (!tgUser.telegramId) continue

      try {
        const firstName = tgUser.firstName || 'Kullanıcı'

        const message = await renderTemplateByKey('cark_sifirlama_dm', {
          siteName,
          firstName,
          dailySpins,
          appUrl: SiteConfig.appUrl,
        })

        // 🚀 Merkezi sendTelegramMessage fonksiyonunu kullan
        const result = await sendTelegramMessage(tgUser.telegramId, message)

        if (result) {
          successCount++
          console.log(`✅ Bildirim gönderildi: ${firstName} (${tgUser.telegramId})`)
        } else {
          errorCount++
          console.log(`❌ Bildirim gönderilemedi: ${firstName} (${tgUser.telegramId})`)
        }

        // Rate limiting: Telegram API 30 msg/sec limit
        await new Promise(resolve => setTimeout(resolve, 50))

      } catch (error) {
        errorCount++
        console.error(`❌ Bildirim hatası: ${tgUser.telegramId}`, error)
      }
    }

    console.log(`✅ Bildirim özeti: ${successCount} başarılı, ${errorCount} hata`)

    return NextResponse.json({
      success: true,
      totalUsers: usersWithStart.length,
      successCount,
      errorCount,
      message: `Wheel reset notifications sent: ${successCount} successful, ${errorCount} failed`
    })

  } catch (error) {
    console.error('Wheel reset notification error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
