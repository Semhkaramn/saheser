import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/admin-middleware'
import { removeCrossBanChannel } from '@/lib/telegram/services/cross-ban-service'
import { z } from 'zod'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  const authCheck = await requirePermission(request, 'canAccessSettings')
  if (authCheck.error) return authCheck.error

  try {
    const { id } = await params
    const schema = z.object({ enabled: z.boolean() })
    const { enabled } = schema.parse(await request.json())

    const channel = await prisma.crossBanChannel.update({
      where: { id: Number(id) },
      data: { enabled },
    })

    return NextResponse.json({ success: true, channel })
  } catch (error) {
    console.error('Cross-ban channel PATCH error:', error)
    return NextResponse.json({ error: 'Güncellenemedi' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const authCheck = await requirePermission(request, 'canAccessSettings')
  if (authCheck.error) return authCheck.error

  try {
    const { id } = await params
    await removeCrossBanChannel(Number(id))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Cross-ban channel DELETE error:', error)
    return NextResponse.json({ error: 'Silinemedi' }, { status: 500 })
  }
}
