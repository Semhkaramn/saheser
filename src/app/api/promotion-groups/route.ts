import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// type=trial_bonus veya type=promotion ile filtrelenir - üye sayfasındaki
// filtre çipleri (Tümü / Kayıp Bonusu / ...) için kullanılır
export async function GET(request: NextRequest) {
  try {
    const type = request.nextUrl.searchParams.get('type')
    if (!type || !['trial_bonus', 'promotion'].includes(type)) {
      return NextResponse.json({ error: 'Geçersiz tip' }, { status: 400 })
    }

    // Sadece içinde en az bir aktif promosyon olan gruplar gösterilsin -
    // boş bir grubu üye sayfasında filtre olarak göstermenin anlamı yok
    const groups = await prisma.promotionGroup.findMany({
      where: { type, promotions: { some: { isActive: true } } },
      select: { id: true, name: true },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    })

    return NextResponse.json({ groups })
  } catch (error) {
    console.error('Promotion groups fetch error:', error)
    return NextResponse.json({ groups: [] })
  }
}
