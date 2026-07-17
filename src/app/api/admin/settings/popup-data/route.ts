import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 🚀 DYNAMIC: No cache - popup changes should be immediate
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    // Always fetch fresh from DB for popup data
    const setting = await prisma.settings.findUnique({
      where: { key: 'popup_data' }
    })

    if (!setting?.value) {
      return NextResponse.json(
        { data: null },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
          }
        }
      )
    }

    try {
      const data = JSON.parse(setting.value)
      return NextResponse.json(
        { data },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
          }
        }
      )
    } catch (e) {
      console.error('Error parsing popup data:', e)
      return NextResponse.json({ data: null })
    }
  } catch (error) {
    console.error('Error fetching popup data:', error)
    return NextResponse.json({ data: null })
  }
}
