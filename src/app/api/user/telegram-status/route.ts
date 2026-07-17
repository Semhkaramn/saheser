import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request)

    // Kullanıcının Telegram bağlantı durumunu kontrol et
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        telegramId: true,
        telegramUsername: true,
        firstName: true,
        lastName: true,
        telegramUnlinkedAt: true
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Kullanıcı bulunamadı' },
        { status: 404 }
      )
    }

    // TelegramGroupUser'dan hadStart bilgisini al
    const telegramUser = user.telegramId ? await prisma.telegramGroupUser.findFirst({
      where: { linkedUserId: session.userId },
      select: { hadStart: true }
    }) : null

    const hadStart = telegramUser?.hadStart || false

    // ✅ 1 gün kısıtlaması kaldırıldı - her zaman tekrar bağlanabilir
    return NextResponse.json({
      connected: !!user.telegramId && hadStart,
      telegramId: user.telegramId,
      hadStart: hadStart,
      firstName: user.firstName,
      canReconnect: true, // Her zaman true
      daysUntilReconnect: 0
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Oturum geçersiz' },
        { status: 401 }
      )
    }

    console.error('Telegram status check error:', error)
    return NextResponse.json(
      { error: 'Bir hata oluştu' },
      { status: 500 }
    )
  }
}
