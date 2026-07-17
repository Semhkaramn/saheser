import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/admin-middleware'

// PUT - Sürükle-bırak ile sıralanan deneme bonusu/promosyon listesini kaydet.
// Liste zaten type'a göre filtrelenmiş geldiği için, deneme bonusları ve
// promosyonlar birbirinden bağımsız sıralanır.
export async function PUT(request: NextRequest) {
  const authCheck = await requirePermission(request, 'canAccessSponsors')
  if (authCheck.error) return authCheck.error

  try {
    const { items } = await request.json()

    if (!Array.isArray(items)) {
      return NextResponse.json({ error: 'Geçersiz veri' }, { status: 400 })
    }

    await Promise.all(
      items.map((item: { id: string; order: number }) =>
        prisma.promotion.update({
          where: { id: item.id },
          data: { order: item.order },
        })
      )
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Promotion reorder error:', error)
    return NextResponse.json({ error: 'Sıralama kaydedilemedi' }, { status: 500 })
  }
}
