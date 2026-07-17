import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { getTurkeyDate } from '@/lib/utils'
import { sendVerificationCodeEmail } from '@/lib/email'

// 6 haneli doğrulama kodu oluştur
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request)

    // Kullanıcıyı bul
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        email: true,
        emailVerified: true,
        emailVerificationTokenExpiry: true,
        siteUsername: true,
        firstName: true
      }
    })

    if (!user || !user.email) {
      return NextResponse.json(
        { error: 'Email adresi bulunamadı' },
        { status: 404 }
      )
    }

    if (user.emailVerified) {
      return NextResponse.json(
        { error: 'Email adresi zaten doğrulanmış' },
        { status: 400 }
      )
    }

    // Rate limiting: Son kod gönderiminden 30 saniye geçmeli.
    // ⚠️ FIX: emailVerificationTokenExpiry, "ne zaman gönderildi" değil "ne
    // zaman geçersiz olacak" (gönderim + 10 dakika) bilgisini tutuyor. Eski
    // hesaplama bunu doğrudan "şimdi" ile karşılaştırıyordu, bu da
    // kullanıcıyı aslında ~10 dakika bekletiyordu (30-60 saniye değil) -
    // "ikinci kod gönderme süresi çok fazla" şikayetinin asıl sebebi buydu.
    if (user.emailVerificationTokenExpiry) {
      const now = new Date()
      const codeValidityMs = 10 * 60 * 1000
      const sentAt = new Date(user.emailVerificationTokenExpiry.getTime() - codeValidityMs)
      const timeSinceLastSend = now.getTime() - sentAt.getTime()
      const cooldown = 30 * 1000

      if (timeSinceLastSend < cooldown && user.emailVerificationTokenExpiry > now) {
        const waitSeconds = Math.ceil((cooldown - timeSinceLastSend) / 1000)
        return NextResponse.json(
          { error: `Lütfen ${waitSeconds} saniye bekleyin` },
          { status: 429 }
        )
      }
    }

    // Doğrulama kodu oluştur
    const verificationCode = generateVerificationCode()
    const expiryDate = new Date(getTurkeyDate().getTime() + 10 * 60 * 1000) // 10 dakika geçerli

    // Kodu veritabanına kaydet
    await prisma.user.update({
      where: { id: session.userId },
      data: {
        emailVerificationToken: verificationCode,
        emailVerificationTokenExpiry: expiryDate
      }
    })

    // Email gönder
    try {
      if (!process.env.RESEND_API_KEY) {
        console.warn('RESEND_API_KEY not configured, skipping email send')
        console.log(`Verification code for ${user.email}: ${verificationCode}`)
      } else {
        await sendVerificationCodeEmail(user.email, verificationCode, user.siteUsername || user.firstName || undefined)
      }
    } catch (emailError) {
      console.error('Email send error:', emailError)
      // Email gönderimi başarısız olsa bile devam et
    }

    return NextResponse.json({
      success: true,
      message: 'Doğrulama kodu email adresinize gönderildi',
      // Development için kodu döndürelim (production'da kaldırılmalı)
      ...(process.env.NODE_ENV === 'development' && { code: verificationCode })
    })
  } catch (error) {
    console.error('Send verification email error:', error)

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Giriş yapmalısınız' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: 'Bir hata oluştu' },
      { status: 500 }
    )
  }
}
