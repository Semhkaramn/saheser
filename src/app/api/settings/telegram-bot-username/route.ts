import { NextRequest, NextResponse } from 'next/server'
import { SiteConfig } from '@/lib/site-config'

// 🚀 OPTIMIZED: Add caching header
export const revalidate = 3600 // 1 hour

export async function GET(request: NextRequest) {
  try {
    // 🚀 OPTIMIZED: Bot username from ENV (no DB query)
    const username = SiteConfig.telegramBotUsername

    if (!username) {
      return NextResponse.json(
        { error: 'Bot username ayarlanmamış. Lütfen TELEGRAM_BOT_USERNAME ENV variable\'ını ayarlayın.' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        username: username.replace('@', '') // @ işaretini kaldır
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200'
        }
      }
    )
  } catch (error) {
    console.error('Error fetching bot username:', error)
    return NextResponse.json(
      { error: 'Bot username alınırken hata oluştu' },
      { status: 500 }
    )
  }
}
