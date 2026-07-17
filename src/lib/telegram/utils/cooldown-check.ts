import { getRedisClient } from './redis-client'

/**
 * Cooldown kontrolü yap
 * @param userId Telegram user ID
 * @param cooldownSeconds Cooldown süresi (saniye)
 * @returns Kalan saniye (0 = cooldown yok)
 */
export async function checkCooldown(userId: string, cooldownSeconds: number): Promise<number> {
  const redis = getRedisClient()

  // Redis yoksa cooldown kontrolü yapma (fallback)
  if (!redis) {
    return 0
  }

  try {
    const key = `cooldown:message:${userId}`
    const ttl = await redis.ttl(key)

    if (ttl > 0) {
      return ttl // Cooldown aktif, kalan saniye
    }

    return 0 // Cooldown yok
  } catch (error) {
    console.error('Cooldown check error:', error)
    return 0 // Hata durumunda cooldown yok say
  }
}

/**
 * Cooldown ayarla
 * @param userId Telegram user ID
 * @param cooldownSeconds Cooldown süresi (saniye)
 */
export async function setCooldown(userId: string, cooldownSeconds: number): Promise<void> {
  const redis = getRedisClient()

  if (!redis) {
    return // Redis yoksa cooldown ayarlama
  }

  try {
    const key = `cooldown:message:${userId}`
    await redis.set(key, '1', { ex: cooldownSeconds })
  } catch (error) {
    console.error('Cooldown set error:', error)
  }
}

/**
 * Cooldown temizle (manuel olarak)
 * @param userId Telegram user ID
 */
export async function clearCooldown(userId: string): Promise<void> {
  const redis = getRedisClient()

  if (!redis) {
    return
  }

  try {
    const key = `cooldown:message:${userId}`
    await redis.del(key)
  } catch (error) {
    console.error('Cooldown clear error:', error)
  }
}
