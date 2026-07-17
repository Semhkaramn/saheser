import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params

    // Satın alımları getir
    const purchases = await prisma.userPurchase.findMany({
      where: { userId },
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
      where: { userId },
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
    console.error('Error fetching user purchases:', error)
    return NextResponse.json(
      { error: 'Veriler alınamadı' },
      { status: 500 }
    )
  }
}
