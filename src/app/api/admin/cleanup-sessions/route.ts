import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - Süresi dolmuş admin oturumlarını temizle (Cron job için)
export async function GET(request: NextRequest) {
  try {
    // Güvenlik için basit bir token kontrolü
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || 'default-cron-secret-change-this'

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Yetkisiz erişim' },
        { status: 401 }
      )
    }

    console.log('🧹 Starting cleanup of expired admin sessions...')

    const result = await prisma.adminSession.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    })

    console.log(`✅ Deleted ${result.count} expired admin sessions`)

    return NextResponse.json({
      success: true,
      deletedCount: result.count,
    })
  } catch (error) {
    console.error('❌ Error cleaning up sessions:', error)
    return NextResponse.json(
      { error: 'Oturum temizliği sırasında hata oluştu' },
      { status: 500 }
    )
  }
}
