import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const sponsor = await prisma.sponsor.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        logoUrl: true,
        websiteUrl: true,
        category: true,
        isActive: true
      }
    })

    if (!sponsor) {
      return NextResponse.json(
        { error: 'Sponsor bulunamadı' },
        { status: 404 }
      )
    }

    return NextResponse.json({ sponsor })
  } catch (error) {
    console.error('Error fetching sponsor:', error)
    return NextResponse.json(
      { error: 'Sponsor getirilemedi' },
      { status: 500 }
    )
  }
}
