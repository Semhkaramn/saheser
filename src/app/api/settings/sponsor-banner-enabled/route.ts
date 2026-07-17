import { NextResponse } from 'next/server'
import { getDynamicSettings } from '@/lib/site-config'

// 🚀 OPTIMIZED: Cache revalidation
export const revalidate = 300 // 5 minutes

export async function GET() {
  try {
    // 🚀 OPTIMIZED: Get from dynamic settings (cached)
    const settings = await getDynamicSettings()

    return NextResponse.json(
      {
        enabled: settings.sponsorBannerEnabled ?? true // Default true
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
        }
      }
    )
  } catch (error) {
    console.error('Error fetching sponsor banner setting:', error)
    return NextResponse.json(
      { error: 'Failed to fetch setting' },
      { status: 500 }
    )
  }
}
