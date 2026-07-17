import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/admin-middleware'
import { getShortLinkStats } from '@/lib/services/short-links'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authCheck = await requirePermission(request, 'canAccessSettings')
  if (authCheck.error) return authCheck.error

  try {
    const { id } = await params
    const days = Number(request.nextUrl.searchParams.get('days') || 14)

    const [stats, topReferrers] = await Promise.all([
      getShortLinkStats(id, days),
      // ✅ En çok tıklamayı hangi kaynaktan aldığını da göster - profesyonel
      // bir analiz ekranı için sadece günlük sayı yeterli değil.
      prisma.shortLinkClick.groupBy({
        by: ['referrer'],
        where: { shortLinkId: id },
        _count: { referrer: true },
        orderBy: { _count: { referrer: 'desc' } },
        take: 5,
      }),
    ])

    return NextResponse.json({
      ...stats,
      topReferrers: topReferrers.map((r) => ({
        referrer: r.referrer || 'Doğrudan / Bilinmiyor',
        count: r._count.referrer,
      })),
    })
  } catch (error) {
    console.error('Short link stats error:', error)
    return NextResponse.json({ error: 'İstatistikler yüklenemedi' }, { status: 500 })
  }
}
