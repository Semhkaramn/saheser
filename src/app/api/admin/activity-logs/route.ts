import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/admin-middleware'

// Action type'lara göre icon ve renk mapping'i
const actionTypeMapping: Record<string, { icon: string; color: string; label: string }> = {
  'wallet_add': { icon: 'wallet', color: 'emerald', label: 'Cüzdan Ekleme' },
  'wallet_update': { icon: 'wallet', color: 'blue', label: 'Cüzdan Güncelleme' },
  'wallet_delete': { icon: 'wallet', color: 'rose', label: 'Cüzdan Silme' },
  'sponsor_add': { icon: 'sponsor', color: 'purple', label: 'Sponsor Ekleme' },
  'sponsor_update': { icon: 'sponsor', color: 'blue', label: 'Sponsor Güncelleme' },
  'sponsor_delete': { icon: 'sponsor', color: 'rose', label: 'Sponsor Silme' },
  'event_join': { icon: 'calendar', color: 'blue', label: 'Etkinlik Katılım' },
  'event_win': { icon: 'trophy', color: 'amber', label: 'Etkinlik Kazanma' },
  'ticket_request': { icon: 'ticket', color: 'amber', label: 'Bilet Talebi' },
  'ticket_approved': { icon: 'ticket', color: 'emerald', label: 'Bilet Onay' },
  'ticket_rejected': { icon: 'ticket', color: 'rose', label: 'Bilet Red' },
  'wheel_spin': { icon: 'wheel', color: 'orange', label: 'Çark Çevirme' },
  'task_complete': { icon: 'task', color: 'cyan', label: 'Görev Tamamlama' },
  'purchase': { icon: 'shopping', color: 'emerald', label: 'Satın Alma' },
  'promocode_use': { icon: 'promocode', color: 'amber', label: 'Promocode' },
  'telegram_link': { icon: 'telegram', color: 'blue', label: 'Telegram Bağlantı' },
  'telegram_unlink': { icon: 'telegram', color: 'rose', label: 'Telegram Koparma' },
  'register': { icon: 'user', color: 'emerald', label: 'Kayıt' },
  'login': { icon: 'user', color: 'blue', label: 'Giriş' },
  'password_change': { icon: 'admin', color: 'blue', label: 'Şifre Değişikliği' },
  'avatar_change': { icon: 'user', color: 'purple', label: 'Avatar Değişikliği' },
  'admin_points_add': { icon: 'admin', color: 'emerald', label: 'Admin Puan Ekleme' },
  'admin_points_remove': { icon: 'admin', color: 'rose', label: 'Admin Puan Çıkarma' },
  'admin_ban': { icon: 'admin', color: 'rose', label: 'Ban' },
  'admin_unban': { icon: 'admin', color: 'emerald', label: 'Ban Kaldırma' },
  'randy_win': { icon: 'randy', color: 'amber', label: 'Randy Kazanma' },
  'rank_up': { icon: 'trophy', color: 'purple', label: 'Rütbe Yükselme' },
}

export async function GET(request: NextRequest) {
  try {
    const authCheck = await requirePermission(request, 'canAccessActivityLogs')
    if (authCheck.error) return authCheck.error

    const { searchParams } = new URL(request.url)

    // Pagination
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const skip = (page - 1) * limit

    // Filters
    const actionType = searchParams.get('actionType') || ''
    const userId = searchParams.get('userId') || ''
    const search = searchParams.get('search') || ''
    const startDate = searchParams.get('startDate') || ''
    const endDate = searchParams.get('endDate') || ''
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    // Arama varsa önce eşleşen kullanıcıları bul
    let matchingUserIds: string[] = []
    if (search) {
      const matchingUsers = await prisma.user.findMany({
        where: {
          OR: [
            { siteUsername: { contains: search, mode: 'insensitive' } },
            { telegramUsername: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { telegramId: { contains: search, mode: 'insensitive' } }
          ]
        },
        select: { id: true }
      })
      matchingUserIds = matchingUsers.map(u => u.id)
    }

    // Build where clause for UserActivityLog
    const where: any = {}

    if (actionType && actionType !== 'all') {
      where.actionType = actionType
    }

    if (userId) {
      where.userId = userId
    }

    // Arama için hem içerik hem kullanıcı bazlı arama yap
    if (search) {
      where.OR = [
        { actionTitle: { contains: search, mode: 'insensitive' } },
        { actionDescription: { contains: search, mode: 'insensitive' } },
        ...(matchingUserIds.length > 0 ? [{ userId: { in: matchingUserIds } }] : [])
      ]
    }

    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) {
        const start = new Date(startDate)
        start.setHours(0, 0, 0, 0)
        where.createdAt.gte = start
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        where.createdAt.lte = end
      }
    }

    const [logs, logCount, actionTypeCounts] = await Promise.all([
      prisma.userActivityLog.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
        select: {
          id: true,
          userId: true,
          actionType: true,
          actionTitle: true,
          actionDescription: true,
          oldValue: true,
          newValue: true,
          relatedId: true,
          relatedType: true,
          metadata: true,
          ipAddress: true,
          createdAt: true
        }
      }),
      prisma.userActivityLog.count({ where }),
      prisma.userActivityLog.groupBy({
        by: ['actionType'],
        _count: { actionType: true }
      })
    ])

    // Get user details for all logs
    const allUserIds = new Set<string>()
    logs.forEach((log: any) => allUserIds.add(log.userId))

    const users = await prisma.user.findMany({
      where: { id: { in: Array.from(allUserIds) } },
      select: {
        id: true,
        siteUsername: true,
        email: true,
        telegramUsername: true,
        firstName: true,
        avatar: true
      }
    })

    const userMap = new Map<string, typeof users[number]>(users.map((u: any) => [u.id, u]))

    // Format logs
    const formattedLogs = logs.map((log: any) => {
      const mapping = actionTypeMapping[log.actionType] || { icon: 'activity', color: 'slate', label: log.actionType }
      const user = userMap.get(log.userId)

      let metadata = null
      try {
        metadata = log.metadata ? JSON.parse(log.metadata) : null
      } catch (e) {
        metadata = null
      }

      return {
        id: log.id,
        userId: log.userId,
        user: user ? {
          siteUsername: user.siteUsername,
          email: user.email,
          telegramUsername: user.telegramUsername,
          firstName: user.firstName,
          avatar: user.avatar
        } : null,
        actionType: log.actionType,
        actionLabel: mapping.label,
        actionTitle: log.actionTitle,
        actionDescription: log.actionDescription,
        icon: mapping.icon,
        color: mapping.color,
        oldValue: log.oldValue,
        newValue: log.newValue,
        relatedId: log.relatedId,
        relatedType: log.relatedType,
        metadata,
        ipAddress: log.ipAddress,
        createdAt: log.createdAt
      }
    })

    const actionTypeStats = actionTypeCounts
      .map((item: any) => ({
        actionType: item.actionType,
        label: actionTypeMapping[item.actionType]?.label || item.actionType,
        count: item._count.actionType
      }))
      .sort((a, b) => b.count - a.count)

    return NextResponse.json({
      logs: formattedLogs,
      pagination: {
        page,
        limit,
        totalCount: logCount,
        totalPages: Math.ceil(logCount / limit)
      },
      actionTypeStats,
      actionTypeMapping
    })
  } catch (error) {
    console.error('Activity logs error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
