import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/admin-middleware'
import { listShortLinks, createShortLink } from '@/lib/services/short-links'

export async function GET(request: NextRequest) {
  const authCheck = await requirePermission(request, 'canAccessSettings')
  if (authCheck.error) return authCheck.error

  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q') || undefined
    const links = await listShortLinks(q)
    return NextResponse.json({ links })
  } catch (error) {
    console.error('Short links GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const authCheck = await requirePermission(request, 'canAccessSettings')
  if (authCheck.error) return authCheck.error

  try {
    const body = await request.json()
    const link = await createShortLink(body)
    return NextResponse.json({ success: true, link })
  } catch (error) {
    console.error('Short links POST error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Oluşturulamadı' }, { status: 400 })
  }
}
