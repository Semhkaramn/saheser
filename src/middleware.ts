import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// 🚀 OPTIMIZED: Performance middleware for 200-300 concurrent users
export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // 🚀 OPTIMIZATION: Add performance headers
  response.headers.set('X-DNS-Prefetch-Control', 'on')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  // 🔧 Telegram WebApp iframe içinde çalışabilmesi için
  // X-Frame-Options yerine Content-Security-Policy kullanıyoruz
  // Telegram'ın iframe'ine izin ver
  response.headers.set('Content-Security-Policy', "frame-ancestors 'self' https://web.telegram.org https://*.telegram.org")

  // 🚀 OPTIMIZATION: Add cache headers for static assets
  if (request.nextUrl.pathname.startsWith('/_next/static/')) {
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable')
  }

  // 🚀 OPTIMIZATION: Add cache headers for API routes (vary by route)
  if (request.nextUrl.pathname.startsWith('/api/')) {
    // Most API routes should have some caching
    if (request.nextUrl.pathname.includes('/settings') ||
        request.nextUrl.pathname.includes('/sponsors') ||
        request.nextUrl.pathname.includes('/leaderboard')) {
      response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
