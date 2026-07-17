import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTurkeyDate } from '@/lib/utils'
import { notifyOrderStatusChange } from '@/lib/notifications'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { status, deliveryInfo, processedBy } = body

    // Önce mevcut siparişi al
    const existingOrder = await prisma.userPurchase.findUnique({
      where: { id },
      select: {
        status: true,
        pointsSpent: true,
        userId: true
      }
    })

    if (!existingOrder) {
      return NextResponse.json({ error: 'Sipariş bulunamadı' }, { status: 404 })
    }

    const updateData: any = {}

    if (status) {
      updateData.status = status
      updateData.processedAt = getTurkeyDate() // Türkiye saati
    }

    if (deliveryInfo !== undefined) {
      updateData.deliveryInfo = deliveryInfo
    }

    if (processedBy) {
      updateData.processedBy = processedBy
    }

    // Transaction ile güncelleme ve puan iadesi
    const order = await prisma.$transaction(async (tx) => {
      // Sipariş güncelle
      const updatedOrder = await tx.userPurchase.update({
        where: { id },
        data: updateData,
        include: {
          user: {
            select: {
              id: true,
              siteUsername: true,
              email: true,
              telegramId: true,
              telegramUsername: true,
              firstName: true,
              lastName: true,
              points: true
            }
          },
          item: {
            select: {
              id: true,
              name: true,
              description: true,
              price: true,
              imageUrl: true,
              category: true
            }
          }
        }
      })

      // Eğer sipariş iptal edildiyse ve önceden iptal edilmemişse puan iadesi yap
      if (status === 'cancelled' && existingOrder.status !== 'cancelled') {
        await tx.user.update({
          where: { id: existingOrder.userId },
          data: {
            points: {
              increment: existingOrder.pointsSpent
            }
          }
        })

        // Puan geçmişi kaydı oluştur
        await tx.pointHistory.create({
          data: {
            userId: existingOrder.userId,
            amount: existingOrder.pointsSpent,
            type: 'refund',
            description: `Sipariş iptali - ${updatedOrder.item.name}`,
            relatedId: id
          }
        })
      }

      return updatedOrder
    })

    // Sipariş durumu değiştiyse kullanıcıya HEMEN bildirim gönder
    if (status && status !== existingOrder.status && order.user.telegramId) {
      // Bildirim gönder - AWAIT ile bekle ki hemen gönderilsin
      const notificationSent = await notifyOrderStatusChange(
        order.user.id,
        order.user.telegramId,
        {
          itemName: order.item.name,
          pointsSpent: order.pointsSpent,
          status: status,
          deliveryInfo: deliveryInfo
        }
      )

      if (notificationSent) {
        console.log(`✅ Sipariş bildirimi gönderildi: ${order.user.telegramId}`)
      } else {
        console.log(`⚠️ Sipariş bildirimi gönderilemedi: ${order.user.telegramId}`)
      }
    }

    return NextResponse.json({ order })
  } catch (error) {
    console.error('Error updating order:', error)
    return NextResponse.json({ error: 'Sipariş güncellenemedi' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Önce siparişi al
    const order = await prisma.userPurchase.findUnique({
      where: { id },
      select: {
        userId: true,
        pointsSpent: true,
        status: true,
        item: {
          select: {
            name: true
          }
        }
      }
    })

    if (!order) {
      return NextResponse.json({ error: 'Sipariş bulunamadı' }, { status: 404 })
    }

    // Transaction ile silme ve puan iadesi
    await prisma.$transaction(async (tx) => {
      // Siparişi sil
      await tx.userPurchase.delete({
        where: { id }
      })

      // Sadece pending veya processing durumundaysa puan iadesi yap
      // Tamamlanmış (completed) veya iptal edilmiş (cancelled) siparişlerde iade yapma
      if (order.status === 'pending' || order.status === 'processing') {
        await tx.user.update({
          where: { id: order.userId },
          data: {
            points: {
              increment: order.pointsSpent
            }
          }
        })

        // Puan geçmişi kaydı oluştur
        await tx.pointHistory.create({
          data: {
            userId: order.userId,
            amount: order.pointsSpent,
            type: 'refund',
            description: `Sipariş silindi - ${order.item.name}`,
            relatedId: id
          }
        })
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting order:', error)
    return NextResponse.json({ error: 'Sipariş silinemedi' }, { status: 500 })
  }
}
