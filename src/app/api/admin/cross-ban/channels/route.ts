import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/admin-middleware'
import { listCrossBanChannels, addCrossBanChannel } from '@/lib/telegram/services/cross-ban-service'
import { z } from 'zod'

export async function GET(request: NextRequest) {
  const authCheck = await requirePermission(request, 'canAccessSettings')
  if (authCheck.error) return authCheck.error

  try {
    const channels = await listCrossBanChannels()
    return NextResponse.json({ channels })
  } catch (error) {
    console.error('Cross-ban channels GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const authCheck = await requirePermission(request, 'canAccessSettings')
  if (authCheck.error) return authCheck.error

  try {
    const schema = z.object({
      channelId: z.string().min(1),
      title: z.string().nullable().optional(),
    })
    const { channelId, title } = schema.parse(await request.json())

    const channel = await addCrossBanChannel(channelId, title || null, null)
    return NextResponse.json({ success: true, channel })
  } catch (error) {
    console.error('Cross-ban channels POST error:', error)
    return NextResponse.json({ error: 'Eklenemedi' }, { status: 500 })
  }
}
