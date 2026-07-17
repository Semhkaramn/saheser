import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/admin-middleware'
import { setCrossBanEnabled } from '@/lib/telegram/services/cross-ban-service'
import { z } from 'zod'

export async function GET(request: NextRequest) {
  const authCheck = await requirePermission(request, 'canAccessSettings')
  if (authCheck.error) return authCheck.error

  try {
    const groups = await prisma.telegramGroup.findMany({ where: { isActive: true }, orderBy: { title: 'asc' } })

    // Sponsor onay kartlarının gönderildiği gruplar (tek amaçlı - topluluk
    // yönetimi için değil) çapraz ban ağı listesinde de görünmemeli.
    const sponsorApprovalGroups = await prisma.sponsor.findMany({
      where: { approvalGroupId: { not: null } },
      select: { approvalGroupId: true },
    })
    const sponsorGroupIds = new Set(sponsorApprovalGroups.map((s: { approvalGroupId: string | null }) => s.approvalGroupId))
    const visibleGroups = groups.filter((g) => !sponsorGroupIds.has(g.groupId))

    const settings = await prisma.crossBanSettings.findMany({ where: { groupId: { in: visibleGroups.map((g) => g.groupId) } } })
    const settingsMap = new Map(settings.map((s) => [s.groupId, s.enabled]))

    const result = visibleGroups.map((g) => ({
      groupId: g.groupId,
      title: g.title,
      enabled: settingsMap.get(g.groupId) ?? true,
    }))

    return NextResponse.json({ groups: result })
  } catch (error) {
    console.error('Cross-ban settings GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const authCheck = await requirePermission(request, 'canAccessSettings')
  if (authCheck.error) return authCheck.error

  try {
    const schema = z.object({ groupId: z.string(), enabled: z.boolean() })
    const { groupId, enabled } = schema.parse(await request.json())

    await setCrossBanEnabled(groupId, enabled)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Cross-ban settings POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
