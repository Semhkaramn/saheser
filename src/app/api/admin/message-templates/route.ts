import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/admin-middleware'
import { TEMPLATE_DEFS, invalidateTemplatesCache } from '@/lib/message-templates'

export async function GET(request: NextRequest) {
  const authCheck = await requirePermission(request, 'canAccessSettings')
  if (authCheck.error) return authCheck.error

  try {
    const overrides = await prisma.messageTemplate.findMany()
    const overrideMap = new Map<string, typeof overrides[number]>(overrides.map((o) => [o.key, o]))

    const templates = TEMPLATE_DEFS.map((def) => {
      const override = overrideMap.get(def.key)
      return {
        ...def,
        content: override?.content ?? def.defaultContent,
        isCustomized: Boolean(override),
        updatedAt: override?.updatedAt ?? null,
      }
    })

    return NextResponse.json({ templates })
  } catch (error) {
    console.error('Message templates GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const authCheck = await requirePermission(request, 'canAccessSettings')
  if (authCheck.error) return authCheck.error

  try {
    const { key, content } = await request.json()
    if (!key || typeof content !== 'string') {
      return NextResponse.json({ error: 'key ve content gerekli' }, { status: 400 })
    }

    const def = TEMPLATE_DEFS.find((d) => d.key === key)
    if (!def) {
      return NextResponse.json({ error: 'Bilinmeyen şablon anahtarı' }, { status: 400 })
    }

    await prisma.messageTemplate.upsert({
      where: { key },
      update: { content },
      create: { key, content },
    })
    await invalidateTemplatesCache()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Message templates PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const authCheck = await requirePermission(request, 'canAccessSettings')
  if (authCheck.error) return authCheck.error

  try {
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')
    if (!key) {
      return NextResponse.json({ error: 'key gerekli' }, { status: 400 })
    }

    await prisma.messageTemplate.deleteMany({ where: { key } })
    await invalidateTemplatesCache()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Message templates DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
