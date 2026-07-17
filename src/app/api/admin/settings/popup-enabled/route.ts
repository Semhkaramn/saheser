import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 🚀 DYNAMIC: No cache - popup changes should be immediate
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    // Always fetch fresh from DB for popup status
    const setting = await prisma.settings.findUnique({
      where: { key: 'popup_enabled' }
    })

    return NextResponse.json(
      {
        enabled: setting?.value === 'true'
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
        }
      }
    )
  } catch (error) {
    console.error('Error fetching popup enabled status:', error)
    return NextResponse.json({ enabled: false })
  }
}
