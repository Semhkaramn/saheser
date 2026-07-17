import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/admin-middleware'
import { BOT_SYSTEMS } from '@/lib/telegram/bot-systems'
import { getTelegramBot } from '@/lib/telegram/core'
import { getTelegramBotToken } from '@/lib/site-config'

export async function GET(request: NextRequest) {
  const authCheck = await requirePermission(request, 'canAccessSettings')
  if (authCheck.error) return authCheck.error

  try {
    const settings = await prisma.botSystemSetting.findMany()
    const settingsMap = new Map(settings.map((s) => [s.key, s.enabled]))

    const systems = BOT_SYSTEMS.map((s) => ({ ...s, enabled: settingsMap.get(s.key) ?? true }))

    let status: any = { ok: false }
    try {
      const bot = await getTelegramBot()
      const me = await bot.getMe()

      // ⚠️ ÖNEMLİ: node-telegram-bot-api kütüphanesinin tip tanımlarında
      // "allowed_updates" alanı hiç yok - kütüphane bunu ayrıştırırken
      // sessizce kaybediyor olabilir. Telegram'a DOĞRUDAN (kütüphaneyi
      // atlayarak) sorup gerçek ham veriyi görüyoruz - çapraz ban teşhisi
      // için bu alanın doğruluğu kritik.
      const token = getTelegramBotToken()
      const rawRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)
      const rawData = await rawRes.json()
      const webhookInfo = rawData.ok ? rawData.result : {}

      status = {
        ok: true,
        me: { username: me.username, first_name: me.first_name },
        webhookInfo: {
          url: webhookInfo.url,
          pending_update_count: webhookInfo.pending_update_count,
          last_error_message: webhookInfo.last_error_message,
          last_error_date: webhookInfo.last_error_date,
          // ✅ Çapraz ban teşhisi için kritik: chat_member burada yoksa
          // Telegram ban olaylarını hiç göndermiyor demektir.
          allowed_updates: webhookInfo.allowed_updates,
        },
      }
    } catch (e) {
      status = { ok: false, error: e instanceof Error ? e.message : 'Bilinmeyen hata' }
    }

    return NextResponse.json({ systems, status })
  } catch (error) {
    console.error('Bot settings GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const authCheck = await requirePermission(request, 'canAccessSettings')
  if (authCheck.error) return authCheck.error

  try {
    const { key, enabled } = await request.json()
    if (!key || typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'key ve enabled gerekli' }, { status: 400 })
    }

    await prisma.botSystemSetting.upsert({
      where: { key },
      update: { enabled },
      create: { key, enabled },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Bot settings POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
