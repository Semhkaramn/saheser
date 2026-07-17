import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { createToken, createAuthResponse } from '@/lib/auth'
import { logActivity, extractRequestInfo } from '@/lib/services/activity-log-service'

// Validation schema
const loginSchema = z.object({
  emailOrUsername: z.string().min(1, 'Email veya kullanıcı adı gereklidir'),
  password: z.string().min(1, 'Şifre gereklidir')
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input
    const validation = loginSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Geçersiz veri',
          details: validation.error.issues
        },
        { status: 400 }
      )
    }

    const { emailOrUsername, password } = validation.data

    // Trim ve lowercase işlemi
    const trimmedInput = emailOrUsername.trim().toLowerCase()

    // Kullanıcıyı bul (email veya siteUsername ile)
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: trimmedInput },
          {
            siteUsername: {
              mode: 'insensitive',
              equals: trimmedInput
            }
          }
        ]
        // loginMethod kaldırıldı - email/password varlığı kontrol edilecek
      },
      include: {
        rank: true
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Kullanıcı bulunamadı' },
        { status: 401 }
      )
    }

    // Şifre kontrolü
    if (!user.password) {
      return NextResponse.json(
        { error: 'Bu hesap Telegram ile kaydedilmiş' },
        { status: 401 }
      )
    }

    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Hatalı şifre' },
        { status: 401 }
      )
    }

    // ✅ Ban kontrolü - banned kullanıcılar giriş yapamaz
    if (user.isBanned) {
      return NextResponse.json({
        error: 'Hesabınız yasaklandı',
        banned: true,
        message: 'Hesabınız yasaklandığı için giriş yapamazsınız.',
        banReason: user.banReason || 'Sistem kurallarını ihlal ettiniz.',
        bannedAt: user.bannedAt,
        bannedBy: user.bannedBy
      }, { status: 403 })
    }

    // JWT token oluştur
    const token = await createToken({
      userId: user.id,
      email: user.email!,
      username: user.siteUsername!
    })

    console.log('✅ Kullanıcı giriş yaptı:', {
      email: user.email,
      siteUsername: user.siteUsername
    })

    // ✅ IP loglama - multi hesap tespiti için
    const requestInfo = extractRequestInfo(request)
    await logActivity({
      userId: user.id,
      actionType: 'login',
      actionTitle: 'Giriş yapıldı',
      actionDescription: `${user.siteUsername || user.email} hesabına giriş yapıldı`,
      relatedType: 'auth',
      metadata: {
        loginMethod: 'email',
        email: user.email,
        siteUsername: user.siteUsername
      },
      ...requestInfo
    })

    return createAuthResponse({
      success: true,
      message: 'Giriş başarılı!',
      user: {
        id: user.id,
        email: user.email,
        siteUsername: user.siteUsername,
        telegramUsername: user.telegramUsername,
        firstName: user.firstName,
        lastName: user.lastName,
        points: user.points,
        xp: user.xp,
        rank: user.rank,
        dailySpinsLeft: user.dailySpinsLeft,
        telegramId: user.telegramId,
        isBanned: user.isBanned,
        emailVerified: user.emailVerified
      }
    }, token)

  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Giriş işlemi sırasında bir hata oluştu' },
      { status: 500 }
    )
  }
}
