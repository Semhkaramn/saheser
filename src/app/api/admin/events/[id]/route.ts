import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, requirePermission } from '@/lib/admin-middleware'
import { invalidateCache } from '@/lib/enhanced-cache'
import { generateUniqueSlug } from '@/lib/slug'

// GET - Etkinlik detayı
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAdmin(request)
  if (authCheck.error) return authCheck.error

  const { id } = await params

  try {
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        sponsor: true,
        participants: {
          include: {
            user: {
              select: {
                id: true,
                siteUsername: true,
                email: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
        winners: {
          include: {
            user: {
              select: {
                id: true,
                siteUsername: true,
                email: true,
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
    })

    if (!event) {
      return NextResponse.json(
        { error: 'Etkinlik bulunamadı' },
        { status: 404 }
      )
    }

    // Winners için sponsor bilgisini participants'tan al
    const winnersWithSponsorInfo = await Promise.all(
      event.winners.map(async (winner) => {
        const participant = await prisma.eventParticipant.findUnique({
          where: {
            eventId_userId: {
              eventId: id,
              userId: winner.userId,
            },
          },
        })
        return {
          ...winner,
          sponsorInfo: participant?.sponsorInfo || null,
        }
      })
    )

    const eventWithSponsorInfo = {
      ...event,
      winners: winnersWithSponsorInfo,
    }

    return NextResponse.json({ event: eventWithSponsorInfo })
  } catch (error) {
    console.error('Error fetching event:', error)
    return NextResponse.json(
      { error: 'Etkinlik yüklenirken hata oluştu' },
      { status: 500 }
    )
  }
}

// PUT - Etkinlik güncelle
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requirePermission(request, 'canAccessEvents')
  if (authCheck.error) return authCheck.error

  const { id } = await params

  try {
    const body = await request.json()
    const { title, description, participantLimit, participationType, endDate, status } = body

    const updateData: any = {}
    if (title) {
      updateData.title = title
      const current = await prisma.event.findUnique({ where: { id }, select: { title: true } })
      if (current && current.title !== title) {
        updateData.slug = await generateUniqueSlug(title, async (candidate) => {
          const existing = await prisma.event.findFirst({ where: { slug: candidate, NOT: { id } } })
          return !!existing
        })
      }
    }
    if (description !== undefined) updateData.description = description
    if (participantLimit) updateData.participantLimit = participantLimit
    if (participationType) updateData.participationType = participationType
    // endDate string'i Türkiye saatinde gelir, UTC'ye çevirmek için +03:00 offset ekliyoruz
    if (endDate) updateData.endDate = new Date(endDate + '+03:00')
    if (status) updateData.status = status

    const event = await prisma.event.update({
      where: { id },
      data: updateData,
      include: {
        sponsor: true,
      },
    })

    // ✅ Cache invalidation
    invalidateCache.events()

    return NextResponse.json({ event })
  } catch (error) {
    console.error('Error updating event:', error)
    return NextResponse.json(
      { error: 'Etkinlik güncellenirken hata oluştu' },
      { status: 500 }
    )
  }
}

// DELETE - Etkinlik sil
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requirePermission(request, 'canAccessEvents')
  if (authCheck.error) return authCheck.error

  const { id } = await params

  try {
    await prisma.event.delete({
      where: { id },
    })

    // ✅ Cache invalidation
    invalidateCache.events()

    return NextResponse.json({ message: 'Etkinlik silindi' })
  } catch (error) {
    console.error('Error deleting event:', error)
    return NextResponse.json(
      { error: 'Etkinlik silinirken hata oluştu' },
      { status: 500 }
    )
  }
}
