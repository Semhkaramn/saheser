import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { createToken, createAuthResponse } from '@/lib/auth'
import { logRegister, extractRequestInfo } from '@/lib/services/activity-log-service'

// Validation schema
const registerSchema = z.object({
  email: z.string().email('Geçerli bir email adresi giriniz'),
  siteUsername: z.string().min(3, 'Kullanıcı adı en az 3 karakter olmalıdır').max(20, 'Kullanıcı adı en fazla 20 karakter olabilir'),
  password: z.string().min(6, 'Şifre en az 6 karakter olmalıdır')
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input
    const validation = registerSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Geçersiz veri',
          details: validation.error.issues
        },
        { status: 400 }
      )
    }

    const { email, siteUsername, password } = validation.data

    // ✅ Email artık kayıt olmadan ÖNCE doğrulanıyor (inline, form üstünde).
    // Doğrulanmamış bir email ile kayıt olunamaz.
    const pendingVerification = await prisma.pendingEmailVerification.findUnique({ where: { email } })
    if (!pendingVerification || !pendingVerification.verified) {
      return NextResponse.json(
        { error: 'Lütfen önce email adresinizi doğrulayın' },
        { status: 400 }
      )
    }

    // Email kontrolü
    const existingEmail = await prisma.user.findUnique({
      where: { email }
    })

    if (existingEmail) {
      return NextResponse.json(
        { error: 'Bu email adresi zaten kullanılıyor' },
        { status: 400 }
      )
    }

    // SiteUsername kontrolü
    const existingSiteUsername = await prisma.user.findFirst({
      where: { siteUsername }
    })

    if (existingSiteUsername) {
      return NextResponse.json(
        { error: 'Bu kullanıcı adı zaten kullanılıyor' },
        { status: 400 }
      )
    }

    // Şifreyi hashle
    const passwordHash = await bcrypt.hash(password, 10)

    // Yeni kullanıcı oluştur - email zaten doğrulandığı için emailVerified: true
    const user = await prisma.user.create({
      data: {
        email,
        siteUsername,
        password: passwordHash,
        emailVerified: true
        // loginMethod kaldırıldı - email/password varlığından anlaşılır
      },
      select: {
        id: true,
        email: true,
        siteUsername: true,
        points: true,
        xp: true
      }
    })

    // Geçici doğrulama kaydını temizle - artık gerek yok
    await prisma.pendingEmailVerification.delete({ where: { email } }).catch(() => {})

    // JWT token oluştur
    const token = await createToken({
      userId: user.id,
      email: user.email!,
      username: user.siteUsername!
    })

    console.log('✅ Yeni kullanıcı kaydedildi:', {
      email: user.email,
      siteUsername: user.siteUsername
    })

    // Activity log
    const requestInfo = extractRequestInfo(request)
    await logRegister(
      user.id,
      user.email!,
      user.siteUsername!,
      requestInfo
    )

    return createAuthResponse({
      success: true,
      message: 'Kayıt başarılı!',
      user: {
        id: user.id,
        email: user.email,
        siteUsername: user.siteUsername,
        telegramUsername: null,
        firstName: null,
        lastName: null,
        points: user.points,
        xp: user.xp,
        telegramId: null,
        hadStart: false
      }
    }, token)

  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json(
      { error: 'Kayıt işlemi sırasında bir hata oluştu' },
      { status: 500 }
    )
  }
}
