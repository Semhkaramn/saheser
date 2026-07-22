import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { requireAuth } from '@/lib/auth'
import { getTurkeyDate } from '@/lib/utils'
import { logPurchase, extractRequestInfo } from '@/lib/services/activity-log-service'
import { notifyPurchaseApprovalGroup } from '@/lib/telegram/services/purchase-approval-service'

export async function POST(request: NextRequest) {
  try {
    // Session kontrolü - artık body'den userId yerine session kullanıyoruz
    const session = await requireAuth(request)
    const userId = session.userId

    const body = await request.json()
    const { itemId, walletAddress, sponsorInfo } = body

    if (!itemId) {
      return NextResponse.json(
        { error: 'Item ID required' },
        { status: 400 }
      )
    }

    // Kullanıcı ve ürünü getir
    const [user, item] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        include: { sponsorInfos: true }
      }),
      prisma.shopItem.findUnique({
        where: { id: itemId },
        include: { sponsor: true }
      })
    ])

    if (!user || !item) {
      return NextResponse.json(
        { error: 'User or item not found' },
        { status: 404 }
      )
    }

    // Telegram ve email doğrulama kontrolü
    if (!user.telegramId || !user.emailVerified) {
      return NextResponse.json(
        {
          error: 'Ürün satın almak için Telegram bağlantısı ve email doğrulaması gereklidir',
          requiresVerification: true,
          needsTelegram: !user.telegramId,
          needsEmail: !user.emailVerified
        },
        { status: 403 }
      )
    }

    if (!item.isActive) {
      return NextResponse.json(
        { error: 'Item is not available' },
        { status: 400 }
      )
    }

    // Nakit kategorisi kontrolü
    if (item.category === 'Nakit') {
      if (!walletAddress && !user.trc20WalletAddress) {
        return NextResponse.json(
          { error: 'Nakit kategorisindeki ürünler için TRC20 cüzdan adresi gereklidir. Lütfen profilinizden cüzdan adresinizi ekleyin.' },
          { status: 400 }
        )
      }
    }

    // Sponsor kategorisi kontrolü
    if (item.category === 'Sponsor' && item.sponsorId) {
      const existingInfo = user.sponsorInfos.find((info: { sponsorId: string }) => info.sponsorId === item.sponsorId)
      const userHasSponsorInfo = !!existingInfo

      if (!sponsorInfo && !userHasSponsorInfo) {
        return NextResponse.json(
          {
            error: 'Bu ürün için sponsor bilgisi gereklidir. Lütfen sponsor bilginizi ekleyin.',
            requiresSponsorInfo: true,
            sponsorId: item.sponsorId,
            sponsorName: item.sponsor?.name,
            identifierType: item.sponsor?.identifierType
          },
          { status: 400 }
        )
      }

      // ✅ FIX: Eskiden bu kontrol SADECE istek gövdesinde "sponsorInfo" YOKSA
      // çalışıyordu ("!sponsorInfo" şartı) - yani kullanıcının onaylanmamış
      // (örn. "yatırım sonrası") kayıtlı bilgisi varken form bunu tekrar
      // gönderse bile ("sponsorInfo" dolu geldiği için) onay kontrolü tamamen
      // atlanıyordu. Artık istekte ne gönderildiğine bakmadan, GERÇEK
      // onay durumunu her zaman kontrol ediyoruz. Yeni/farklı bir bilgi
      // gönderiliyorsa (henüz incelenmediği için) o da onaylı sayılmaz.
      if (item.requireApprovedSponsor) {
        const isSubmittingNewInfo = !!sponsorInfo && sponsorInfo !== existingInfo?.identifier
        const effectiveStatus = isSubmittingNewInfo ? 'pending' : existingInfo?.status

        if (effectiveStatus !== 'approved') {
          const statusText =
            effectiveStatus === 'pending' || isSubmittingNewInfo
              ? 'henüz onaylanmadı'
              : 'onaylanmadı, lütfen kontrol edip tekrar gönderin'
          return NextResponse.json(
            { error: `Sponsor bilginiz ${statusText}`, sponsorApprovalStatus: effectiveStatus || 'pending' },
            { status: 400 }
          )
        }
      }
    }

    // Temel kontroller (transaction dışında - hızlı fail)
    if (user.points < item.price) {
      return NextResponse.json(
        { error: 'Insufficient points' },
        { status: 400 }
      )
    }

    // ⚠️ CRITICAL: Stock ve purchase limit kontrolleri transaction içine taşındı
    // Race condition önlemek için

    // Transaction ile satın alma işlemi
    const turkeyNow = getTurkeyDate()
    let purchaseResult: { purchaseId: string; finalWalletAddress: string | null; finalSponsorInfo: string | null } | null = null

    try {
      purchaseResult = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // ✅ RACE CONDITION FIX: Transaction içinde fresh data ile kontrol et

        // Ürünü tekrar çek (güncel stok bilgisi için)
        const currentItem = await tx.shopItem.findUnique({
          where: { id: itemId }
        })

        if (!currentItem) {
          throw new Error('Item not found')
        }

        // Stok kontrolü (transaction içinde - güvenli)
        if (currentItem.stock !== null && currentItem.stock <= 0) {
          throw new Error('Item out of stock')
        }

        // Purchase limit kontrolü (transaction içinde - güvenli)
        if (currentItem.purchaseLimit !== null) {
          const purchaseCount = await tx.userPurchase.count({
            where: {
              userId,
              itemId
            }
          })

          if (purchaseCount >= currentItem.purchaseLimit) {
            throw new Error(`Bu ürünü en fazla ${currentItem.purchaseLimit} kez satın alabilirsiniz`)
          }
        }

        // Kullanıcı puanını düş
        await tx.user.update({
          where: { id: userId },
          data: { points: { decrement: item.price } }
        })

        // Stok varsa düş
        if (currentItem.stock !== null) {
          await tx.shopItem.update({
            where: { id: itemId },
            data: { stock: { decrement: 1 } }
          })
        }

        // Cüzdan adresini belirle (parametre olarak gelmediyse kullanıcının kaydedilmiş adresini kullan)
        const finalWalletAddress = item.category === 'Nakit'
          ? (walletAddress || user.trc20WalletAddress)
          : null

        // Sponsor bilgisini belirle
        let finalSponsorInfo = null
        if (item.category === 'Sponsor' && item.sponsorId) {
          if (sponsorInfo) {
            finalSponsorInfo = sponsorInfo
          } else {
            const userSponsorInfo = user.sponsorInfos.find(
              info => info.sponsorId === item.sponsorId
            )
            finalSponsorInfo = userSponsorInfo?.identifier || null
          }
        }

        // Satın alma kaydı oluştur - Türkiye saati ile
        const purchase = await tx.userPurchase.create({
          data: {
            userId,
            itemId,
            pointsSpent: item.price,
            walletAddress: finalWalletAddress,
            sponsorInfo: finalSponsorInfo,
            purchasedAt: turkeyNow
          }
        })

        // Puan geçmişi kaydı oluştur - Türkiye saati ile
        await tx.pointHistory.create({
          data: {
            userId,
            amount: -item.price,
            type: 'shop_purchase',
            description: `${item.name} satın alındı`,
            relatedId: purchase.id,
            createdAt: turkeyNow
          }
        })

        return {
          purchaseId: purchase.id,
          finalWalletAddress,
          finalSponsorInfo
        }
      })
    } catch (error) {
      // Transaction hataları yakala
      if (error instanceof Error) {
        if (error.message === 'Item out of stock') {
          return NextResponse.json(
            { error: 'Ürün stoğu tükendi' },
            { status: 400 }
          )
        }
        if (error.message.includes('en fazla')) {
          return NextResponse.json(
            { error: error.message },
            { status: 400 }
          )
        }
      }
      throw error
    }

    // Activity log
    if (purchaseResult) {
      const requestInfo = extractRequestInfo(request)
      await logPurchase(
        userId,
        purchaseResult.purchaseId,
        item.name,
        item.price,
        item.category,
        purchaseResult.finalWalletAddress,
        purchaseResult.finalSponsorInfo,
        requestInfo
      )

      // Bot üzerinden onay bildirimi (sponsor grubuna ya da genel onay grubuna)
      // ✅ FIX: await edilmiyordu, serverless'ta bazen tamamlanmadan iptal
      // ediliyordu ("bazen atmıyor/geç atıyor" sorununun sebebi)
      try {
        await notifyPurchaseApprovalGroup(purchaseResult.purchaseId)
      } catch (err) {
        console.error('Purchase approval notify error:', err)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Oturum geçersiz. Lütfen tekrar giriş yapın.' },
        { status: 401 }
      )
    }
    console.error('Purchase error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
