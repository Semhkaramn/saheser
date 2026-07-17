import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/admin-middleware'
import { z } from 'zod'

type Params = { params: Promise<{ groupId: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  const authCheck = await requirePermission(request, 'canAccessSettings')
  if (authCheck.error) return authCheck.error

  try {
    const { groupId } = await params
    const schema = z.object({ isActive: z.boolean() })
    const { isActive } = schema.parse(await request.json())

    const group = await prisma.telegramGroup.update({
      where: { groupId },
      data: { isActive },
    })

    return NextResponse.json({ success: true, group })
  } catch (error) {
    console.error('Group toggle error:', error)
    return NextResponse.json({ error: 'Güncellenemedi' }, { status: 500 })
  }
}
