import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/admin-middleware'
import { invalidateCache } from '@/lib/enhanced-cache'

// GET - Tüm sosyal medya bağlantılarını listele (admin panelinde kullanılıyor, sayfa zaten korumalı)
export async function GET(request: NextRequest) {
  const authCheck = await requirePermission(request, 'canAccessSettings')
  if (authCheck.error) return authCheck.error

  try {
    const socialMedia = await prisma.socialMedia.findMany({
      orderBy: { order: 'asc' }
    })

    return NextResponse.json(socialMedia)
  } catch (error) {
    console.error('Error fetching social media:', error)
    return NextResponse.json({ error: 'Sosyal medya bağlantıları yüklenemedi' }, { status: 500 })
  }
}

// POST - Yeni sosyal medya bağlantısı ekle (admin panelinde kullanılıyor, sayfa zaten korumalı)
export async function POST(request: NextRequest) {
  const authCheck = await requirePermission(request, 'canAccessSettings')
  if (authCheck.error) return authCheck.error

  try {
    const body = await request.json()
    const { name, platform, username, isActive, order } = body

    if (!name || !platform || !username) {
      return NextResponse.json({ error: 'Eksik alanlar' }, { status: 400 })
    }

    const socialMedia = await prisma.socialMedia.create({
      data: {
        name,
        platform,
        username,
        isActive: isActive ?? true,
        order: order ?? 0
      }
    })

    // ✅ Cache invalidation
    invalidateCache.social()

    return NextResponse.json(socialMedia)
  } catch (error) {
    console.error('Error creating social media:', error)
    return NextResponse.json({ error: 'Sosyal medya bağlantısı eklenemedi' }, { status: 500 })
  }
}
