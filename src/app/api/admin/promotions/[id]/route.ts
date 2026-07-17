import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/admin-middleware'
import { generateUniqueSlug } from '@/lib/slug'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authCheck = await requirePermission(request, 'canAccessSponsors')
  if (authCheck.error) return authCheck.error

  try {
    const { id } = await params
    const body = await request.json()
    const { name, sponsorId, photoUrl, photoPublicId, description, isActive, order, groupIds } = body

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) {
      updateData.name = name
      // İsim değiştiyse slug'ı da güncelle (değişmediyse eski slug/URL bozulmasın)
      const current = await prisma.promotion.findUnique({ where: { id }, select: { name: true, type: true, slug: true } })
      if (current && current.name !== name) {
        updateData.slug = await generateUniqueSlug(name, async (candidate) => {
          const existing = await prisma.promotion.findFirst({
            where: { type: current.type, slug: candidate, NOT: { id } },
          })
          return !!existing
        })
      }
    }
    if (sponsorId !== undefined) updateData.sponsorId = sponsorId || null
    if (photoUrl !== undefined) updateData.photoUrl = photoUrl
    if (photoPublicId !== undefined) updateData.photoPublicId = photoPublicId
    if (description !== undefined) updateData.description = description
    if (isActive !== undefined) updateData.isActive = isActive
    if (order !== undefined) updateData.order = order
    // groupIds gönderildiyse tüm grup bağlarını bununla değiştir (set) - bir
    // promosyon birden fazla gruba ait olabilir, boş dizi = hiçbir grupta değil
    if (groupIds !== undefined) {
      updateData.groups = { set: (Array.isArray(groupIds) ? groupIds : []).map((gid: string) => ({ id: gid })) }
    }

    const item = await prisma.promotion.update({
      where: { id },
      data: updateData,
      include: { groups: { select: { id: true, name: true } } },
    })
    return NextResponse.json({ success: true, item })
  } catch (error) {
    console.error('Promotion update error:', error)
    return NextResponse.json({ error: 'Bir hata oluştu' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authCheck = await requirePermission(request, 'canAccessSponsors')
  if (authCheck.error) return authCheck.error

  try {
    const { id } = await params
    await prisma.promotion.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Promotion delete error:', error)
    return NextResponse.json({ error: 'Bir hata oluştu' }, { status: 500 })
  }
}
