import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTurkeyDate } from '@/lib/utils'
import { invalidateCache } from '@/lib/enhanced-cache'
import { invalidateBanCache } from '@/lib/telegram/utils/ban-check'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { action, reason, adminUsername } = await request.json()
    const { id: userId } = await params

    if (action === 'ban') {
      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          isBanned: true,
          banReason: reason || null,
          bannedAt: getTurkeyDate(), // Türkiye saati
          bannedBy: adminUsername || null
        }
      })

      // ✅ Ban durumu değiştiği için cache'leri temizle
      invalidateCache.leaderboard()
      if (user.telegramId) {
        await invalidateBanCache(user.telegramId)
      }
      console.log('🔄 Cache temizlendi (kullanıcı banlandı)')

      return NextResponse.json({
        success: true,
        message: 'Kullanıcı banlandı',
        user
      })
    } else if (action === 'unban') {
      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          isBanned: false,
          banReason: null,
          bannedAt: null,
          bannedBy: null
        }
      })

      // ✅ Ban durumu değiştiği için cache'leri temizle
      invalidateCache.leaderboard()
      if (user.telegramId) {
        await invalidateBanCache(user.telegramId)
      }
      console.log('🔄 Cache temizlendi (ban kaldırıldı)')

      return NextResponse.json({
        success: true,
        message: 'Ban kaldırıldı',
        user
      })
    } else {
      return NextResponse.json(
        { error: 'Geçersiz işlem' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Ban/unban error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
