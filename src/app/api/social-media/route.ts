import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCachedData, CacheTTL, CacheTags } from '@/lib/enhanced-cache'

// GET - Aktif sosyal medya bağlantılarını listele (public)
export async function GET() {
  try {
    // ✅ CACHE FIX: Social media VERY HIGH impact - her sayfa footer'da çağırılıyor! (-40ms)
    const socialMedia = await getCachedData(
      'social:all',
      async () => {
        return await prisma.socialMedia.findMany({
          where: { isActive: true },
          orderBy: { order: 'asc' },
          select: {
            id: true,
            name: true,
            platform: true,
            username: true,
            order: true
          }
        })
      },
      {
        ttl: CacheTTL.LONG, // 30 dakika
        tags: [CacheTags.SOCIAL]
      }
    )

    return NextResponse.json(socialMedia)
  } catch (error) {
    console.error('Error fetching social media:', error)
    return NextResponse.json({ error: 'Sosyal medya bağlantıları yüklenemedi' }, { status: 500 })
  }
}
