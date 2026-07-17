import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { requireAuth } from '@/lib/auth'
import { invalidateCache } from '@/lib/enhanced-cache'
import { logEventJoin, extractRequestInfo } from '@/lib/services/activity-log-service'

// POST - Etkinliğe katıl (Race condition korumalı)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(request)
    const userId = session.userId

    const { id: idOrSlug } = await params

    // URL artık slug kullanıyor (örn. /events/yaz-etkinligi) - gerçek id'yi çöz
    const eventLookup = await prisma.event.findFirst({
      where: { OR: [{ slug: idOrSlug }, { id: idOrSlug }] },
      select: { id: true },
    })
    if (!eventLookup) {
      return NextResponse.json({ error: 'Etkinlik bulunamadı' }, { status: 404 })
    }
    const id = eventLookup.id

    // Transaction ile race condition koruması
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Get user
      const user = await tx.user.findUnique({
        where: { id: userId }
      })

      if (!user) {
        throw new Error('USER_NOT_FOUND')
      }

      // Telegram ve email doğrulama kontrolü
      if (!user.telegramId || !user.emailVerified) {
        throw new Error(`VERIFICATION_REQUIRED:${!user.telegramId ? 'telegram' : ''}:${!user.emailVerified ? 'email' : ''}`)
      }

      // Get event with current participant count
      const event = await tx.event.findUnique({
        where: { id },
        include: {
          sponsor: {
            select: {
              id: true,
              name: true,
              identifierType: true,
            },
          },
          _count: {
            select: {
              participants: true,
            },
          },
        },
      })

      if (!event) {
        throw new Error('EVENT_NOT_FOUND')
      }

      if (event.status !== 'active') {
        throw new Error('EVENT_NOT_ACTIVE')
      }

      // Check sponsor info
      const userSponsorInfo = await tx.userSponsorInfo.findUnique({
        where: {
          userId_sponsorId: {
            userId: user.id,
            sponsorId: event.sponsor.id,
          },
        },
      })

      if (!userSponsorInfo) {
        throw new Error(`SPONSOR_INFO_REQUIRED:${event.sponsor.id}`)
      }

      // ✅ "Sadece onaylılar katılabilir" şartı açıksa, sponsor bilgisi
      // sadece GİRİLMİŞ olması yetmez - admin tarafından ONAYLANMIŞ olmalı.
      if (event.requireApprovedSponsor && userSponsorInfo.status !== 'approved') {
        throw new Error(`SPONSOR_APPROVAL_REQUIRED:${userSponsorInfo.status}`)
      }

      // Check if already joined (within transaction to prevent race condition)
      const existingParticipation = await tx.eventParticipant.findUnique({
        where: {
          eventId_userId: {
            eventId: event.id,
            userId: user.id,
          },
        },
      })

      if (existingParticipation) {
        throw new Error('ALREADY_JOINED')
      }

      // Check participant limit - SADECE "limited" (ilk gelenler) tipinde limit kontrolü yap
      // "raffle" (çekiliş) tipinde sınırsız katılım olabilir, participantLimit sadece kazanan sayısıdır
      if (event.participationType === 'limited' && event._count.participants >= event.participantLimit) {
        throw new Error('EVENT_FULL')
      }

      // Create participation
      const participation = await tx.eventParticipant.create({
        data: {
          eventId: event.id,
          userId: user.id,
          sponsorInfo: userSponsorInfo.identifier,
        },
      })

      // Update participant count atomically
      const updatedEvent = await tx.event.update({
        where: { id },
        data: {
          participantCount: {
            increment: 1,
          },
        },
        include: {
          _count: {
            select: {
              participants: true,
            },
          },
        },
      })

      // ✅ "limited" (ilk gelenler) tipinde: Katılan kişi hemen kazandı, EventWinner oluştur
      // NOT: Mesaj gönderimi yapılmaz - mesaj etkinlik sonlandırılıp beklemeye alındığında gönderilir
      let isWinner = false
      if (event.participationType === 'limited') {
        // Kazanan kaydı oluştur (mesaj henüz gönderilmedi - messageSent: false)
        await tx.eventWinner.create({
          data: {
            eventId: event.id,
            userId: user.id,
            status: 'pending',
            statusMessage: 'Durum bekleniyor',
            messageSent: false, // Mesaj etkinlik sonlandırılınca gönderilecek
          },
        })
        isWinner = true

        // Limit dolduğunda etkinliği pending durumuna al
        if (updatedEvent._count.participants >= event.participantLimit) {
          await tx.event.update({
            where: { id },
            data: { status: 'pending' },
          })
        }
      }

      // NOT: "raffle" (çekiliş) tipinde otomatik çekiliş YAPILMAZ
      // Çekiliş sadece bitiş tarihinde (auto-check cron) veya admin tarafından manuel (draw/end endpoint) yapılır
      // participantLimit çekilişte kazanan sayısını belirtir, katılımcı limitini DEĞİL

      return {
        participation,
        isWinner,
        eventTitle: event.title,
        eventType: event.participationType,
        sponsorName: event.sponsor.name,
        sponsorInfo: userSponsorInfo.identifier,
        eventLimitReached: event.participationType === 'limited' && updatedEvent._count.participants >= event.participantLimit,
      }
    })

    // ✅ Cache invalidation
    invalidateCache.events()

    // Activity log
    const requestInfo = extractRequestInfo(request)
    await logEventJoin(
      userId,
      id,
      result.eventTitle,
      result.sponsorName,
      result.sponsorInfo,
      requestInfo
    )

    // ✅ Limited tipinde limit dolduğunda kazananlara mesaj gönder
    if (result.eventLimitReached) {
      // Tüm kazananlara mesaj gönder (henüz mesaj gönderilmemişlere)
      try {
        const winnersToNotify = await prisma.eventWinner.findMany({
          where: {
            event: { id },
            messageSent: false,
          },
          include: {
            user: true,
            event: true,
          },
        })

        for (const winner of winnersToNotify) {
          if (winner.user.telegramId) {
            try {
              const { sendTelegramMessage } = await import('@/lib/telegram/core')
              const message = `🎉 <b>Tebrikler Kazandınız!</b> 🎉

📌 <b>${winner.event.title}</b>
📅 Tarih: ${new Date(winner.event.createdAt).toLocaleDateString('tr-TR')}

🏆 <b>Sonuç:</b> Ödülünüz kontrol ediliyor. Sonuç belirlendikten sonra size bildirim gönderilecektir.`

              await sendTelegramMessage(winner.user.telegramId, message)

              // Rate limiting
              await new Promise(resolve => setTimeout(resolve, 50))

              // Mesaj gönderildi olarak işaretle
              await prisma.eventWinner.update({
                where: { id: winner.id },
                data: {
                  messageSent: true,
                  messageSentAt: new Date(),
                },
              })
            } catch (error) {
              console.error(`Error sending winner message to user ${winner.userId}:`, error)
            }
          }
        }
      } catch (error) {
        console.error('Error sending winner messages:', error)
      }
    }

    if (result.isWinner) {
      return NextResponse.json({
        message: 'Etkinliğe katıldınız ve kazandınız! Tebrikler!',
        participation: result.participation,
        isWinner: true,
      })
    }

    return NextResponse.json({
      message: 'Etkinliğe başarıyla katıldınız',
      participation: result.participation,
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json(
          { error: 'Oturum geçersiz. Lütfen tekrar giriş yapın.' },
          { status: 401 }
        )
      }
      if (error.message === 'USER_NOT_FOUND') {
        return NextResponse.json(
          { error: 'Kullanıcı bulunamadı' },
          { status: 404 }
        )
      }
      if (error.message.startsWith('VERIFICATION_REQUIRED:')) {
        const parts = error.message.split(':')
        return NextResponse.json(
          {
            error: 'Etkinliğe katılmak için Telegram bağlantısı ve email doğrulaması gereklidir',
            requiresVerification: true,
            needsTelegram: parts[1] === 'telegram',
            needsEmail: parts[2] === 'email'
          },
          { status: 403 }
        )
      }
      if (error.message === 'EVENT_NOT_FOUND') {
        return NextResponse.json(
          { error: 'Etkinlik bulunamadı' },
          { status: 404 }
        )
      }
      if (error.message === 'EVENT_NOT_ACTIVE') {
        return NextResponse.json(
          { error: 'Bu etkinliğe artık katılım yapılamaz' },
          { status: 400 }
        )
      }
      if (error.message.startsWith('SPONSOR_INFO_REQUIRED:')) {
        const sponsorId = error.message.split(':')[1]
        return NextResponse.json(
          { error: 'Sponsor bilgisi bulunamadı', needsSponsorInfo: true, sponsorId },
          { status: 400 }
        )
      }
      if (error.message.startsWith('SPONSOR_APPROVAL_REQUIRED:')) {
        const status = error.message.split(':')[1]
        const statusText = status === 'pending' ? 'henüz onaylanmadı' : 'onaylanmadı, lütfen kontrol edip tekrar gönderin'
        return NextResponse.json(
          { error: `Sponsor bilginiz ${statusText}`, sponsorApprovalStatus: status },
          { status: 400 }
        )
      }
      if (error.message === 'ALREADY_JOINED') {
        return NextResponse.json(
          { error: 'Bu etkinliğe zaten katıldınız' },
          { status: 400 }
        )
      }
      if (error.message === 'EVENT_FULL') {
        return NextResponse.json(
          { error: 'Etkinlik katılımcı limiti doldu' },
          { status: 400 }
        )
      }
    }
    console.error('Error joining event:', error)
    return NextResponse.json(
      { error: 'Etkinliğe katılırken hata oluştu' },
      { status: 500 }
    )
  }
}
