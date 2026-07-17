import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/admin-middleware'

// GET - type'a göre (trial_bonus | promotion) grupları listele
export async function GET(request: NextRequest) {
  const authCheck = await requirePermission(request, 'canAccessSponsors')
  if (authCheck.error) return authCheck.error

  const type = request.nextUrl.searchParams.get('type')
  if (!type || !['trial_bonus', 'promotion'].includes(type)) {
    return NextResponse.json({ error: 'Geçersiz tip' }, { status: 400 })
  }

  const groups = await prisma.promotionGroup.findMany({
    where: { type },
    include: { _count: { select: { promotions: true } } },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
  })

  return NextResponse.json({ groups })
}

// POST - Yeni grup oluştur (örn. "Kayıp Bonusu")
export async function POST(request: NextRequest) {
  const authCheck = await requirePermission(request, 'canAccessSponsors')
  if (authCheck.error) return authCheck.error

  try {
    const body = await request.json()
    const { type, name } = body

    if (!type || !['trial_bonus', 'promotion'].includes(type)) {
      return NextResponse.json({ error: 'Geçersiz tip' }, { status: 400 })
    }
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Grup adı gerekli' }, { status: 400 })
    }

    const count = await prisma.promotionGroup.count({ where: { type } })
    const group = await prisma.promotionGroup.create({
      data: { type, name: name.trim(), order: count },
    })

    return NextResponse.json({ success: true, group })
  } catch (error) {
    console.error('Promotion group create error:', error)
    return NextResponse.json({ error: 'Bir hata oluştu' }, { status: 500 })
  }
}
