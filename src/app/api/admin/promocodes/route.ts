import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/admin-middleware'

// GET - Tüm promocode'ları getir
export async function GET(request: NextRequest) {
  const authCheck = await requirePermission(request, 'canAccessPromocodes')
  if (authCheck.error) return authCheck.error

  try {
    const promocodes = await prisma.promocode.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { usages: true }
        }
      }
    })

    return NextResponse.json({ promocodes })
  } catch (error) {
    console.error('Promocode listesi hatası:', error)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}

// POST - Yeni promocode oluştur
export async function POST(request: NextRequest) {
  const authCheck = await requirePermission(request, 'canAccessPromocodes')
  if (authCheck.error) return authCheck.error

  try {
    const body = await request.json()
    const { code, description, points, maxUses, expiresAt } = body

    if (!code || !points || !maxUses) {
      return NextResponse.json({ error: 'Kod, puan ve maksimum kullanım zorunludur' }, { status: 400 })
    }

    // Kod benzersizlik kontrolü
    const existingCode = await prisma.promocode.findUnique({
      where: { code: code.toUpperCase() }
    })

    if (existingCode) {
      return NextResponse.json({ error: 'Bu kod zaten mevcut' }, { status: 400 })
    }

    const promocode = await prisma.promocode.create({
      data: {
        code: code.toUpperCase(),
        description: description || null,
        points: Number(points),
        maxUses: Number(maxUses),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        createdBy: authCheck.admin!.username
      }
    })

    return NextResponse.json({ promocode }, { status: 201 })
  } catch (error) {
    console.error('Promocode oluşturma hatası:', error)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}
