import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/admin-middleware'
import { sendTelegramMessage } from '@/lib/telegram/core'
import { buildUserNotifyText, type EntryStatus } from '@/lib/telegram/services/sponsor-approval-service'

const VALID_STATUSES = ['approved', 'rejected', 'pending', 'post_deposit', 'incorrect']

interface BulkUpdate {
  id: string
  status: string
}

// Sponsorlar > Kullanıcı Verileri sayfasından toplu onay/red/vs - admin
// birden fazla satırda durum seçip tek "Kaydet" ile hepsini burada işler,
// her biri için tek tek PATCH atmak yerine tek istek.
export async function PATCH(request: NextRequest) {
  const authCheck = await requirePermission(request, 'canAccessSponsors')
  if (authCheck.error) return authCheck.error

  try {
    const body = await request.json()
    const updates: BulkUpdate[] = Array.isArray(body?.updates) ? body.updates : []

    const validUpdates = updates.filter(
      (u) => u && typeof u.id === 'string' && VALID_STATUSES.includes(u.status)
    )

    if (validUpdates.length === 0) {
      return NextResponse.json({ error: 'Geçerli güncelleme bulunamadı' }, { status: 400 })
    }

    let updated = 0
    const errors: string[] = []

    for (const { id, status } of validUpdates) {
      try {
        const info = await prisma.userSponsorInfo.update({
          where: { id },
          data: { status },
          include: { sponsor: true, user: { select: { telegramId: true } } },
        })

        updated++

        // Web panelinden toplu onay/red verildiğinde de kullanıcıya Telegram
        // üzerinden bildirim gönder - bot DM'inden onaylanmışla aynı davranış.
        if (info.user.telegramId && status !== 'pending') {
          try {
            const text = await buildUserNotifyText(info.sponsor.name, status as EntryStatus)
            await sendTelegramMessage(info.user.telegramId, text)
          } catch (err) {
            console.error(`Bildirim gönderilemedi (id=${id}):`, err)
          }
        }
      } catch (err) {
        console.error(`Toplu güncelleme hatası (id=${id}):`, err)
        errors.push(id)
      }
    }

    return NextResponse.json({ success: true, updated, failed: errors })
  } catch (error) {
    console.error('Admin sponsor-info bulk update error:', error)
    return NextResponse.json({ error: 'Bir hata oluştu' }, { status: 500 })
  }
}
