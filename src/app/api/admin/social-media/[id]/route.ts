import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { invalidateCache } from '@/lib/enhanced-cache'

// PUT - Sosyal medya bağlantısını güncelle (admin panelinde kullanılıyor, sayfa zaten korumalı)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, platform, username, isActive, order } = body

    const socialMedia = await prisma.socialMedia.update({
      where: { id },
      data: {
        name,
        platform,
        username,
        isActive,
        order
      }
    })

    // ✅ Cache invalidation
    invalidateCache.social()

    return NextResponse.json(socialMedia)
  } catch (error) {
    console.error('Error updating social media:', error)
    return NextResponse.json({ error: 'Sosyal medya bağlantısı güncellenemedi' }, { status: 500 })
  }
}

// DELETE - Sosyal medya bağlantısını sil (admin panelinde kullanılıyor, sayfa zaten korumalı)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.socialMedia.delete({
      where: { id }
    })

    // ✅ Cache invalidation
    invalidateCache.social()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting social media:', error)
    return NextResponse.json({ error: 'Sosyal medya bağlantısı silinemedi' }, { status: 500 })
  }
}
