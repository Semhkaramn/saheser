import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { createAdminToken, setAdminAuthCookie } from '@/lib/admin-middleware'
import { checkLoginRateLimit, resetLoginRateLimit } from '@/lib/rate-limit'

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  return forwarded ? forwarded.split(',')[0].trim() : request.headers.get('x-real-ip') || 'unknown'
}

export async function POST(request: NextRequest) {
  try {
    const ipAddress = getClientIp(request)
    // 🔒 Admin girişi daha hassas olduğu için daha sıkı bir sınır: 10
    // dakikada en fazla 5 deneme.
    const rateCheck = await checkLoginRateLimit(`admin:${ipAddress}`, 5, 600)
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Çok fazla başarısız giriş denemesi. Lütfen birkaç dakika sonra tekrar dene.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { username, password } = body

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password required' },
        { status: 400 }
      )
    }

    // Trim ve lowercase işlemi
    const trimmedUsername = username.trim().toLowerCase()

    // Admin kullanıcısını bul
    const admin = await prisma.admin.findFirst({
      where: {
        username: {
          mode: 'insensitive',
          equals: trimmedUsername
        }
      }
    })

    if (!admin) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Şifreyi kontrol et
    const isValidPassword = await bcrypt.compare(password, admin.passwordHash)

    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Başarılı giriş - deneme sayacını sıfırla
    await resetLoginRateLimit(`admin:${ipAddress}`)

    // JWT token oluştur
    const token = await createAdminToken({
      adminId: admin.id,
      username: admin.username,
      isSuperAdmin: admin.isSuperAdmin
    })

    // ✅ YENİ: Session tablosuna kaydet
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 gün
    await prisma.adminSession.create({
      data: {
        adminId: admin.id,
        token,
        expiresAt
      }
    })

    // Response oluştur ve cookie set et
    const response = NextResponse.json({
      success: true,
      adminId: admin.id,
      username: admin.username,
      isSuperAdmin: admin.isSuperAdmin
    })

    response.headers.append('Set-Cookie', setAdminAuthCookie(token))

    return response
  } catch (error) {
    console.error('Admin login error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
