import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/admin-middleware'
import {
  getRandyGroupDefaults,
  setRandyGroupDefaults,
  listRandyGroupDefaultChannels,
  addRandyGroupDefaultChannel,
  removeRandyGroupDefaultChannel,
} from '@/lib/telegram/services/randy-quick-draft-service'

// ✅ Web panelindeki Randy ayarları artık "her seferinde yeni taslak oluştur"
// akışı değil - bottaki "Randy Ayarları" ile AYNI kalıcı kayda (bir grup için
// TEK RandyGroupDefaults satırı) bakan, her zaman düzenlenebilen bir ekran.
export async function GET(request: NextRequest) {
  const authCheck = await requirePermission(request, 'canAccessSettings')
  if (authCheck.error) return authCheck.error

  const groupId = request.nextUrl.searchParams.get('groupId')
  if (!groupId) return NextResponse.json({ error: 'groupId gerekli' }, { status: 400 })

  const [defaults, channels] = await Promise.all([
    getRandyGroupDefaults(groupId),
    listRandyGroupDefaultChannels(groupId),
  ])

  return NextResponse.json({ defaults, channels })
}

export async function PATCH(request: NextRequest) {
  const authCheck = await requirePermission(request, 'canAccessSettings')
  if (authCheck.error) return authCheck.error

  try {
    const body = await request.json()
    const { groupId, message, requirementType, requiredMessageCount, winnerCount, pointsReward } = body
    if (!groupId) return NextResponse.json({ error: 'groupId gerekli' }, { status: 400 })

    const defaults = await setRandyGroupDefaults(groupId, {
      message: message ?? null,
      requirementType: requirementType || 'none',
      requiredMessageCount: requiredMessageCount ? Number(requiredMessageCount) : null,
      winnerCount: winnerCount ? Number(winnerCount) : null,
      pointsReward: pointsReward ? Number(pointsReward) : null,
    })

    return NextResponse.json({ success: true, defaults })
  } catch (error) {
    console.error('Randy defaults update error:', error)
    return NextResponse.json({ error: 'Bir hata oluştu' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  // Kanal ekleme
  const authCheck = await requirePermission(request, 'canAccessSettings')
  if (authCheck.error) return authCheck.error

  try {
    const { groupId, channelId, channelUsername, channelTitle } = await request.json()
    if (!groupId || !channelId) return NextResponse.json({ error: 'groupId ve channelId gerekli' }, { status: 400 })

    await addRandyGroupDefaultChannel(groupId, channelId, channelUsername, channelTitle)
    const channels = await listRandyGroupDefaultChannels(groupId)
    return NextResponse.json({ success: true, channels })
  } catch (error) {
    console.error('Randy default channel add error:', error)
    return NextResponse.json({ error: 'Bir hata oluştu' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const authCheck = await requirePermission(request, 'canAccessSettings')
  if (authCheck.error) return authCheck.error

  try {
    const groupId = request.nextUrl.searchParams.get('groupId')
    const channelId = request.nextUrl.searchParams.get('channelId')
    if (!groupId || !channelId) return NextResponse.json({ error: 'groupId ve channelId gerekli' }, { status: 400 })

    await removeRandyGroupDefaultChannel(groupId, channelId)
    const channels = await listRandyGroupDefaultChannels(groupId)
    return NextResponse.json({ success: true, channels })
  } catch (error) {
    console.error('Randy default channel remove error:', error)
    return NextResponse.json({ error: 'Bir hata oluştu' }, { status: 500 })
  }
}
