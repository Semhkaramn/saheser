import { prisma } from '@/lib/prisma'
import { getRedisClient } from './redis-client'

export interface BanStatus {
  isBanned: boolean
  banReason?: string
}

/**
 * Kullanıcının ban durumunu kontrol et (Redis cache ile optimize edilmiş)
 * @param telegramId Telegram user ID
 * @returns Ban durumu
 */
export async function checkUserBan(telegramId: string): Promise<BanStatus> {
  try {
    const redis = getRedisClient()
    const cacheKey = `ban:${telegramId}`
    const cacheReasonKey = `ban:${telegramId}:reason`

    // Redis'ten kontrol et
    if (redis) {
      try {
        const cached = await redis.get<string>(cacheKey)
        if (cached !== null) {
          const isBanned = cached === '1'
          const banReason = isBanned ? await redis.get<string>(cacheReasonKey) : undefined
          return {
            isBanned,
            banReason: banReason || undefined
          }
        }
      } catch (redisError) {
        console.warn('Redis cache error in ban check:', redisError)
        // Redis hatasında DB'ye fallback
      }
    }

    // DB'den çek
    const user = await prisma.user.findUnique({
      where: { telegramId },
      select: { isBanned: true, banReason: true }
    })

    if (!user) {
      return { isBanned: false }
    }

    // Cache'le (1 gün - 86400 saniye)
    // 🚀 OPTIMIZATION: Ban durumu sık değişmediği için 1 gün cache
    if (redis) {
      try {
        await redis.setex(cacheKey, 86400, user.isBanned ? '1' : '0')
        if (user.isBanned && user.banReason) {
          await redis.setex(cacheReasonKey, 86400, user.banReason)
        }
      } catch (redisError) {
        console.warn('Failed to cache ban status:', redisError)
        // Cache hatası kritik değil, devam et
      }
    }

    return {
      isBanned: user.isBanned,
      banReason: user.banReason || undefined
    }
  } catch (error) {
    console.error('Ban check error:', error)
    return { isBanned: false } // Hata durumunda banlı değil say
  }
}

/**
 * Ban cache'ini temizle (admin ban/unban yaptığında çağrılmalı)
 * @param telegramId Telegram user ID
 */
export async function invalidateBanCache(telegramId: string): Promise<void> {
  const redis = getRedisClient()
  if (redis) {
    try {
      await redis.del(`ban:${telegramId}`, `ban:${telegramId}:reason`)
    } catch (error) {
      console.warn('Failed to invalidate ban cache:', error)
    }
  }
}
