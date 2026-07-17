import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    // ✅ FIX: sendBeacon Blob veya JSON gelebilir
    let sponsorId: string | undefined

    const contentType = request.headers.get('content-type')

    if (contentType?.includes('application/json')) {
      const body = await request.json()
      sponsorId = body.sponsorId
    } else {
      // Blob olarak geldiyse (sendBeacon)
      const text = await request.text()
      try {
        const parsed = JSON.parse(text)
        sponsorId = parsed.sponsorId
      } catch {
        console.error('❌ Failed to parse request body:', text)
      }
    }

    console.log('📊 Sponsor click tracking:', { sponsorId, contentType })

    if (!sponsorId) {
      console.error('❌ Missing sponsorId')
      return NextResponse.json(
        { error: 'Sponsor ID required' },
        { status: 400 }
      )
    }

    // ✅ FIX: Sponsor var mı kontrol et
    const sponsor = await prisma.sponsor.findUnique({
      where: { id: sponsorId },
      select: { id: true, name: true, clicks: true }
    })

    if (!sponsor) {
      console.error('❌ Sponsor not found:', sponsorId)
      return NextResponse.json(
        { error: 'Sponsor not found' },
        { status: 404 }
      )
    }

    // Tıklama sayısını artır
    const updated = await prisma.sponsor.update({
      where: { id: sponsorId },
      data: { clicks: { increment: 1 } }
    })

    console.log('✅ Click tracked:', {
      sponsor: sponsor.name,
      oldClicks: sponsor.clicks,
      newClicks: updated.clicks
    })

    return NextResponse.json({
      success: true,
      clicks: updated.clicks
    })
  } catch (error) {
    console.error('❌ Track sponsor click error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}
