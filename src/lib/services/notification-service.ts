import { prisma } from '@/lib/prisma'

export type NotificationType =
  | 'purchase_approved'
  | 'purchase_rejected'
  | 'randy_won'
  | 'rank_up'
  | 'referral_bonus'
  | 'task_completed'
  | 'sponsor_approved'
  | 'sponsor_rejected'

/**
 * Kullanıcıya site içi bir bildirim oluşturur. Telegram DM'in yerini almıyor,
 * ona EK olarak - kullanıcı siteye girdiğinde de aynı bilgiyi görebilsin diye.
 * Hata olursa (bildirim oluşturulamazsa) çağıran akışı ASLA bozmamalı - bu
 * yüzden hataları burada yutuyoruz.
 */
export async function createNotification(params: {
  userId: string
  type: NotificationType
  title: string
  message: string
  relatedId?: string
  linkUrl?: string
}): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        relatedId: params.relatedId,
        linkUrl: params.linkUrl,
      },
    })
  } catch (error) {
    console.error('❌ Bildirim oluşturulamadı:', error)
  }
}
