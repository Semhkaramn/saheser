import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''
    const rankName = searchParams.get('rank')
    const minPoints = searchParams.get('minPoints')
    const maxPoints = searchParams.get('maxPoints')
    const minMessages = searchParams.get('minMessages')

    // Build filter conditions for TelegramGroupUser
    // SADECE hadStart: true olanları getir - veritabanı seviyesinde filtrele
    const where: any = {
      hadStart: true  // Sadece botu başlatanları getir
    }

    // Search by username, first name, last name, telegram ID, or site username
    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { telegramId: { contains: search } },
        { linkedUser: { siteUsername: { contains: search, mode: 'insensitive' } } }
      ]
    }

    // Get all telegram users who did /start
    let telegramUsers = await prisma.telegramGroupUser.findMany({
      where,
      include: {
        linkedUser: {
          select: {
            id: true,
            siteUsername: true,
            points: true,
            xp: true,
            isBanned: true,
            rank: {
              select: {
                name: true
              }
            }
          }
        }
      },
      take: 500 // Get more to allow filtering
    })

    // Map to unified format
    let users = telegramUsers.map(tgUser => ({
      id: tgUser.id,
      siteUsername: tgUser.linkedUser?.siteUsername || null,
      username: tgUser.username,
      telegramId: tgUser.telegramId,
      firstName: tgUser.firstName,
      lastName: tgUser.lastName,
      points: tgUser.linkedUser?.points || 0,
      xp: tgUser.linkedUser?.xp || 0,
      messageCount: tgUser.messageCount,
      rank: tgUser.linkedUser?.rank || null,
      isBanned: tgUser.linkedUser?.isBanned || false,
      hadStart: tgUser.hadStart || false // Sadece TelegramGroupUser'dan kontrol et
    }))

    // SADECE HADSTART YAPANLARI FİLTRELE (telegram veya site)
    users = users.filter(u => u.hadStart)

    // Filter by banned status (only non-banned)
    users = users.filter(u => !u.isBanned)

    // Filter by rank
    if (rankName && rankName !== 'all') {
      users = users.filter(u => u.rank?.name === rankName)
    }

    // Filter by points
    if (minPoints) {
      users = users.filter(u => u.points >= parseInt(minPoints))
    }
    if (maxPoints) {
      users = users.filter(u => u.points <= parseInt(maxPoints))
    }

    // Filter by message count
    if (minMessages) {
      users = users.filter(u => u.messageCount >= parseInt(minMessages))
    }

    // Sort by points and xp
    users.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      return b.xp - a.xp
    })

    // Limit to 100
    users = users.slice(0, 100)

    return NextResponse.json({
      success: true,
      users
    })
  } catch (error) {
    console.error('Error searching users:', error)
    return NextResponse.json({
      success: false,
      error: 'Kullanıcılar aranırken hata oluştu'
    }, { status: 500 })
  }
}
