import { NextRequest, NextResponse } from 'next/server'
import { createLogoutResponse } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    return createLogoutResponse()
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { error: 'Çıkış yapılırken hata oluştu' },
      { status: 500 }
    )
  }
}
