import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify, SignJWT } from 'jose'
import { serialize } from 'cookie'
import { prisma } from './prisma'

export interface Session {
  userId: string
  email: string
  username: string
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
 * Yeni JWT token oluşturur
 */
export async function createToken(payload: Session): Promise<string> {
  const JWT_SECRET = getJWTSecret()

  const token = await new SignJWT({
    userId: payload.userId,
    email: payload.email,
    username: payload.username
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d') // 7 gün
    .sign(JWT_SECRET)

  return token
}

/**
 * JWT token'ı doğrular ve payload'ı döner
 */
export async function verifyToken(token: string): Promise<Session | null> {
  try {
    const JWT_SECRET = getJWTSecret()
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return {
      userId: payload.userId as string,
      email: payload.email as string,
      username: payload.username as string
    }
  } catch (error) {
    return null
  }
}

/**
 * Request'ten session bilgisini alır
 */
export async function getSession(request: NextRequest): Promise<Session | null> {
  try {
    const token = request.cookies.get('auth_token')?.value
    if (!token) return null

    return await verifyToken(token)
  } catch (error) {
    return null
  }
}

/**
 * Auth gerektiren endpoint'lerde kullanılır
 * Session yoksa hata fırlatır
 */
export async function requireAuth(request: NextRequest): Promise<Session> {
  const session = await getSession(request)
  if (!session) {
    throw new Error('Unauthorized')
  }
  return session
}

/**
 * Auth token cookie'sini response'a ekler
 */
export function setAuthCookie(token: string): string {
  const isProduction = process.env.NODE_ENV === 'production'

  return serialize('auth_token', token, {
    httpOnly: true,
    secure: isProduction,
    // Telegram WebApp iframe içinde çalıştığı için 'none' kullanmalıyız
    // 'none' kullanmak için secure: true olmalı (production'da)
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 gün
    path: '/'
  })
}

/**
 * Auth token cookie'sini siler (logout)
 */
export function clearAuthCookie(): string {
  const isProduction = process.env.NODE_ENV === 'production'

  return serialize('auth_token', '', {
    httpOnly: true,
    secure: isProduction,
    // 🔧 Telegram WebApp iframe içinde çalıştığı için 'none' kullanmalıyız
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 0,
    path: '/'
  })
}

/**
 * Response ile birlikte auth cookie set eder
 */
export function createAuthResponse(data: any, token: string): NextResponse {
  const response = NextResponse.json(data)
  response.headers.append('Set-Cookie', setAuthCookie(token))
  return response
}

/**
 * Logout response oluşturur
 */
export function createLogoutResponse(): NextResponse {
  const response = NextResponse.json({ success: true, message: 'Çıkış yapıldı' })
  response.headers.append('Set-Cookie', clearAuthCookie())
  return response
}
