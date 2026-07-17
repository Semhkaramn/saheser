import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/admin-middleware'
import { z } from 'zod'

// GET - Bir gruba ait tüm Randy'leri listele
export async function GET(request: NextRequest) {
  const authCheck = await requirePermission(request, 'canAccessSettings')
  if (authCheck.error) return authCheck.error

  try {
    const { searchParams } = new URL(request.url)
    const groupId = searchParams.get('groupId')
    if (!groupId) {
      return NextResponse.json({ error: 'groupId gerekli' }, { status: 400 })
    }

    const randys = await prisma.randy.findMany({
      where: { targetGroupId: groupId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { participants: true, winners: true } },
      },
    })

    return NextResponse.json({ randys })
  } catch (error) {
    console.error('Randy list error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Yeni Randy taslağı oluştur (tam ayar seçenekleriyle)
export async function POST(request: NextRequest) {
  const authCheck = await requirePermission(request, 'canAccessSettings')
  if (authCheck.error) return authCheck.error

  try {
    const schema = z.object({
      groupId: z.string().min(1),
      title: z.string().min(1),
      message: z.string().min(1),
      requirementType: z.enum(['none', 'daily', 'weekly', 'monthly', 'all_time', 'post_randy']),
      requiredCount: z.number().int().min(0).optional().default(0),
      winnerCount: z.number().int().min(1),
      pointsReward: z.number().int().min(0).nullable().optional(),
      pinMessage: z.boolean().optional().default(false),
      channels: z.array(z.object({ channelId: z.string(), channelUsername: z.string().optional() })).optional().default([]),
    })

    const data = schema.parse(await request.json())

    // Form'daki tek requirementType seçimini, tamsite şemasındaki
    // requirementType + messageCountPeriod + messageCountRequired + postRandyMessages
    // alanlarına eşle.
    let requirementType = 'none'
    let messageCountPeriod: string | null = null
    let messageCountRequired: number | null = null
    let postRandyMessages: number | null = null

    if (data.requirementType === 'post_randy') {
      requirementType = 'post_randy_messages'
      postRandyMessages = data.requiredCount || 1
    } else if (data.requirementType !== 'none') {
      requirementType = 'message_count'
      messageCountPeriod = data.requirementType
      messageCountRequired = data.requiredCount || 1
    }

    const channelIds = data.channels.map((c) => c.channelId).filter(Boolean)

    const randy = await prisma.randy.create({
      data: {
        title: data.title,
        message: data.message,
        targetGroupId: data.groupId,
        requirementType,
        messageCountPeriod,
        messageCountRequired,
        postRandyMessages,
        requireChannelMembership: channelIds.length > 0,
        membershipCheckChannelIds: channelIds.length > 0 ? channelIds.join(',') : null,
        winnerCount: data.winnerCount,
        prizePoints: data.pointsReward || 0,
        pinMessage: data.pinMessage,
        status: 'draft',
      },
    })

    // randy-web'deki gibi elle eklenen kanalları çapraz ban ağına da kaydet
    // (böylece bir dahaki sefere listeden seçilebilir)
    for (const c of data.channels) {
      if (!c.channelId) continue
      await prisma.crossBanChannel.upsert({
        where: { channelId: c.channelId },
        update: {},
        create: { channelId: c.channelId, username: c.channelUsername || null },
      }).catch(() => {})
    }

    return NextResponse.json({ success: true, randy })
  } catch (error) {
    console.error('Randy create error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Geçersiz veri', details: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Oluşturulamadı' }, { status: 500 })
  }
}
