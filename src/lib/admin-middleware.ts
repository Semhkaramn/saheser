import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify, SignJWT } from 'jose'
import { serialize } from 'cookie'
import { prisma } from './prisma'

export interface AdminPermissions {
  canAccessUsers: boolean
  canAccessTasks: boolean
  canAccessShop: boolean
  canAccessWheel: boolean
  canAccessSponsors: boolean
  canAccessAds: boolean
  canAccessRanks: boolean
  canAccessSettings: boolean
  canAccessAdmins: boolean
  canAccessTickets: boolean
  canAccessEvents: boolean
  canAccessPromocodes: boolean
  canAccessActivityLogs: boolean
  isSuperAdmin: boolean
}

export interface AdminSession {
  adminId: string
  username: string
  isSuperAdmin: boolean
}

// 🚀 OPTIMIZED: JWT_SECRET from ENV (no DB query needed)
function getJWTSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET || process.env.JWT_SECRET

  if (!secret) {
    throw new Error('SESSION_SECRET or JWT_SECRET not configured in environment variables')
  }

  return new TextEncoder().encode(secret)
}

/**
 * Admin için JWT token oluşturur
 */
export async function createAdminToken(payload: AdminSession): Promise<string> {
  const JWT_SECRET = getJWTSecret()

  const token = await new SignJWT({
    adminId: payload.adminId,
    username: payload.username,
    isSuperAdmin: payload.isSuperAdmin
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d') // 7 gün
    .sign(JWT_SECRET)

  return token
}

/**
 * Admin JWT token'ı doğrular ve session kontrolü yapar
 */
export async function verifyAdminToken(token: string): Promise<AdminSession | null> {
  try {
    const JWT_SECRET = getJWTSecret()

    // JWT doğrulaması
    const { payload } = await jwtVerify(token, JWT_SECRET)

    // ✅ YENİ: Session tablosunda kontrol et
    const session = await prisma.adminSession.findUnique({
      where: { token }
    })

    if (!session) {
      return null // Token silinmiş (logout yapılmış)
    }

    if (session.expiresAt < new Date()) {
      // Süresi dolmuş session'ı temizle
      await prisma.adminSession.delete({ where: { id: session.id } })
      return null
    }

    return {
      adminId: payload.adminId as string,
      username: payload.username as string,
      isSuperAdmin: payload.isSuperAdmin as boolean
    }
  } catch (error) {
    return null
  }
}

/**
 * Request'ten admin session bilgisini alır
 * Hem cookie hem de Authorization header destekler
 */
export async function getAdminSession(request: NextRequest): Promise<AdminSession | null> {
  try {
    // 1. Önce cookie'den dene
    let token = request.cookies.get('admin_auth_token')?.value

    // 2. Cookie yoksa Authorization header'dan dene
    if (!token) {
      const authHeader = request.headers.get('Authorization')
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.substring(7)
      }
    }

    if (!token) return null

    return await verifyAdminToken(token)
  } catch (error) {
    return null
  }
}

/**
 * Admin auth cookie'sini set eder
 */
export function setAdminAuthCookie(token: string): string {
  const isProduction = process.env.NODE_ENV === 'production'

  return serialize('admin_auth_token', token, {
    httpOnly: true,
    secure: isProduction,
    // 🔧 Telegram WebApp iframe içinde çalıştığı için 'none' kullanmalıyız
    // 'none' kullanmak için secure: true olmalı (production'da)
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 gün
    path: '/'
  })
}

/**
 * Admin auth cookie'sini siler
 */
export function clearAdminAuthCookie(): string {
  const isProduction = process.env.NODE_ENV === 'production'

  return serialize('admin_auth_token', '', {
    httpOnly: true,
    secure: isProduction,
    // 🔧 Telegram WebApp iframe içinde çalıştığı için 'none' kullanmalıyız
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 0,
    path: '/'
  })
}

/**
 * Token'dan admin bilgisini alır (eski fonksiyon - geriye uyumluluk için)
 */
export async function getAdminFromToken(token: string) {
  const session = await verifyAdminToken(token)
  if (!session) return null

  const admin = await prisma.admin.findUnique({
    where: { id: session.adminId }
  })

  return admin
}

export async function requireAdmin(request: NextRequest) {
  const session = await getAdminSession(request)

  if (!session) {
    return {
      admin: null,
      error: NextResponse.json(
        { error: 'Unauthorized - Token required' },
        { status: 401 }
      )
    }
  }

  const admin = await prisma.admin.findUnique({
    where: { id: session.adminId }
  })

  if (!admin) {
    return {
      admin: null,
      error: NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      )
    }
  }

  return { admin, error: null }
}

export async function requirePermission(
  request: NextRequest,
  permission: keyof AdminPermissions
) {
  const authResult = await requireAdmin(request)

  if (authResult.error) {
    return authResult
  }

  const admin = authResult.admin!

  // Super admin her şeye erişebilir
  if (admin.isSuperAdmin) {
    return { admin, error: null }
  }

  // Belirtilen yetkiyi kontrol et
  if (!admin[permission]) {
    return {
      admin: null,
      error: NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }
  }

  return { admin, error: null }
}
