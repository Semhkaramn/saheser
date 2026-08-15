import { prisma } from '@/lib/prisma'
import { getTurkeyDate } from '@/lib/utils'

export type ActivityActionType =
  | 'wallet_add'
  | 'wallet_update'
  | 'wallet_delete'
  | 'sponsor_add'
  | 'sponsor_update'
  | 'sponsor_delete'
  | 'event_join'
  | 'event_win'
  | 'ticket_request'
  | 'ticket_approved'
  | 'ticket_rejected'
  | 'wheel_spin'
  | 'task_complete'
  | 'purchase'
  | 'promocode_use'
  | 'telegram_link'
  | 'telegram_unlink'
  | 'register'
  | 'login'
  | 'password_change'
  | 'avatar_change'
  | 'admin_points_add'
  | 'admin_points_remove'
  | 'admin_ban'
  | 'admin_unban'
  | 'randy_win'
  | 'rank_up'
  | 'suspicious_activity'
  | 'game_play'

interface LogActivityParams {
  userId: string
  actionType: ActivityActionType
  actionTitle: string
  actionDescription?: string
  oldValue?: string | null
  newValue?: string | null
  relatedId?: string
  relatedType?: string
  metadata?: Record<string, any>
  ipAddress?: string
  userAgent?: string
}

/**
 * Kullanıcı aktivitesi kaydet
 * Bu kayıtlar ASLA silinmez - kalıcı audit log
 */
export async function logActivity(params: LogActivityParams) {
  try {
    const log = await prisma.userActivityLog.create({
      data: {
        userId: params.userId,
        actionType: params.actionType,
        actionTitle: params.actionTitle,
        actionDescription: params.actionDescription || null,
        oldValue: params.oldValue || null,
        newValue: params.newValue || null,
        relatedId: params.relatedId || null,
        relatedType: params.relatedType || null,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
        createdAt: getTurkeyDate()
      }
    })

    console.log(`📝 Activity logged: [${params.actionType}] ${params.actionTitle}`)
    return log
  } catch (error) {
    // Log hatası ana işlemi durdurmamali
    console.error('Activity log error:', error)
    return null
  }
}

/**
 * Kullanıcının tüm aktivite loglarını getir
 */
export async function getUserActivityLogs(userId: string, options?: {
  actionType?: ActivityActionType
  limit?: number
  offset?: number
  startDate?: Date
  endDate?: Date
}) {
  const where: any = { userId }

  if (options?.actionType) {
    where.actionType = options.actionType
  }

  if (options?.startDate || options?.endDate) {
    where.createdAt = {}
    if (options.startDate) {
      where.createdAt.gte = options.startDate
    }
    if (options.endDate) {
      where.createdAt.lte = options.endDate
    }
  }

  const logs = await prisma.userActivityLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: options?.limit || 100,
    skip: options?.offset || 0
  })

  return logs.map(log => ({
    ...log,
    metadata: log.metadata ? JSON.parse(log.metadata) : null
  }))
}

/**
 * Request'ten IP ve User Agent bilgilerini çıkar
 */
export function extractRequestInfo(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')
  const ipAddress = forwarded ? forwarded.split(',')[0].trim() :
                    request.headers.get('x-real-ip') ||
                    'unknown'
  const userAgent = request.headers.get('user-agent') || undefined

  return { ipAddress, userAgent }
}

// =========== HELPER FUNCTIONS ===========

/**
 * TRC20 cüzdan değişikliği logla
 */
export async function logWalletChange(
  userId: string,
  actionType: 'wallet_add' | 'wallet_update' | 'wallet_delete',
  oldAddress: string | null,
  newAddress: string | null,
  requestInfo?: { ipAddress?: string; userAgent?: string }
) {
  const titles: Record<string, string> = {
    wallet_add: 'TRC20 cüzdan adresi eklendi',
    wallet_update: 'TRC20 cüzdan adresi güncellendi',
    wallet_delete: 'TRC20 cüzdan adresi silindi'
  }

  const descriptions: Record<string, string> = {
    wallet_add: `Yeni adres: ${newAddress}`,
    wallet_update: `Eski: ${oldAddress} → Yeni: ${newAddress}`,
    wallet_delete: `Silinen adres: ${oldAddress}`
  }

  return logActivity({
    userId,
    actionType,
    actionTitle: titles[actionType],
    actionDescription: descriptions[actionType],
    oldValue: oldAddress,
    newValue: newAddress,
    relatedType: 'wallet',
    ...requestInfo
  })
}

/**
 * Sponsor bilgisi değişikliği logla
 */
export async function logSponsorInfoChange(
  userId: string,
  actionType: 'sponsor_add' | 'sponsor_update' | 'sponsor_delete',
  sponsorId: string,
  sponsorName: string,
  oldIdentifier: string | null,
  newIdentifier: string | null,
  identifierType: string,
  requestInfo?: { ipAddress?: string; userAgent?: string }
) {
  const titles: Record<string, string> = {
    sponsor_add: `${sponsorName} sponsor bilgisi eklendi`,
    sponsor_update: `${sponsorName} sponsor bilgisi güncellendi`,
    sponsor_delete: `${sponsorName} sponsor bilgisi silindi`
  }

  let description = ''
  if (actionType === 'sponsor_add') {
    description = `${identifierType}: ${newIdentifier}`
  } else if (actionType === 'sponsor_update') {
    description = `Eski: ${oldIdentifier} → Yeni: ${newIdentifier}`
  } else {
    description = `Silinen: ${oldIdentifier}`
  }

  return logActivity({
    userId,
    actionType,
    actionTitle: titles[actionType],
    actionDescription: description,
    oldValue: oldIdentifier,
    newValue: newIdentifier,
    relatedId: sponsorId,
    relatedType: 'sponsor',
    metadata: {
      sponsorName,
      identifierType
    },
    ...requestInfo
  })
}

/**
 * Telegram bağlantı değişikliği logla
 */
export async function logTelegramChange(
  userId: string,
  actionType: 'telegram_link' | 'telegram_unlink',
  telegramId: string | null,
  telegramUsername: string | null,
  requestInfo?: { ipAddress?: string; userAgent?: string }
) {
  const isLink = actionType === 'telegram_link'

  return logActivity({
    userId,
    actionType,
    actionTitle: isLink ? 'Telegram hesabı bağlandı' : 'Telegram bağlantısı koparıldı',
    actionDescription: telegramUsername ? `@${telegramUsername}` : `ID: ${telegramId}`,
    oldValue: isLink ? null : telegramId,
    newValue: isLink ? telegramId : null,
    relatedType: 'telegram',
    metadata: {
      telegramId,
      telegramUsername
    },
    ...requestInfo
  })
}

/**
 * Etkinlik katılımı logla
 */
export async function logEventJoin(
  userId: string,
  eventId: string,
  eventTitle: string,
  sponsorName: string,
  sponsorInfo: string,
  requestInfo?: { ipAddress?: string; userAgent?: string }
) {
  return logActivity({
    userId,
    actionType: 'event_join',
    actionTitle: `${eventTitle} etkinliğine katıldı`,
    actionDescription: `Sponsor: ${sponsorName}, Bilgi: ${sponsorInfo}`,
    relatedId: eventId,
    relatedType: 'event',
    metadata: {
      eventTitle,
      sponsorName,
      sponsorInfo
    },
    ...requestInfo
  })
}

/**
 * Çark çevirme logla
 */
export async function logWheelSpin(
  userId: string,
  prizeName: string,
  pointsWon: number,
  wheelSpinId: string,
  requestInfo?: { ipAddress?: string; userAgent?: string }
) {
  return logActivity({
    userId,
    actionType: 'wheel_spin',
    actionTitle: 'Çark çevirildi',
    actionDescription: `${prizeName} - +${pointsWon} puan kazanıldı`,
    newValue: String(pointsWon),
    relatedId: wheelSpinId,
    relatedType: 'wheel_spin',
    metadata: {
      prizeName,
      pointsWon
    },
    ...requestInfo
  })
}

/**
 * Market satın alma logla
 */
export async function logPurchase(
  userId: string,
  purchaseId: string,
  itemName: string,
  pointsSpent: number,
  category: string,
  walletAddress?: string | null,
  sponsorInfo?: string | null,
  requestInfo?: { ipAddress?: string; userAgent?: string }
) {
  return logActivity({
    userId,
    actionType: 'purchase',
    actionTitle: `${itemName} satın alındı`,
    actionDescription: `${pointsSpent.toLocaleString('tr-TR')} puan harcandı`,
    newValue: String(pointsSpent),
    relatedId: purchaseId,
    relatedType: 'purchase',
    metadata: {
      itemName,
      pointsSpent,
      category,
      walletAddress,
      sponsorInfo
    },
    ...requestInfo
  })
}

/**
 * Promocode kullanımı logla
 */
export async function logPromocodeUse(
  userId: string,
  promocodeId: string,
  code: string,
  pointsEarned: number,
  requestInfo?: { ipAddress?: string; userAgent?: string }
) {
  return logActivity({
    userId,
    actionType: 'promocode_use',
    actionTitle: `${code} promocode kullanıldı`,
    actionDescription: `+${pointsEarned} puan kazanıldı`,
    newValue: code,
    relatedId: promocodeId,
    relatedType: 'promocode',
    metadata: {
      code,
      pointsEarned
    },
    ...requestInfo
  })
}

/**
 * Bilet talebi logla
 */
export async function logTicketRequest(
  userId: string,
  requestId: string,
  eventTitle: string,
  sponsorInfo: string,
  investmentAmount: number,
  requestInfo?: { ipAddress?: string; userAgent?: string }
) {
  return logActivity({
    userId,
    actionType: 'ticket_request',
    actionTitle: `${eventTitle} için bilet talebi`,
    actionDescription: `${investmentAmount.toLocaleString('tr-TR')} TL yatırım, Bilgi: ${sponsorInfo}`,
    relatedId: requestId,
    relatedType: 'ticket_request',
    metadata: {
      eventTitle,
      sponsorInfo,
      investmentAmount
    },
    ...requestInfo
  })
}

/**
 * Görev tamamlama logla
 */
export async function logTaskComplete(
  userId: string,
  taskId: string,
  taskTitle: string,
  pointsReward: number,
  xpReward: number,
  requestInfo?: { ipAddress?: string; userAgent?: string }
) {
  return logActivity({
    userId,
    actionType: 'task_complete',
    actionTitle: `${taskTitle} görevi tamamlandı`,
    actionDescription: `+${pointsReward} puan, +${xpReward} XP`,
    relatedId: taskId,
    relatedType: 'task',
    metadata: {
      taskTitle,
      pointsReward,
      xpReward
    },
    ...requestInfo
  })
}

/**
 * Kullanıcı kaydı logla
 */
export async function logRegister(
  userId: string,
  email: string,
  siteUsername: string,
  requestInfo?: { ipAddress?: string; userAgent?: string }
) {
  return logActivity({
    userId,
    actionType: 'register',
    actionTitle: 'Hesap oluşturuldu',
    actionDescription: `${siteUsername} (${email})`,
    newValue: email,
    relatedType: 'user',
    metadata: {
      email,
      siteUsername
    },
    ...requestInfo
  })
}

/**
 * Şifre değiştirme logla
 */
export async function logPasswordChange(
  userId: string,
  requestInfo?: { ipAddress?: string; userAgent?: string }
) {
  return logActivity({
    userId,
    actionType: 'password_change',
    actionTitle: 'Şifre değiştirildi',
    actionDescription: 'Kullanıcı şifresini güncelledi',
    relatedType: 'user',
    ...requestInfo
  })
}

/**
 * Avatar değiştirme logla
 */
export async function logAvatarChange(
  userId: string,
  oldAvatar: string | null,
  newAvatar: string,
  requestInfo?: { ipAddress?: string; userAgent?: string }
) {
  return logActivity({
    userId,
    actionType: 'avatar_change',
    actionTitle: 'Avatar değiştirildi',
    actionDescription: oldAvatar ? `${oldAvatar} → ${newAvatar}` : `Yeni avatar: ${newAvatar}`,
    oldValue: oldAvatar,
    newValue: newAvatar,
    relatedType: 'user',
    ...requestInfo
  })
}
