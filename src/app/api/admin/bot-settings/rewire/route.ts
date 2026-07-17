import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/admin-middleware'
import { getTelegramBotToken } from '@/lib/site-config'

export async function POST(request: NextRequest) {
  const authCheck = await requirePermission(request, 'canAccessSettings')
  if (authCheck.error) return authCheck.error

  try {
    const { siteUrl } = await request.json()
    if (!siteUrl) {
      return NextResponse.json({ error: 'siteUrl gerekli' }, { status: 400 })
    }

    const token = getTelegramBotToken()
    if (!token) {
      return NextResponse.json({ error: 'Bot token ayarlanmamış' }, { status: 400 })
    }

    const webhookUrl = `${siteUrl.replace(/\/$/, '')}/api/telegram/webhook`

    // ⚠️ ÖNEMLİ: node-telegram-bot-api kütüphanesinin setWebHook() metodu
    // "allowed_updates" parametresini güvenilir şekilde iletmiyor gibi
    // görünüyor (aynı kütüphanenin getWebHookInfo() metodunda da bu alanın
    // tip tanımı bile yoktu - okurken de aynı sorunu bulup Telegram'a
    // doğrudan sorarak çözmüştük). Yazarken de kütüphaneyi atlayıp Telegram
    // API'sine doğrudan, ham bir istek atıyoruz - "chat_member" izninin
    // gerçekten kaydedildiğinden emin olmak için.
    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ['message', 'callback_query', 'my_chat_member', 'chat_member'],
      }),
    })
    const data = await res.json()

    if (!data.ok) {
      return NextResponse.json({ error: data.description || 'Telegram webhook kaydı reddetti' }, { status: 500 })
    }

    return NextResponse.json({ success: true, webhookUrl })
  } catch (error) {
    console.error('Webhook rewire error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 })
  }
}
