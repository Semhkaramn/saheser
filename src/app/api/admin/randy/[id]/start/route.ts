import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/admin-middleware'
import { startRandy } from '@/lib/telegram/services/randy-bot-service'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const authCheck = await requirePermission(request, 'canAccessSettings')
  if (authCheck.error) return authCheck.error

  try {
    const { id } = await params
    const result = await startRandy(id)
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ success: true, randy: result.randy })
  } catch (error) {
    console.error('Randy start error:', error)
    return NextResponse.json({ error: 'Başlatılamadı' }, { status: 500 })
  }
}
