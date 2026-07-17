import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getTurkeyDate } from '@/lib/utils'

// 6 haneli benzersiz kod oluştur
function generateConnectionCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request)

    // Kullanıcının mevcut token'ını kontrol et
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        telegramId: true,
        telegramConnectionToken: true,
        telegramConnectionTokenExpiry: true
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Kullanıcı bulunamadı' },
        { status: 404 }
      )
    }

    // Eğer zaten Telegram bağlıysa
    if (user.telegramId) {
      return NextResponse.json({
        error: 'Telegram hesabınız zaten bağlı',
        connected: true
      }, { status: 400 })
    }

    // Mevcut token hala geçerliyse onu döndür
    if (user.telegramConnectionToken && user.telegramConnectionTokenExpiry) {
      const now = new Date()
      if (user.telegramConnectionTokenExpiry > now) {
        return NextResponse.json({
          token: user.telegramConnectionToken,
          expiresAt: user.telegramConnectionTokenExpiry
        })
      }
    }

    // Yeni token oluştur (10 dakika geçerli)
    const token = generateConnectionCode()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 dakika

    await prisma.user.update({
      where: { id: user.id },
      data: {
        telegramConnectionToken: token,
        telegramConnectionTokenExpiry: expiresAt
      }
    })

    return NextResponse.json({
      token,
      expiresAt
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Oturum geçersiz' },
        { status: 401 }
      )
    }

    console.error('Token generation error:', error)
    return NextResponse.json(
      { error: 'Bir hata oluştu' },
      { status: 500 }
    )
  }
}
