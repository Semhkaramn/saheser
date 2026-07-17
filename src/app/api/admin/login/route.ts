import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { createAdminToken, setAdminAuthCookie } from '@/lib/admin-middleware'

export async function POST(request: NextRequest) {
  try {
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
