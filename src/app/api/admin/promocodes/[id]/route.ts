import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/admin-middleware'

// GET - Tek promocode detayları
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requirePermission(request, 'canAccessPromocodes')
  if (authCheck.error) return authCheck.error

  try {
    const { id } = await params

    const promocode = await prisma.promocode.findUnique({
      where: { id },
      include: {
        usages: {
          orderBy: { usedAt: 'desc' },
          take: 100,
          select: {
            id: true,
            userId: true,
            pointsEarned: true,
            usedAt: true
          }
        },
        _count: {
          select: { usages: true }
        }
      }
    })

    if (!promocode) {
      return NextResponse.json({ error: 'Promocode bulunamadı' }, { status: 404 })
    }

    // Kullanıcı bilgilerini al
    const userIds = promocode.usages.map(u => u.userId)
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        siteUsername: true,
        email: true,
        telegramUsername: true,
        firstName: true
      }
    })

    const userMap = new Map(users.map(u => [u.id, u]))
    const usagesWithUsers = promocode.usages.map(usage => ({
      ...usage,
      user: userMap.get(usage.userId) || null
    }))

    return NextResponse.json({
      promocode: {
        ...promocode,
        usages: usagesWithUsers
      }
    })
  } catch (error) {
    console.error('Promocode detay hatası:', error)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}

// PUT - Promocode güncelle
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requirePermission(request, 'canAccessPromocodes')
  if (authCheck.error) return authCheck.error

  try {
    const { id } = await params
    const body = await request.json()
    const { code, description, points, maxUses, expiresAt, isActive } = body

    // Promocode kontrolü
    const existing = await prisma.promocode.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Promocode bulunamadı' }, { status: 404 })
    }

    // Kod değiştirildiyse benzersizlik kontrolü
    if (code && code.toUpperCase() !== existing.code) {
      const codeExists = await prisma.promocode.findUnique({
        where: { code: code.toUpperCase() }
      })
      if (codeExists) {
        return NextResponse.json({ error: 'Bu kod zaten mevcut' }, { status: 400 })
      }
    }

    const promocode = await prisma.promocode.update({
      where: { id },
      data: {
        code: code ? code.toUpperCase() : undefined,
        description: description !== undefined ? description : undefined,
        points: points !== undefined ? Number(points) : undefined,
        maxUses: maxUses !== undefined ? Number(maxUses) : undefined,
        expiresAt: expiresAt !== undefined ? (expiresAt ? new Date(expiresAt) : null) : undefined,
        isActive: isActive !== undefined ? isActive : undefined
      }
    })

    return NextResponse.json({ promocode })
  } catch (error) {
    console.error('Promocode güncelleme hatası:', error)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}

// DELETE - Promocode sil
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requirePermission(request, 'canAccessPromocodes')
  if (authCheck.error) return authCheck.error

  try {
    const { id } = await params

    await prisma.promocode.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Promocode silme hatası:', error)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}
