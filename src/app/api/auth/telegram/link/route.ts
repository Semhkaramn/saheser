import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, createToken, createAuthResponse } from '@/lib/auth'
import { logTelegramChange, extractRequestInfo } from '@/lib/services/activity-log-service'

export async function POST(request: NextRequest) {
  try {
    // Kullanıcı giriş yapmış olmalı
    const session = await requireAuth(request)

    const body = await request.json()
    const { telegramUser } = body

    if (!telegramUser || !telegramUser.id) {
      return NextResponse.json(
        { error: 'Geçersiz Telegram kullanıcı verisi' },
        { status: 400 }
      )
    }

    const telegramId = String(telegramUser.id)

    // Bu Telegram ID başka bir hesaba bağlı mı kontrol et
    const existingTelegramUser = await prisma.user.findUnique({
      where: { telegramId }
    })

    if (existingTelegramUser) {
      if (existingTelegramUser.id === session.userId) {
        return NextResponse.json(
          { error: 'Bu Telegram hesabı zaten bağlı' },
          { status: 400 }
        )
      } else {
        return NextResponse.json(
          { error: 'Bu Telegram hesabı başka bir kullanıcıya bağlı' },
          { status: 400 }
        )
      }
    }

    // Telegram hesabını mevcut kullanıcıya bağla
    const updatedUser = await prisma.user.update({
      where: { id: session.userId },
      data: {
        telegramId,
        telegramUsername: telegramUser.username || undefined,
        firstName: telegramUser.first_name || undefined,
        lastName: telegramUser.last_name || undefined,
      },
      include: {
        rank: true
      }
    })

    // ✅ FIX: TelegramGroupUser'ı da bağla (linkedUserId güncelle)
    // Bu kullanıcı daha önce grupta mesaj yazmışsa TelegramGroupUser kaydı var
    // O kayda linkedUserId ekleyerek User ile bağlantıyı kur
    const existingTgGroupUser = await prisma.telegramGroupUser.findUnique({
      where: { telegramId }
    })

    if (existingTgGroupUser) {
      // Mevcut TelegramGroupUser kaydını güncelle
      await prisma.telegramGroupUser.update({
        where: { telegramId },
        data: {
          linkedUserId: session.userId,
          username: telegramUser.username || undefined,
          firstName: telegramUser.first_name || undefined,
          lastName: telegramUser.last_name || undefined,
        }
      })
      console.log(`✅ TelegramGroupUser bağlandı (${existingTgGroupUser.messageCount} geçmiş mesaj)`)
    } else {
      // TelegramGroupUser kaydı yoksa oluştur (henüz grupta mesaj yazmamış)
      await prisma.telegramGroupUser.create({
        data: {
          telegramId,
          username: telegramUser.username || null,
          firstName: telegramUser.first_name || null,
          lastName: telegramUser.last_name || null,
          linkedUserId: session.userId,
          messageCount: 0,
        }
      })
      console.log('✅ Yeni TelegramGroupUser oluşturuldu ve bağlandı')
    }

    console.log('✅ Telegram hesabı bağlandı:', {
      userId: session.userId,
      telegramId,
      telegramUsername: telegramUser.username
    })

    // Activity log
    const requestInfo = extractRequestInfo(request)
    await logTelegramChange(
      session.userId,
      'telegram_link',
      telegramId,
      telegramUser.username || null,
      requestInfo
    )

    return NextResponse.json({
      success: true,
      message: 'Telegram hesabınız başarıyla bağlandı!',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        siteUsername: updatedUser.siteUsername,
        telegramUsername: updatedUser.telegramUsername, // Telegram username - RENAMED
        firstName: updatedUser.firstName, // Telegram'dan
        lastName: updatedUser.lastName, // Telegram'dan
        telegramId: updatedUser.telegramId
      }
    })

  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Oturum geçersiz. Lütfen tekrar giriş yapın.' },
        { status: 401 }
      )
    }

    console.error('Telegram link error:', error)
    return NextResponse.json(
      { error: 'Telegram hesabı bağlanırken hata oluştu' },
      { status: 500 }
    )
  }
}
