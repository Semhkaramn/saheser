import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    // Session kontrolü
    const session = await requireAuth(request)

    // Satın alımları getir
    const purchases = await prisma.userPurchase.findMany({
      where: { userId: session.userId },
      include: {
        item: {
          select: {
            name: true,
            imageUrl: true,
          }
        }
      },
      orderBy: { purchasedAt: 'desc' },
      take: 50
    })

    // Çark çevirme geçmişini getir
    const wheelSpins = await prisma.wheelSpin.findMany({
      where: { userId: session.userId },
      include: {
        prize: {
          select: {
            name: true,
          }
        }
      },
      orderBy: { spunAt: 'desc' },
      take: 50
    })

    return NextResponse.json({
      purchases,
      wheelSpins
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Oturum geçersiz. Lütfen tekrar giriş yapın.' },
        { status: 401 }
      )
    }

    console.error('Error fetching user purchases:', error)
    return NextResponse.json(
      { error: 'Veriler alınamadı' },
      { status: 500 }
    )
  }
}
