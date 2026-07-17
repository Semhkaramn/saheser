import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - Otomatik bilet etkinliği kontrolü (Cron job için)
export async function GET(request: NextRequest) {
  try {
    // Güvenlik için basit bir token kontrolü
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || 'default-cron-secret-change-this'

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Yetkisiz erişim' },
        { status: 401 }
      )
    }

    const now = new Date()

    // Süresi dolmuş aktif bilet etkinliklerini bul
    const expiredTicketEvents = await prisma.ticketEvent.findMany({
      where: {
        status: 'active',
        endDate: {
          lte: now, // Bitiş tarihi şimdiden önce veya eşit
        },
      },
      include: {
        prizes: {
          orderBy: { order: 'asc' },
        },
        ticketNumbers: {
          include: {
            user: true,
          },
        },
      },
    })

    const results = []

    for (const event of expiredTicketEvents) {
      try {
        // Bilet satışı olduysa çekiliş yap
        if (event.ticketNumbers.length > 0) {
          // Her ödül için kazananları seç
          for (const prize of event.prizes) {
            const availableTickets = [...event.ticketNumbers]

            // Bu ödül için rastgele kazananları seç
            const winners = []
            for (let i = 0; i < Math.min(prize.winnerCount, availableTickets.length); i++) {
              const randomIndex = Math.floor(Math.random() * availableTickets.length)
              const winner = availableTickets.splice(randomIndex, 1)[0]
              winners.push(winner)

              // Kazananı kaydet
              await prisma.ticketPrizeWinner.create({
                data: {
                  prizeId: prize.id,
                  ticketNumberId: winner.id,
                  userId: winner.userId,
                },
              })
            }
          }

          // Etkinliği completed durumuna al
          await prisma.ticketEvent.update({
            where: { id: event.id },
            data: {
              status: 'completed',
              completedAt: new Date(),
            },
          })

          results.push({
            eventId: event.id,
            title: event.title,
            action: 'raffle_completed',
            ticketsSold: event.ticketNumbers.length,
          })
        } else {
          // Bilet satışı yoksa iptal et
          await prisma.ticketEvent.update({
            where: { id: event.id },
            data: {
              status: 'cancelled',
              completedAt: new Date(),
            },
          })

          results.push({
            eventId: event.id,
            title: event.title,
            action: 'cancelled_no_tickets',
          })
        }
      } catch (error) {
        console.error(`Error processing ticket event ${event.id}:`, error)
        results.push({
          eventId: event.id,
          title: event.title,
          action: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return NextResponse.json({
      success: true,
      processedCount: expiredTicketEvents.length,
      results,
    })
  } catch (error) {
    console.error('Error in ticket auto-check:', error)
    return NextResponse.json(
      { error: 'Otomatik kontrol sırasında hata oluştu' },
      { status: 500 }
    )
  }
}
