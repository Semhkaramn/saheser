import { NextRequest, NextResponse } from 'next/server'
import { getDueAutoTagGroups, runTagging } from '@/lib/telegram/services/tagging-service'

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET || 'default-cron-secret-change-this'

  if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const dueGroups = await getDueAutoTagGroups()
    const results = []

    for (const settings of dueGroups) {
      const result = await runTagging(settings.groupId, settings.tagMessage)
      results.push({ groupId: settings.groupId, ...result })
    }

    return NextResponse.json({ success: true, processed: results.length, results })
  } catch (error) {
    console.error('Auto-tag cron error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
