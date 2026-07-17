import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/admin-middleware'
import { getTurkeyDate } from '@/lib/utils'

// ✅ Telegram bağlantısını koparma artık SADECE adminler tarafından
// yapılabilir - kullanıcılar kendi profillerinden bunu yapamıyor.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authCheck = await requirePermission(request, 'canAccessUsers')
  if (authCheck.error) return authCheck.error

  try {
    const { id } = await params
    const user = await prisma.user.findUnique({ where: { id } })

    if (!user || !user.telegramId) {
      return NextResponse.json({ error: 'Telegram hesabı bağlı değil' }, { status: 400 })
    }

    const currentTelegramId = user.telegramId

    await prisma.user.update({
      where: { id },
      data: {
        telegramId: null,
        telegramUsername: null,
        firstName: null,
        lastName: null,
        hasHadFirstTelegramLink: false,
        telegramUnlinkedAt: getTurkeyDate()
      }
    })

    await prisma.telegramGroupUser.updateMany({
      where: { linkedUserId: id },
      data: { linkedUserId: null }
    })

    console.log(`✅ Admin, kullanıcının Telegram bağlantısını kopardı: ${id} (eski telegramId: ${currentTelegramId})`)

    return NextResponse.json({ success: true, message: 'Telegram bağlantısı koparıldı' })
  } catch (error) {
    console.error('Admin telegram disconnect error:', error)
    return NextResponse.json({ error: 'Bir hata oluştu' }, { status: 500 })
  }
}
