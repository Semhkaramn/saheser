import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/admin-middleware'
import { getCachedData } from '@/lib/enhanced-cache'

/**
 * ========== MULTİ HESAP TESPİT API ==========
 *
 * Bu endpoint multi hesap tespiti yapar:
 * - Aynı IP adresi farklı kullanıcılarda (activity log'dan)
 */

interface MultiMatch {
  type: 'ip'
  value: string
  users: {
    id: string
    siteUsername: string | null
    telegramId: string | null
    telegramUsername: string | null
    firstName: string | null
    points: number
    createdAt: Date
  }[]
  count: number
}

export async function GET(request: NextRequest) {
  const authCheck = await requirePermission(request, 'canAccessUsers')
  if (authCheck.error) return authCheck.error

  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId') // Belirli bir kullanıcı için multi tespiti
    const includeStats = searchParams.get('includeStats') === 'true'

    const result: {
      matches: MultiMatch[]
      stats?: {
        totalDuplicateIPs: number
        usersWithMulti: number
      }
    } = {
      matches: []
    }

    // ========== IP ADRESİ DUPLIKASYONU ==========
    // Activity log'dan aynı IP'yi kullanan farklı kullanıcıları bul
    let userIPs: string[] = []
    if (userId) {
      const userLogs = await prisma.userActivityLog.findMany({
        where: { userId, ipAddress: { not: null } },
        select: { ipAddress: true },
        distinct: ['ipAddress']
      })
      userIPs = userLogs.map(l => l.ipAddress!).filter(Boolean)
    }

    const duplicateIPs = await prisma.$queryRaw<Array<{
      ipAddress: string
      userCount: bigint
    }>>`
      SELECT
        "ipAddress",
        COUNT(DISTINCT "userId") as "userCount"
      FROM "UserActivityLog"
      WHERE "ipAddress" IS NOT NULL
      GROUP BY "ipAddress"
      HAVING COUNT(DISTINCT "userId") > 1
      ORDER BY COUNT(DISTINCT "userId") DESC
      LIMIT 100
    `

    for (const ip of duplicateIPs) {
      // userId belirtildiyse, sadece o kullanıcıyı içeren eşleşmeleri göster
      if (userId && !userIPs.includes(ip.ipAddress)) continue

      const userIds = await prisma.userActivityLog.findMany({
        where: { ipAddress: ip.ipAddress },
        select: { userId: true },
        distinct: ['userId']
      })

      const users = await prisma.user.findMany({
        where: { id: { in: userIds.map(u => u.userId) } },
        select: {
          id: true,
          siteUsername: true,
          telegramId: true,
          telegramUsername: true,
          firstName: true,
          points: true,
          createdAt: true
        }
      })

      result.matches.push({
        type: 'ip',
        value: ip.ipAddress,
        users,
        count: users.length
      })
    }

    // ========== İSTATİSTİKLER ==========
    if (includeStats) {
      // Cache stats for 5 minutes
      const stats = await getCachedData(
        'multi-detection:stats:ip-only',
        async () => {
          // Duplicate IP count
          const duplicateIPCount = await prisma.$queryRaw<[{ count: bigint }]>`
            SELECT COUNT(*) as count FROM (
              SELECT "ipAddress"
              FROM "UserActivityLog"
              WHERE "ipAddress" IS NOT NULL
              GROUP BY "ipAddress"
              HAVING COUNT(DISTINCT "userId") > 1
            ) as duplicates
          `

          // Users with multi (IP-based only)
          const usersWithMulti = await prisma.$queryRaw<[{ count: bigint }]>`
            SELECT COUNT(DISTINCT "userId") as count
            FROM "UserActivityLog"
            WHERE "ipAddress" IN (
              SELECT "ipAddress"
              FROM "UserActivityLog"
              WHERE "ipAddress" IS NOT NULL
              GROUP BY "ipAddress"
              HAVING COUNT(DISTINCT "userId") > 1
            )
          `

          return {
            totalDuplicateIPs: Number(duplicateIPCount[0]?.count || 0),
            usersWithMulti: Number(usersWithMulti[0]?.count || 0)
          }
        },
        { ttl: 300 }
      )

      result.stats = stats
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('❌ Multi detection error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
