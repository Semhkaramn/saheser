import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { logPromocodeUse, extractRequestInfo } from '@/lib/services/activity-log-service'

// Rate limiting için basit in-memory cache
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_WINDOW = 60000 // 1 dakika
const MAX_ATTEMPTS = 5 // Dakikada maksimum deneme

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const userLimit = rateLimitMap.get(userId)

  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    return true
  }

  if (userLimit.count >= MAX_ATTEMPTS) {
    return false
  }

  userLimit.count++
  return true
}

// POST - Promocode kullan
export async function POST(request: NextRequest) {
  try {
    // Kullanıcı doğrulama
    const cookieStore = await cookies()
    const token = cookieStore.get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Giriş yapmanız gerekiyor' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Geçersiz oturum' }, { status: 401 })
    }

    const userId = payload.userId

    // Rate limit kontrolü
    if (!checkRateLimit(userId)) {
      return NextResponse.json(
        { error: 'Çok fazla deneme yaptınız. Lütfen 1 dakika bekleyin.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { code } = body

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Geçersiz kod' }, { status: 400 })
    }

    const normalizedCode = code.toUpperCase().trim()

    // Promocode'u bul
    const promocode = await prisma.promocode.findUnique({
      where: { code: normalizedCode }
    })

    if (!promocode) {
      return NextResponse.json({ error: 'Geçersiz promocode' }, { status: 404 })
    }

    // Aktiflik kontrolü
    if (!promocode.isActive) {
      return NextResponse.json({ error: 'Bu promocode artık aktif değil' }, { status: 400 })
    }

    // Süre kontrolü
    if (promocode.expiresAt && new Date() > promocode.expiresAt) {
      return NextResponse.json({ error: 'Bu promocode süresi dolmuş' }, { status: 400 })
    }

    // Kullanım limiti kontrolü
    if (promocode.usedCount >= promocode.maxUses) {
      return NextResponse.json({ error: 'Bu promocode kullanım limitine ulaşmış' }, { status: 400 })
    }

    // Kullanıcının daha önce kullanıp kullanmadığını kontrol et
    const existingUsage = await prisma.promocodeUsage.findUnique({
      where: {
        promocodeId_userId: {
          promocodeId: promocode.id,
          userId: userId
        }
      }
    })

    if (existingUsage) {
      return NextResponse.json({ error: 'Bu promocode\'u zaten kullandınız' }, { status: 400 })
    }

    // Transaction ile atomik işlem - race condition koruması
    const result = await prisma.$transaction(async (tx) => {
      // Promocode'u tekrar kontrol et ve kilitle
      const freshPromocode = await tx.promocode.findUnique({
        where: { code: normalizedCode }
      })

      if (!freshPromocode || !freshPromocode.isActive) {
        throw new Error('Promocode artık mevcut değil')
      }

      if (freshPromocode.usedCount >= freshPromocode.maxUses) {
        throw new Error('Kullanım limitine ulaşıldı')
      }

      // Kullanım kaydı oluştur
      const usage = await tx.promocodeUsage.create({
        data: {
          promocodeId: promocode.id,
          userId: userId,
          pointsEarned: promocode.points
        }
      })

      // Promocode kullanım sayısını artır
      await tx.promocode.update({
        where: { id: promocode.id },
        data: { usedCount: { increment: 1 } }
      })

      // Kullanıcının puanını artır
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { points: { increment: promocode.points } }
      })

      // Puan geçmişine kaydet
      await tx.pointHistory.create({
        data: {
          userId: userId,
          amount: promocode.points,
          type: 'promocode',
          description: `Promocode kullanımı: ${normalizedCode}`,
          relatedId: usage.id
        }
      })

      return {
        pointsEarned: promocode.points,
        newBalance: updatedUser.points,
        usageId: usage.id
      }
    })

    // Activity log
    const requestInfo = extractRequestInfo(request)
    await logPromocodeUse(
      userId,
      promocode.id,
      normalizedCode,
      result.pointsEarned,
      requestInfo
    )

    return NextResponse.json({
      success: true,
      message: `Tebrikler! ${result.pointsEarned} puan kazandınız!`,
      pointsEarned: result.pointsEarned,
      newBalance: result.newBalance
    })
  } catch (error: any) {
    console.error('Promocode kullanım hatası:', error)

    // Transaction hatalarını yakala
    if (error.message === 'Kullanım limitine ulaşıldı') {
      return NextResponse.json({ error: 'Bu promocode kullanım limitine ulaşmış' }, { status: 400 })
    }

    if (error.message === 'Promocode artık mevcut değil') {
      return NextResponse.json({ error: 'Promocode artık mevcut değil' }, { status: 400 })
    }

    // Unique constraint hatası (aynı anda iki kez kullanmaya çalışırsa)
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Bu promocode\'u zaten kullandınız' }, { status: 400 })
    }

    return NextResponse.json({ error: 'Bir hata oluştu' }, { status: 500 })
  }
}
