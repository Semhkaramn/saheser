import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logAvatarChange, extractRequestInfo } from '@/lib/services/activity-log-service'

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request)

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, avatar: true }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Kullanıcı bulunamadı' },
        { status: 404 }
      )
    }

    const { avatar } = await request.json()

    if (!avatar || typeof avatar !== 'string') {
      return NextResponse.json(
        { error: 'Avatar gerekli' },
        { status: 400 }
      )
    }

    // Validate avatar path
    const validAvatars = Array.from({ length: 10 }, (_, i) => `/avatar/${i + 1}.svg`)
    if (!validAvatars.includes(avatar)) {
      return NextResponse.json(
        { error: 'Geçersiz avatar' },
        { status: 400 }
      )
    }

    const oldAvatar = user.avatar

    await prisma.user.update({
      where: { id: user.id },
      data: { avatar }
    })

    // Activity log
    const requestInfo = extractRequestInfo(request)
    await logAvatarChange(
      session.userId,
      oldAvatar,
      avatar,
      requestInfo
    )

    return NextResponse.json({ message: 'Avatar güncellendi' })
  } catch (error) {
    console.error('Avatar update error:', error)
    return NextResponse.json(
      { error: 'Avatar güncellenemedi' },
      { status: 500 }
    )
  }
}
