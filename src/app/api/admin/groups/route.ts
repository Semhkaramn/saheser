import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/admin-middleware'

export async function GET(request: NextRequest) {
  const authCheck = await requirePermission(request, 'canAccessSettings')
  if (authCheck.error) return authCheck.error

  try {
    const { searchParams } = new URL(request.url)
    const includeSponsorGroups = searchParams.get('includeSponsorGroups') === 'true'

    const [groups, sponsorApprovalGroups] = await Promise.all([
      prisma.telegramGroup.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.sponsor.findMany({ where: { approvalGroupId: { not: null } }, select: { approvalGroupId: true } }),
    ])

    // Sponsor onay kartlarının gönderildiği gruplar, Gruplar/Randy gibi genel
    // yönetim listelerinde gösterilmiyor - bunlar tek amaçlı onay grupları,
    // topluluk yönetimi için değil. AMA sponsor düzenleme formunun kendisi
    // (includeSponsorGroups=true) bu filtreyi atlıyor - yoksa bir sponsöre
    // ZATEN atanmış grup, o sponsörü düzenlerken bile "bulunamadı" görünürdü.
    const sponsorGroupIds = new Set(sponsorApprovalGroups.map((s: { approvalGroupId: string | null }) => s.approvalGroupId))
    const visibleGroups = includeSponsorGroups ? groups : groups.filter((g: { groupId: string }) => !sponsorGroupIds.has(g.groupId))

    const groupsWithCounts = await Promise.all(
      visibleGroups.map(async (g) => {
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
