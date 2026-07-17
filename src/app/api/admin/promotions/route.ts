import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/admin-middleware'
import { generateUniqueSlug } from '@/lib/slug'

export async function GET(request: NextRequest) {
  const authCheck = await requirePermission(request, 'canAccessSponsors')
  if (authCheck.error) return authCheck.error

  const type = request.nextUrl.searchParams.get('type')
  const items = await prisma.promotion.findMany({
    where: type ? { type } : undefined,
    include: {
      sponsor: { select: { id: true, name: true, logoUrl: true } },
      groups: { select: { id: true, name: true } },
    },
    orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
  })

  return NextResponse.json({ items })
}

export async function POST(request: NextRequest) {
  const authCheck = await requirePermission(request, 'canAccessSponsors')
  if (authCheck.error) return authCheck.error

  try {
    const body = await request.json()
    const { type, name, sponsorId, photoUrl, photoPublicId, description, order, groupIds } = body

    if (!type || !['trial_bonus', 'promotion'].includes(type)) {
      return NextResponse.json({ error: 'Geçersiz tip' }, { status: 400 })
    }
    if (!name) {
      return NextResponse.json({ error: 'İsim gerekli' }, { status: 400 })
    }
    if (!sponsorId) {
      return NextResponse.json({ error: 'Sponsor seçilmeli (giriş linki oradan gelir)' }, { status: 400 })
    }

    // Detay sayfası URL'i artık rastgele ID yerine isimden türetilen bir
    // slug kullanıyor (örn. /deneme-bonuslari/deneme-bonusu-kayip). Aynı
    // isimde ikinci bir kayıt olursa sonuna otomatik -1, -2 ekleniyor.
    const slug = await generateUniqueSlug(name, async (candidate) => {
      const existing = await prisma.promotion.findFirst({ where: { type, slug: candidate } })
      return !!existing
    })

    const item = await prisma.promotion.create({
      data: {
        type, name, slug, sponsorId: sponsorId || null, photoUrl, photoPublicId,
        description, order: order || 0,
        groups: Array.isArray(groupIds) && groupIds.length > 0
          ? { connect: groupIds.map((id: string) => ({ id })) }
          : undefined,
      },
      include: { groups: { select: { id: true, name: true } } },
    })

    return NextResponse.json({ success: true, item })
  } catch (error) {
    console.error('Promotion create error:', error)
    return NextResponse.json({ error: 'Bir hata oluştu' }, { status: 500 })
  }
}
