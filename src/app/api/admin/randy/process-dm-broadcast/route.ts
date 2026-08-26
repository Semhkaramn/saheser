import { NextRequest, NextResponse } from 'next/server'
import { processRandyDmBroadcast } from '@/lib/telegram/services/randy-bot-service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Bu endpoint, admin panelinden değil, ayrı bir zamanlanmış görevden
// (netlify/functions/randy-dm-broadcast.ts) çağrılır - startRandy() ile
// aynı HTTP isteğinde SENKRON çalışmasının yol açtığı zaman aşımı /
// buton-durumu-güncel-kalmama sorununu önlemek için ayrıldı.
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || 'default-cron-secret-change-this'

    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await processRandyDmBroadcast()
    return NextResponse.json(result)
  } catch (error) {
    console.error('Randy DM broadcast processor error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
