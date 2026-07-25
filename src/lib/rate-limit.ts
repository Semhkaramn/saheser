import { getRedisClient } from '@/lib/telegram/utils/redis-client'

/**
 * Basit bir "X dakikada Y deneme" hız sınırlayıcı - giriş ekranlarında
 * brute-force (şifre tahmin etme) saldırılarını engellemek için.
 * Redis yoksa (env değişkenleri ayarlanmamışsa) sınırlama uygulanmaz -
 * sistemin geri kalanı gibi "sessizce devre dışı" davranır.
 */
export async function checkLoginRateLimit(
  key: string,
  maxAttempts = 5,
  windowSeconds = 300
): Promise<{ allowed: boolean; remainingAttempts: number }> {
  const redis = getRedisClient()
  if (!redis) return { allowed: true, remainingAttempts: maxAttempts }

  try {
    const redisKey = `login_attempts:${key}`
    const current = await redis.incr(redisKey)
    if (current === 1) {
      await redis.expire(redisKey, windowSeconds)
    }

    if (current > maxAttempts) {
      return { allowed: false, remainingAttempts: 0 }
    }

    return { allowed: true, remainingAttempts: maxAttempts - current }
  } catch (error) {
    // Redis'e ulaşılamıyorsa girişi engellemeyelim - kullanıcı deneyimini
    // bozmamak için "açık" tarafta hata verelim.
    console.error('❌ Rate limit kontrol hatası:', error)
    return { allowed: true, remainingAttempts: maxAttempts }
  }
}

/**
 * Başarılı giriş sonrası deneme sayacını sıfırlar.
 */
export async function resetLoginRateLimit(key: string): Promise<void> {
  const redis = getRedisClient()
  if (!redis) return
  try {
    await redis.del(`login_attempts:${key}`)
  } catch {
    // önemli değil
  }
}
