import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { getTurkeyDate } from '@/lib/utils'

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request)
    const body = await request.json()
    const { code } = body

    if (!code) {
      return NextResponse.json(
        { error: 'Doğrulama kodu gerekli' },
        { status: 400 }
      )
    }

    // Kullanıcıyı bul
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        emailVerified: true,
        emailVerificationToken: true,
        emailVerificationTokenExpiry: true
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Kullanıcı bulunamadı' },
        { status: 404 }
      )
    }

    if (user.emailVerified) {
      return NextResponse.json(
        { error: 'Email adresi zaten doğrulanmış' },
        { status: 400 }
      )
    }

    if (!user.emailVerificationToken || !user.emailVerificationTokenExpiry) {
      return NextResponse.json(
        { error: 'Doğrulama kodu bulunamadı. Lütfen yeni kod isteyin' },
        { status: 400 }
      )
    }

    // Kodun süresinin dolup dolmadığını kontrol et
    if (new Date() > user.emailVerificationTokenExpiry) {
      return NextResponse.json(
        { error: 'Doğrulama kodunun süresi dolmuş. Lütfen yeni kod isteyin' },
        { status: 400 }
      )
    }

    // Kodu kontrol et
    if (code !== user.emailVerificationToken) {
      return NextResponse.json(
        { error: 'Geçersiz doğrulama kodu' },
        { status: 400 }
      )
    }

    // Email'i doğrulanmış olarak işaretle ve token'ları temizle
    await prisma.user.update({
      where: { id: session.userId },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationTokenExpiry: null
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Email adresi başarıyla doğrulandı'
    })
  } catch (error) {
    console.error('Verify email error:', error)

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
