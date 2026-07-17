import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// type=trial_bonus veya type=promotion ile filtrelenir
export async function GET(request: NextRequest) {
  try {
    const type = request.nextUrl.searchParams.get('type')
    if (!type || !['trial_bonus', 'promotion'].includes(type)) {
      return NextResponse.json({ error: 'Geçersiz tip' }, { status: 400 })
    }

    const items = await prisma.promotion.findMany({
      where: {
        type,
        isActive: true,
        // Sponsor pasife alınmışsa (admin'de gizlenmişse) ona bağlı
        // promosyon/deneme bonusu da görünmesin. sponsorId opsiyonel
        // olduğu için sponsörsüz olanları (null) etkilemiyoruz.
        OR: [
          { sponsorId: null },
          { sponsor: { isActive: true } },
        ],
      },
      include: {
        sponsor: { select: { logoUrl: true, websiteUrl: true } },
        groups: { select: { id: true, name: true } },
      },
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json({ items })
  } catch (error) {
    console.error('Promotions fetch error:', error)
    return NextResponse.json({ items: [] })
  }
}
