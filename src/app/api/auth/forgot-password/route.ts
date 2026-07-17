import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendPasswordResetEmail } from '@/lib/email'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email gerekli' },
        { status: 400 }
      )
    }

    // Kullanıcıyı bul
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    })

    // ✅ Kullanıcı bulunamadıysa hata ver (güvenlik yerine kullanıcı deneyimi)
    if (!user) {
      return NextResponse.json(
        { error: 'Bu e-mail adresi sistemde kayıtlı değil' },
        { status: 404 }
      )
    }

    // Şifre sıfırlama token'ı oluştur (32 byte random)
    const resetToken = crypto.randomBytes(32).toString('hex')
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000) // 1 saat

    // Token'ı DB'ye kaydet
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetTokenExpiry: resetTokenExpiry
      }
    })

    // Email gönder
    await sendPasswordResetEmail(
      user.email!,
      resetToken,
      user.siteUsername || user.firstName || undefined
    )

    return NextResponse.json({
      success: true,
      message: 'Eğer bu email kayıtlıysa, şifre sıfırlama linki gönderildi.'
    })

  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json(
      { error: 'İşlem sırasında hata oluştu' },
      { status: 500 }
    )
  }
}
