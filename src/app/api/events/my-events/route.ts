import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

// GET - Kullanıcının etkinlikleri
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request)
    const userId = session.userId

    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Kullanıcı bulunamadı' },
        { status: 404 }
      )
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'participated', 'won', 'all'

    // Katıldığı etkinlikler (TÜM KAZANANLARLA BİRLİKTE)
    const participatedEvents = type === 'won' ? [] : await prisma.event.findMany({
      where: {
        participants: {
          some: {
            userId: user.id,
          },
        },
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
        participants: {
          where: {
            userId: user.id,
          },
          select: {
            id: true,
            createdAt: true,
            sponsorInfo: true,
          },
        },
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
        _count: {
          select: {
            participants: true,
            winners: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Kazandığı etkinlikler (TÜM KAZANANLARLA BİRLİKTE)
    const wonEvents = type === 'participated' ? [] : await prisma.event.findMany({
      where: {
        winners: {
          some: {
            userId: user.id,
          },
        },
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
        participants: {
          where: {
            userId: user.id,
          },
          select: {
            id: true,
            createdAt: true,
            sponsorInfo: true,
          },
        },
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
        _count: {
          select: {
            participants: true,
            winners: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({
      participatedEvents,
      wonEvents,
    })
  } catch (error) {
    console.error('Error fetching user events:', error)
    return NextResponse.json(
      { error: 'Etkinlikler yüklenirken hata oluştu' },
      { status: 500 }
    )
  }
}
