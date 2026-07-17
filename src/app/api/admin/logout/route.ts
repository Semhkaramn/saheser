import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { clearAdminAuthCookie } from '@/lib/admin-middleware'

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_auth_token')?.value

    if (token) {
      // Session tablosundan sil
      try {
        await prisma.adminSession.delete({
          where: { token }
        })
      } catch (error) {
        // Token zaten silinmişse veya bulunamazsa devam et
        console.log('Token not found in session table:', error)
      }
    }

    // Cookie'yi temizle
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    })

    response.headers.append('Set-Cookie', clearAdminAuthCookie())

    return response
  } catch (error) {
    console.error('Admin logout error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
