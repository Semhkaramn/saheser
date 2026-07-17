import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/admin-middleware'
import { sendTelegramMessage } from '@/lib/telegram/core'
import { buildUserNotifyText, type EntryStatus } from '@/lib/telegram/services/sponsor-approval-service'

const VALID_STATUSES = ['approved', 'rejected', 'pending', 'post_deposit', 'incorrect']

// Admin, kullanıcı detay sayfasından bir sponsor bilgisine doğrudan onay/red
// verebilsin diye - bot DM'inden onay vermenin web eşdeğeri.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authCheck = await requirePermission(request, 'canAccessUsers')
  if (authCheck.error) return authCheck.error

  try {
    const { id } = await params
    const { status } = await request.json()

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Geçersiz durum' }, { status: 400 })
    }

    const info = await prisma.userSponsorInfo.update({
      where: { id },
      data: { status },
      include: { sponsor: true, user: { select: { telegramId: true } } },
    })

    // ✅ Web panelinden onay/red/vs verildiğinde de, tıpkı bot DM'inden
    // verilmiş gibi kullanıcıya Telegram üzerinden bildirim gönder -
    // eskiden bu sadece bot tarafından onaylanınca oluyordu.
    if (info.user.telegramId && status !== 'pending') {
      try {
        const text = await buildUserNotifyText(info.sponsor.name, status as EntryStatus)
        await sendTelegramMessage(info.user.telegramId, text)
      } catch (err) {
        console.error('Sponsor onay bildirimi gönderilemedi:', err)
      }
    }

    return NextResponse.json({ success: true, info })
  } catch (error) {
    console.error('Admin sponsor-info status update error:', error)
    return NextResponse.json({ error: 'Bir hata oluştu' }, { status: 500 })
  }
}
