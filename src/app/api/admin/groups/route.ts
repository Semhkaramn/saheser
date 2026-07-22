import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/admin-middleware'

export async function GET(request: NextRequest) {
  const authCheck = await requirePermission(request, 'canAccessSettings')
  if (authCheck.error) return authCheck.error

  try {
    const { searchParams } = new URL(request.url)
    const includeSponsorGroups = searchParams.get('includeSponsorGroups') === 'true'
    // Sponsor formu kendi grubunu görebilsin ama BAŞKA sponsörlerin
    // gruplarını görmesin diye - düzenlenen sponsörün ID'si.
    const currentSponsorId = searchParams.get('currentSponsorId')

    const [groups, sponsorApprovalGroups] = await Promise.all([
      prisma.telegramGroup.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.sponsor.findMany({ where: { approvalGroupId: { not: null } }, select: { id: true, approvalGroupId: true } }),
    ])

    // Sponsor onay kartlarının gönderildiği gruplar, Gruplar/Randy gibi genel
    // yönetim listelerinde gösterilmiyor - bunlar tek amaçlı onay grupları,
    // topluluk yönetimi için değil. Sponsor düzenleme formunun kendisi
    // (includeSponsorGroups=true) BAŞKA sponsörlere ait grupları yine de
    // gizler - sadece kendi (currentSponsorId) grubunu görebilir, yoksa bir
    // sponsöre atanmış grup başka bir sponsöre de yanlışlıkla atanabilirdi.
    const otherSponsorsGroupIds = new Set(
      sponsorApprovalGroups
        .filter((s: { id: string; approvalGroupId: string | null }) => s.id !== currentSponsorId)
        .map((s: { id: string; approvalGroupId: string | null }) => s.approvalGroupId)
        .filter((id: string | null): id is string => id !== null)
    )
    const allSponsorGroupIds = new Set(
      sponsorApprovalGroups
        .map((s: { id: string; approvalGroupId: string | null }) => s.approvalGroupId)
        .filter((id: string | null): id is string => id !== null)
    )

    const visibleGroups = includeSponsorGroups
      ? groups.filter((g: { groupId: string }) => !otherSponsorsGroupIds.has(g.groupId))
      : groups.filter((g: { groupId: string }) => !allSponsorGroupIds.has(g.groupId))

    const groupsWithCounts = await Promise.all(
      visibleGroups.map(async (g: { id: string; groupId: string; title: string | null; chatType: string; isActive: boolean; createdAt: Date }) => {
        const memberCount = await prisma.telegramGroupUser.count({ where: { lastGroupId: g.groupId } })
        return {
          id: g.id,
          groupId: g.groupId,
          title: g.title,
          chatType: g.chatType,
          isActive: g.isActive,
          memberCount,
          createdAt: g.createdAt,
        }
      })
    )

    return NextResponse.json({ groups: groupsWithCounts })
  } catch (error) {
    console.error('Groups list error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
