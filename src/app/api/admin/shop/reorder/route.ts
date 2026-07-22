import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/admin-middleware'

// PUT - Sürükle-bırak ile sıralanan market ürünü listesini kaydet.
export async function PUT(request: NextRequest) {
  const authCheck = await requirePermission(request, 'canAccessShop')
  if (authCheck.error) return authCheck.error

  try {
    const { items } = await request.json()

    if (!Array.isArray(items)) {
      return NextResponse.json({ error: 'Geçersiz veri' }, { status: 400 })
    }

    await Promise.all(
      items.map((item: { id: string; order: number }) =>
        prisma.shopItem.update({
          where: { id: item.id },
          data: { order: item.order },
        })
      )
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Shop item reorder error:', error)
    return NextResponse.json({ error: 'Sıralama kaydedilemedi' }, { status: 500 })
  }
}
