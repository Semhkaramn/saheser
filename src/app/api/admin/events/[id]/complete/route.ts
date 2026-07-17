import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/admin-middleware'
import { sendTelegramMessage } from '@/lib/telegram/core'
import { invalidateCache } from '@/lib/enhanced-cache'

// POST - Etkinliği tamamla ve kazananlara SONUÇ mesajı gönder
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requirePermission(request, 'canAccessEvents')
  if (authCheck.error) return authCheck.error

  const { id } = await params

  try {
    const body = await request.json()
    const { winnerStatuses } = body // { userId: { status, statusMessage } }

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        winners: {
          include: {
            user: true,
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

    if (event.status === 'completed') {
      return NextResponse.json(
        { error: 'Bu etkinlik zaten tamamlanmış' },
        { status: 400 }
      )
    }

    // Kazanan durumlarını güncelle
    if (winnerStatuses) {
      for (const [userId, statusData] of Object.entries(winnerStatuses)) {
        const data = statusData as { status: string; statusMessage: string }
        await prisma.eventWinner.updateMany({
          where: {
            eventId: event.id,
            userId: userId,
          },
          data: {
            status: data.status,
            statusMessage: data.statusMessage,
          },
        })
      }
    }

    // Güncellenmiş kazananları al
    const updatedWinners = await prisma.eventWinner.findMany({
      where: { eventId: event.id },
      include: {
        user: true,
      },
    })

    // Kazananlara SONUÇ Telegram mesajı gönder (resultMessageSent kontrolü)
    let messageSentCount = 0
    for (const winner of updatedWinners) {
      // resultMessageSent kontrolü - sonuç mesajı henüz gönderilmemişse gönder
      if (!winner.resultMessageSent && winner.user.telegramId) {
        try {
          const message = `🎉 <b>Etkinlik Sonucu</b> 🎉

📌 <b>${event.title}</b>
📅 Tarih: ${new Date(event.createdAt).toLocaleDateString('tr-TR')}

🏆 <b>Sonuç:</b> ${winner.statusMessage}`

          await sendTelegramMessage(winner.user.telegramId, message)

          // Rate limiting: Telegram API 30 msg/sec limit
          await new Promise(resolve => setTimeout(resolve, 50))

          // Sonuç mesajı gönderildi olarak işaretle
          await prisma.eventWinner.update({
            where: { id: winner.id },
            data: {
              resultMessageSent: true,
              resultMessageSentAt: new Date(),
            },
          })

          messageSentCount++
        } catch (error) {
          console.error(`Error sending result message to user ${winner.userId}:`, error)
        }
      }
    }

    // Etkinliği tamamla
    await prisma.event.update({
      where: { id },
      data: {
        status: 'completed',
        completedAt: new Date(),
      },
    })

    // ✅ Cache invalidation
    invalidateCache.events()

    return NextResponse.json({
      message: 'Etkinlik tamamlandı',
      messageSentCount,
      totalWinners: updatedWinners.length,
    })
  } catch (error) {
    console.error('Error completing event:', error)
    return NextResponse.json(
      { error: 'Etkinlik tamamlanırken hata oluştu' },
      { status: 500 }
    )
  }
}
