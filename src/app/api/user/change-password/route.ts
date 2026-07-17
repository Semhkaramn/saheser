import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { logPasswordChange, extractRequestInfo } from '@/lib/services/activity-log-service'

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request)
    const body = await request.json()
    const { currentPassword, newPassword } = body

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Mevcut şifre ve yeni şifre gerekli' },
        { status: 400 }
      )
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Yeni şifre en az 6 karakter olmalıdır' },
        { status: 400 }
      )
    }

    // Kullanıcıyı bul
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { password: true }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Kullanıcı bulunamadı' },
        { status: 404 }
      )
    }

    // Email/password ile giriş yapmış kullanıcı mı kontrol et
    if (!user.password) {
      return NextResponse.json(
        { error: 'Bu işlem sadece şifre ile kayıt olan kullanıcılar için geçerlidir' },
        { status: 400 }
      )
    }

    // Mevcut şifreyi kontrol et
    const isValidPassword = await bcrypt.compare(currentPassword, user.password)

    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Mevcut şifre yanlış' },
        { status: 401 }
      )
    }

    // Yeni şifreyi hashle ve güncelle
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    await prisma.user.update({
      where: { id: session.userId },
      data: { password: hashedPassword }
    })

    // Activity log
    const requestInfo = extractRequestInfo(request)
    await logPasswordChange(session.userId, requestInfo)

    return NextResponse.json({
      success: true,
      message: 'Şifre başarıyla değiştirildi'
    })
  } catch (error) {
    console.error('Change password error:', error)

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
