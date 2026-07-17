import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/admin-middleware'

// PATCH - Grup adını güncelle
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authCheck = await requirePermission(request, 'canAccessSponsors')
  if (authCheck.error) return authCheck.error

  try {
    const { id } = await params
    const body = await request.json()
    const { name } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Grup adı gerekli' }, { status: 400 })
    }

    const group = await prisma.promotionGroup.update({
      where: { id },
      data: { name: name.trim() },
    })

    return NextResponse.json({ success: true, group })
  } catch (error) {
    console.error('Promotion group update error:', error)
    return NextResponse.json({ error: 'Bir hata oluştu' }, { status: 500 })
  }
}

// DELETE - Grubu sil (bu gruba eklenmiş promosyonlardan otomatik çıkar, promosyonların kendisi silinmez)
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authCheck = await requirePermission(request, 'canAccessSponsors')
  if (authCheck.error) return authCheck.error

  try {
    const { id } = await params
    await prisma.promotionGroup.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Promotion group delete error:', error)
    return NextResponse.json({ error: 'Bir hata oluştu' }, { status: 500 })
  }
}
