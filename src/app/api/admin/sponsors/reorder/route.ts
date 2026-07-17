import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/admin-middleware'
import { invalidateCache } from '@/lib/enhanced-cache'

export async function PUT(request: NextRequest) {
  const authResult = await requirePermission(request, 'canAccessSponsors')
  if (authResult.error) {
    return authResult.error
  }

  try {
    const { sponsors } = await request.json()

    if (!Array.isArray(sponsors)) {
      return NextResponse.json({ error: 'Geçersiz veri' }, { status: 400 })
    }

    // Her sponsor için order değerini güncelle
    await Promise.all(
      sponsors.map(({ id, order }: { id: string; order: number }) =>
        prisma.sponsor.update({
          where: { id },
          data: { order }
        })
      )
    )

    // ✅ Cache invalidation
    invalidateCache.sponsors()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error reordering sponsors:', error)
    return NextResponse.json({ error: 'Bir hata oluştu' }, { status: 500 })
  }
}
