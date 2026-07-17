import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const schema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = schema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: 'Geçersiz veri' }, { status: 400 })
    }
    const { email, code } = validation.data

    const pending = await prisma.pendingEmailVerification.findUnique({ where: { email } })

    if (!pending) {
      return NextResponse.json({ error: 'Önce bir doğrulama kodu isteyin' }, { status: 400 })
    }

    if (pending.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Kodun süresi dolmuş, yeni kod isteyin' }, { status: 400 })
    }

    if (pending.code !== code) {
      return NextResponse.json({ error: 'Kod hatalı' }, { status: 400 })
    }

    await prisma.pendingEmailVerification.update({
      where: { email },
      data: { verified: true },
    })

    return NextResponse.json({ success: true, message: 'Email doğrulandı' })
  } catch (error) {
    console.error('Verify registration code error:', error)
    return NextResponse.json({ error: 'Bir hata oluştu' }, { status: 500 })
  }
}
