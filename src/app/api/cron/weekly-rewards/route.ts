import { NextRequest, NextResponse } from 'next/server'
import { runDueWeeklyRewardAnnouncements } from '@/lib/telegram/services/weekly-rewards-service'

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET || 'default-cron-secret-change-this'

  if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runDueWeeklyRewardAnnouncements()
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('Weekly rewards cron error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
