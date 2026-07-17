import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { sendVerificationCodeEmail } from '@/lib/email'

const schema = z.object({ email: z.string().email('Geçerli bir email adresi giriniz') })

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = schema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: 'Geçerli bir email adresi girin' }, { status: 400 })
    }
    const { email } = validation.data

    // Bu email zaten kayıtlı mı?
    const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } })
    if (existingUser) {
      return NextResponse.json({ error: 'Bu email adresi zaten kullanılıyor' }, { status: 400 })
    }

    // Rate limiting: 30 saniyede bir
    const existing = await prisma.pendingEmailVerification.findUnique({ where: { email } })
    if (existing) {
      const sentAt = new Date(existing.expiresAt.getTime() - 10 * 60 * 1000)
      const secondsSinceSend = (Date.now() - sentAt.getTime()) / 1000
      if (secondsSinceSend < 30) {
        return NextResponse.json(
          { error: `Lütfen ${Math.ceil(30 - secondsSinceSend)} saniye bekleyin` },
          { status: 429 }
        )
      }
    }

    const code = generateCode()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

    await prisma.pendingEmailVerification.upsert({
      where: { email },
      update: { code, verified: false, expiresAt },
      create: { email, code, expiresAt },
    })

    try {
      if (!process.env.RESEND_API_KEY) {
        console.warn('RESEND_API_KEY not configured, skipping email send')
        console.log(`Registration code for ${email}: ${code}`)
      } else {
        await sendVerificationCodeEmail(email, code)
      }
    } catch (emailError) {
      console.error('Email send error:', emailError)
    }

    return NextResponse.json({
      success: true,
      message: 'Doğrulama kodu email adresinize gönderildi',
      ...(process.env.NODE_ENV === 'development' && { code }),
    })
  } catch (error) {
    console.error('Send registration code error:', error)
    return NextResponse.json({ error: 'Bir hata oluştu' }, { status: 500 })
  }
}
