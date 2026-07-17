import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { invalidateCache } from '@/lib/enhanced-cache'

// PUT - Sosyal medya bağlantılarını yeniden sırala (admin panelinde kullanılıyor, sayfa zaten korumalı)
export async function PUT(request: NextRequest) {
  try {
    const { items } = await request.json()

    // Her bir öğe için sıralama bilgisini güncelle
    await Promise.all(
      items.map((item: { id: string; order: number }) =>
        prisma.socialMedia.update({
          where: { id: item.id },
          data: { order: item.order }
        })
      )
    )

    // ✅ Cache invalidation
    invalidateCache.social()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error reordering social media:', error)
    return NextResponse.json({ error: 'Sıralama güncellenemedi' }, { status: 500 })
  }
}
