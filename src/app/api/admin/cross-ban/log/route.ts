import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/admin-middleware'
import { getRecentCrossBans } from '@/lib/telegram/services/cross-ban-service'

export async function GET(request: NextRequest) {
  const authCheck = await requirePermission(request, 'canAccessSettings')
  if (authCheck.error) return authCheck.error

  try {
    const logs = await getRecentCrossBans(30)
    return NextResponse.json({ logs })
  } catch (error) {
    console.error('Cross-ban log GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
