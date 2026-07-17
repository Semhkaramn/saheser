import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const setting = await prisma.settings.findUnique({
      where: { key: 'yatay_banner_data' }
    })

    if (!setting?.value) {
      return NextResponse.json({
        enabled: false,
        imageUrl: '',
        mobileImageUrl: '',
        sponsorId: '',
        sponsor: null
      })
    }

    const bannerData = JSON.parse(setting.value)

    // Sponsor bilgisini al
    let sponsor = null
    if (bannerData.sponsorId) {
      sponsor = await prisma.sponsor.findUnique({
        where: { id: bannerData.sponsorId },
        select: {
          id: true,
          name: true,
          websiteUrl: true
        }
      })
    }

    return NextResponse.json({
      enabled: bannerData.enabled || false,
      imageUrl: bannerData.imageUrl || '',
      mobileImageUrl: bannerData.mobileImageUrl || '',
      sponsorId: bannerData.sponsorId || '',
      sponsor
    })
  } catch (error) {
    console.error('Error fetching yatay banner:', error)
    return NextResponse.json({
      enabled: false,
      imageUrl: '',
      sponsorId: '',
      sponsor: null
    })
  }
}
