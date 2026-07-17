import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: any = {}
    if (status && status !== 'all') {
      where.status = status
    }

    const skip = (page - 1) * limit

    // 🚀 OPTIMIZATION: Pagination to prevent memory issues
    const [orders, total] = await Promise.all([
      prisma.userPurchase.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              siteUsername: true,
              email: true,
              telegramId: true,
              telegramUsername: true,
              firstName: true,
              lastName: true,
              trc20WalletAddress: true
            }
          },
          item: {
            select: {
              id: true,
              name: true,
              description: true,
              price: true,
              imageUrl: true,
              category: true,
              sponsor: {
                select: {
                  id: true,
                  name: true,
                  identifierType: true
                }
              }
            }
          }
        },
        orderBy: {
          purchasedAt: 'desc'
        },
        skip,
        take: limit,
      }),
      prisma.userPurchase.count({ where })
    ])

    return NextResponse.json({
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching orders:', error)
    return NextResponse.json({ error: 'Siparişler yüklenemedi' }, { status: 500 })
  }
}
