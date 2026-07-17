import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/admin-middleware'
import { sendTelegramMessage } from '@/lib/telegram/core'
import { invalidateCache } from '@/lib/enhanced-cache'

// POST - Çekiliş yap
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requirePermission(request, 'canAccessEvents')
  if (authCheck.error) return authCheck.error

  const { id } = await params

  try {
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
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
        },
        winners: true,
      },
    })

    if (!event) {
      return NextResponse.json(
        { error: 'Etkinlik bulunamadı' },
        { status: 404 }
      )
    }

    if (event.status !== 'active') {
      return NextResponse.json(
        { error: 'Sadece aktif etkinliklerde çekiliş yapılabilir' },
        { status: 400 }
      )
    }

    if (event.participationType !== 'raffle') {
      return NextResponse.json(
        { error: 'Bu etkinlik çekiliş tipinde değil' },
        { status: 400 }
      )
    }

    // ✅ Düzeltme: En az 1 katılımcı olması yeterli
    if (event.participants.length === 0) {
      return NextResponse.json(
        { error: 'Çekiliş için en az 1 katılımcı gerekli' },
        { status: 400 }
      )
    }

    if (event.winners.length > 0) {
      return NextResponse.json(
        { error: 'Bu etkinlikte zaten çekiliş yapılmış' },
        { status: 400 }
      )
    }

    // ✅ Düzeltme: Kazanan sayısı = min(participantLimit, katılımcı sayısı)
    // Eğer katılımcı sayısı kazanan sayısından azsa, tüm katılımcılar kazanır
    const winnerCount = Math.min(event.participantLimit, event.participants.length)

    // Rastgele kazananları seç
    const shuffled = [...event.participants].sort(() => 0.5 - Math.random())
    const selectedWinners = shuffled.slice(0, winnerCount)

    // Kazananları kaydet - DURUM PENDING OLARAK (Admin kontrol edecek)
    const winners = await Promise.all(
      selectedWinners.map((participant) =>
        prisma.eventWinner.create({
          data: {
            eventId: event.id,
            userId: participant.userId,
            status: 'pending',
            statusMessage: 'Durum bekleniyor',
          },
          include: {
            user: {
              select: {
                id: true,
                siteUsername: true,
                email: true,
                telegramId: true,
              },
            },
          },
        })
      )
    )

    // ✅ Kazananlara İLK bildirim gönder - "Kazandınız, kontrol ediliyor"
    let messageSentCount = 0
    for (const winner of winners) {
      if (winner.user.telegramId) {
        try {
          const message = `🎉 <b>Tebrikler Kazandınız!</b> 🎉

📌 <b>${event.title}</b>
📅 Tarih: ${new Date(event.createdAt).toLocaleDateString('tr-TR')}

🏆 <b>Sonuç:</b> Ödülünüz kontrol ediliyor.`

          await sendTelegramMessage(winner.user.telegramId, message)

          // Rate limiting: Telegram API 30 msg/sec limit
          await new Promise(resolve => setTimeout(resolve, 50))

          // Mesaj gönderildi olarak işaretle
          await prisma.eventWinner.update({
            where: { id: winner.id },
            data: {
              messageSent: true,
              messageSentAt: new Date(),
            },
          })

          messageSentCount++
        } catch (error) {
          console.error(`Error sending message to user ${winner.userId}:`, error)
        }
      }
    }

    // Etkinliği bekleyen durumuna al
    await prisma.event.update({
      where: { id },
      data: { status: 'pending' },
    })

    // ✅ Cache invalidation
    invalidateCache.events()

    return NextResponse.json({
      winners,
      message: `Çekiliş başarıyla yapıldı. ${winnerCount} kişi kazandı.`,
      messageSentCount,
      totalWinners: winners.length,
      totalParticipants: event.participants.length,
    })
  } catch (error) {
    console.error('Error drawing event:', error)
    return NextResponse.json(
      { error: 'Çekiliş yapılırken hata oluştu' },
      { status: 500 }
    )
  }
}
