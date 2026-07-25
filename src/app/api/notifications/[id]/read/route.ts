import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(request)
    const { id } = await params

    // Sadece kendi bildirimini okundu işaretleyebilsin diye userId de şarta ekleniyor.
    await prisma.notification.updateMany({
      where: { id, userId: session.userId },
      data: { isRead: true },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Oturum geçersiz' }, { status: 401 })
    }
    console.error('Notification read error:', error)
    return NextResponse.json({ error: 'Güncellenemedi' }, { status: 500 })
  }
}
