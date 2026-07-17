import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/admin-middleware'

type Params = { params: Promise<{ id: string }> }

export async function DELETE(request: NextRequest, { params }: Params) {
  const authCheck = await requirePermission(request, 'canAccessSettings')
  if (authCheck.error) return authCheck.error

  try {
    const { id } = await params
    const randy = await prisma.randy.findUnique({ where: { id } })
    if (!randy) {
      return NextResponse.json({ error: 'Randy bulunamadı' }, { status: 404 })
    }
    if (randy.status === 'active') {
      return NextResponse.json({ error: 'Aktif bir Randy silinemez, önce sonlandır' }, { status: 400 })
    }

    await prisma.randy.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Randy delete error:', error)
    return NextResponse.json({ error: 'Silinemedi' }, { status: 500 })
  }
}
