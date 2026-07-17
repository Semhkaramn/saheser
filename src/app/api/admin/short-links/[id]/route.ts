import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/admin-middleware'
import { updateShortLink, deleteShortLink, getShortLinkStats } from '@/lib/services/short-links'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  const authCheck = await requirePermission(request, 'canAccessSettings')
  if (authCheck.error) return authCheck.error

  try {
    const { id } = await params
    const body = await request.json()
    const link = await updateShortLink(id, body)
    return NextResponse.json({ success: true, link })
  } catch (error) {
    console.error('Short link PATCH error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Güncellenemedi' }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const authCheck = await requirePermission(request, 'canAccessSettings')
  if (authCheck.error) return authCheck.error

  try {
    const { id } = await params
    await deleteShortLink(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Short link DELETE error:', error)
    return NextResponse.json({ error: 'Silinemedi' }, { status: 500 })
  }
}

export async function GET(request: NextRequest, { params }: Params) {
  const authCheck = await requirePermission(request, 'canAccessSettings')
  if (authCheck.error) return authCheck.error

  try {
    const { id } = await params
    const stats = await getShortLinkStats(id)
    return NextResponse.json({ stats })
  } catch (error) {
    console.error('Short link stats GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
