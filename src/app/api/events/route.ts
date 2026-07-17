import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { getCachedData, CacheTTL } from '@/lib/enhanced-cache'

// GET - Etkinlikleri listele
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const userOnly = searchParams.get('userOnly') === 'true'
    const eventId = searchParams.get('eventId')

    // 📄 Pagination parameters
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100) // Max 100

    // Kullanıcı kontrolü (opsiyonel)
    const session = await getSession(request)
    const user = session ? await prisma.user.findUnique({ where: { id: session.userId } }) : null

    // Eğer eventId varsa, sadece o etkinliği getir
    if (eventId) {
      const event = await prisma.event.findFirst({
        where: {
          OR: [{ slug: eventId }, { id: eventId }],
          sponsor: { isActive: true },
        },
        select: {
          id: true,
          title: true,
          slug: true,
          description: true,
          imageUrl: true,
          participantLimit: true,
          participationType: true,
          participantCount: true,
          endDate: true,
          status: true,
          createdAt: true,
          sponsor: {
            select: {
              id: true,
              name: true,
              logoUrl: true,
              identifierType: true,
            },
          },
          _count: {
            select: {
              participants: true,
              winners: true,
            },
          },
          participants: user ? {
            where: {
              userId: user.id,
            },
            select: {
              userId: true,
              createdAt: true,
              sponsorInfo: true,
            },
          } : undefined,
          winners: {
            select: {
              id: true,
              status: true,
              statusMessage: true,
              user: {
                select: {
                  id: true,
                  siteUsername: true,
                  email: true,
                },
              },
            },
          },
        },
      })

      if (!event) {
        return NextResponse.json({ events: [] })
      }

      return NextResponse.json({ events: [event] })
    }

    let where: any = { sponsor: { isActive: true } }

    if (userOnly && user) {
      // Kullanıcının katıldığı veya kazandığı etkinlikler
      where.OR = [
        {
          participants: {
            some: {
              userId: user.id,
            },
          },
        },
        {
          winners: {
            some: {
              userId: user.id,
            },
          },
        },
      ]
    }

    // Genel etkinlik listesi - status parametresi varsa filtrele
    if (status) {
      where.status = status
    }

    // 🚀 OPTIMIZATION: Pagination to prevent memory issues under high load
    const [events, totalCount] = await Promise.all([
      prisma.event.findMany({
        where,
        select: {
          id: true,
          title: true,
          slug: true,
          description: true,
          imageUrl: true,
          participantLimit: true,
          participationType: true,
          participantCount: true,
          endDate: true,
          status: true,
          createdAt: true,
          sponsor: {
            select: {
              id: true,
              name: true,
              logoUrl: true,
              identifierType: true,
            },
          },
          _count: {
            select: {
              participants: true,
              winners: true,
            },
          },
          participants: user ? {
            where: {
              userId: user.id,
            },
            select: {
              userId: true,
              createdAt: true,
              sponsorInfo: true,
            },
          } : undefined,
          winners: {
            select: {
              id: true,
              status: true,
              statusMessage: true,
              user: {
                select: {
                  id: true,
                  telegramUsername: true,
                  firstName: true,
                  lastName: true,
                  telegramId: true,
                },
              },
            },
          },
        },
        orderBy: [
          { status: 'asc' },
          { createdAt: 'desc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.event.count({ where })
    ])

    return NextResponse.json({
      events,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching events:', error)
    return NextResponse.json(
      { error: 'Etkinlikler yüklenirken hata oluştu' },
      { status: 500 }
    )
  }
}
