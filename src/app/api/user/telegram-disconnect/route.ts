import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { getTurkeyDate } from '@/lib/utils'
import { logTelegramChange, extractRequestInfo } from '@/lib/services/activity-log-service'

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request)

    // Get current user
    const user = await prisma.user.findUnique({
      where: { id: session.userId }
    })

    if (!user || !user.telegramId) {
      return NextResponse.json(
        { error: 'Telegram hesabı bağlı değil' },
        { status: 400 }
      )
    }

    // ✅ ÖNCE telegramId'yi sakla (update'den önce!)
    const currentTelegramId = user.telegramId
    const currentTelegramUsername = user.telegramUsername

    // Disconnect Telegram - Sanki hiç bağlanmamış gibi temizle
    await prisma.user.update({
      where: { id: session.userId },
      data: {
        telegramId: null,
        telegramUsername: null,
        firstName: null,
        lastName: null,
        hasHadFirstTelegramLink: false, // ✅ İlk bağlantı flagini sıfırla - tekrar bağlanınca ilk bağlantı gibi olsun
        telegramUnlinkedAt: getTurkeyDate()
      }
    })

    // ✅ FIX: TelegramGroupUser'da linkedUserId'yi de temizle (hadStart değişmez)
    if (currentTelegramId) {
      await prisma.telegramGroupUser.updateMany({
        where: { linkedUserId: session.userId },
        data: { linkedUserId: null }
      })
      console.log('✅ TelegramGroupUser linkedUserId temizlendi (hadStart korundu):', session.userId)
    }

    console.log('✅ Telegram bağlantısı koparıldı:', {
      userId: session.userId
    })

    // Activity log
    const requestInfo = extractRequestInfo(request)
    await logTelegramChange(
      session.userId,
      'telegram_unlink',
      currentTelegramId,
      currentTelegramUsername,
      requestInfo
    )

    return NextResponse.json({
      success: true,
      message: 'Telegram bağlantısı koparıldı. Dilediğiniz zaman tekrar bağlayabilirsiniz.'
    })

  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Oturum geçersiz. Lütfen tekrar giriş yapın.' },
        { status: 401 }
      )
    }

    console.error('Telegram disconnect error:', error)
    return NextResponse.json(
      { error: 'Telegram bağlantısı koparılırken hata oluştu' },
      { status: 500 }
    )
  }
}
