import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/admin-middleware'
import { getExcludedUsers, setUserTaggableByUsernameOrId } from '@/lib/telegram/services/tagging-service'

type Params = { params: Promise<{ groupId: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const authCheck = await requirePermission(request, 'canAccessSettings')
  if (authCheck.error) return authCheck.error

  try {
    const { groupId } = await params
    const excluded = await getExcludedUsers(groupId)
    return NextResponse.json({ excluded })
  } catch (error) {
    console.error('Tagging exclude GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const authCheck = await requirePermission(request, 'canAccessSettings')
  if (authCheck.error) return authCheck.error

  try {
    const { groupId } = await params
    const { input, exclude } = await request.json()
    if (!input || typeof input !== 'string') {
      return NextResponse.json({ error: 'Kullanıcı adı/ID gerekli' }, { status: 400 })
    }
    const result = await setUserTaggableByUsernameOrId(groupId, input, !exclude)
    if (!result.ok) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }
    return NextResponse.json({ success: true, matchedName: result.matchedName })
  } catch (error) {
    console.error('Tagging exclude POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
