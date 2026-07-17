/**
 * 🚀 Enhanced Cache System
 * 2 katmanlı cache: Memory (L1, anlık) → Redis (L2, serverless invocation'lar arası kalıcı)
 *
 * ÖNEMLİ: Bu proje Netlify Functions (serverless) üzerinde çalışıyor. Sadece
 * in-memory (process içi Map) cache kullanmak, her "cold start"ta cache'in
 * sıfırlanması demektir - bu da "bazen hızlı bazen yavaş" hissinin ana
 * sebeplerinden biriydi. UPSTASH_REDIS_REST_URL/TOKEN tanımlıysa artık
 * gerçekten paylaşılan (Redis) bir katman kullanılıyor; tanımlı değilse
 * sessizce sadece memory cache'e düşüyor (davranış bozulmaz).
 *
 * Dışa açılan API (getCachedData, enhancedCache.*, CacheKeys, CacheTags,
 * invalidateCache.*) hiç değişmedi - mevcut kullanım yerlerinde değişiklik
 * gerekmiyor.
 */

import { getRedisClient } from './telegram/utils/redis-client'

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
  tags: string[] // Cache invalidation için tag'ler
}

/**
 * Cache stratejileri
 */
export enum CacheStrategy {
  /** Sadece cache'te yoksa DB'den çek */
  CACHE_FIRST = 'cache-first',
  /** Her zaman DB'den çek, cache'i güncelle */
  NETWORK_FIRST = 'network-first',
  /** Cache varsa onu kullan, arka planda güncelle */
  STALE_WHILE_REVALIDATE = 'stale-while-revalidate'
}

/**
 * Cache TTL presets (saniye)
 */
export const CacheTTL = {
  SHORT: 60,           // 1 dakika
  MEDIUM: 300,         // 5 dakika
  LONG: 1800,          // 30 dakika
  VERY_LONG: 3600,     // 1 saat
  DAY: 86400,          // 24 saat
} as const

const REDIS_KEY_PREFIX = 'ecache:'
const REDIS_TAG_PREFIX = 'ecache:tag:'

class EnhancedCache {
  private memory = new Map<string, CacheEntry<unknown>>()
  private tagIndex = new Map<string, Set<string>>()

  /**
   * Cache'e veri ekle (memory anında, Redis arka planda - varsa)
   */
  async set<T>(
    key: string,
    data: T,
    ttlSeconds: number = CacheTTL.MEDIUM,
    tags: string[] = []
  ): Promise<void> {
    this.memory.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlSeconds * 1000,
      tags
    })

    for (const tag of tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set())
      }
      this.tagIndex.get(tag)?.add(key)
    }

    const redis = getRedisClient()
    if (!redis) return

    try {
      await redis.set(REDIS_KEY_PREFIX + key, { data, tags }, { ex: ttlSeconds })
      if (tags.length > 0) {
        await Promise.all(tags.map((tag) => redis.sadd(REDIS_TAG_PREFIX + tag, key)))
      }
    } catch (error) {
      console.error('⚠️ Redis cache set hatası (memory cache yine de çalışıyor):', error)
    }
  }

  /**
   * Cache'ten veri oku: önce memory (L1), yoksa Redis (L2)
   */
  async get<T>(key: string): Promise<T | null> {
    const memEntry = this.memory.get(key) as CacheEntry<T> | undefined
    if (memEntry) {
      if (Date.now() - memEntry.timestamp <= memEntry.ttl) {
        return memEntry.data
      }
      this.memory.delete(key)
    }

    const redis = getRedisClient()
    if (!redis) return null

    try {
      const cached = await redis.get<{ data: T; tags: string[] }>(REDIS_KEY_PREFIX + key)
      if (cached) {
        // Redis'ten gelen veriyi memory'ye de yaz (bir sonraki okuma anında olsun)
        this.memory.set(key, {
          data: cached.data,
          timestamp: Date.now(),
          ttl: CacheTTL.MEDIUM * 1000,
          tags: cached.tags || []
        })
        return cached.data
      }
    } catch (error) {
      console.error('⚠️ Redis cache get hatası:', error)
    }

    return null
  }

  /**
   * Cache'te var mı ve geçerli mi kontrol et
   */
  async has(key: string): Promise<boolean> {
    return (await this.get(key)) !== null
  }

  /**
   * Belirli bir key'i sil
   */
  async delete(key: string): Promise<void> {
    const entry = this.memory.get(key)
    if (entry) {
      for (const tag of entry.tags) {
        this.tagIndex.get(tag)?.delete(key)
      }
    }
    this.memory.delete(key)

    const redis = getRedisClient()
    if (!redis) return
    try {
      await redis.del(REDIS_KEY_PREFIX + key)
    } catch (error) {
      console.error('⚠️ Redis cache delete hatası:', error)
    }
  }

  /**
   * Tag'e göre cache'i sil
   */
  async invalidateByTag(tag: string): Promise<void> {
    const memKeys = this.tagIndex.get(tag)
    if (memKeys) {
      for (const key of memKeys) {
        this.memory.delete(key)
      }
      this.tagIndex.delete(tag)
    }

    const redis = getRedisClient()
    if (!redis) return

    try {
      const redisKeys = await redis.smembers(REDIS_TAG_PREFIX + tag)
      if (redisKeys.length > 0) {
        await Promise.all(redisKeys.map((k) => redis.del(REDIS_KEY_PREFIX + k)))
      }
      await redis.del(REDIS_TAG_PREFIX + tag)
    } catch (error) {
      console.error('⚠️ Redis cache invalidateByTag hatası:', error)
    }
  }

  /**
   * Tüm cache'i temizle (sadece memory - Redis'i topluca silmek riskli olabileceğinden
   * yalnızca bilinen tag'ler üzerinden temizleniyor)
   */
  clear(): void {
    this.memory.clear()
    this.tagIndex.clear()
  }

  /**
   * Süresi dolmuş memory entry'lerini temizle
   */
  cleanup(): void {
    const now = Date.now()

    for (const [key, entry] of this.memory.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.memory.delete(key)
      }
    }
  }

  /**
   * Cache istatistikleri (sadece memory katmanı için - Redis tarafı ayrıca izlenmiyor)
   */
  getStats() {
    let validEntries = 0
    let expiredEntries = 0
    const now = Date.now()

    for (const entry of this.memory.values()) {
      if (now - entry.timestamp > entry.ttl) {
        expiredEntries++
      } else {
        validEntries++
      }
    }

    return {
      total: this.memory.size,
      valid: validEntries,
      expired: expiredEntries,
      tags: this.tagIndex.size,
      redisEnabled: getRedisClient() !== null
    }
  }
}

// Singleton instance
export const enhancedCache = new EnhancedCache()

// Otomatik cleanup (5 dakikada bir)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    enhancedCache.cleanup()
  }, 5 * 60 * 1000)
}

/**
 * Cache helper with automatic fetching
 */
export async function getCachedData<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: {
    ttl?: number
    tags?: string[]
    strategy?: CacheStrategy
  } = {}
): Promise<T> {
  const {
    ttl = CacheTTL.MEDIUM,
    tags = [],
    strategy = CacheStrategy.CACHE_FIRST
  } = options

  // CACHE_FIRST: Cache'te varsa onu döndür
  if (strategy === CacheStrategy.CACHE_FIRST) {
    const cached = await enhancedCache.get<T>(key)
    if (cached !== null) {
      return cached
    }

    const data = await fetcher()
    await enhancedCache.set(key, data, ttl, tags)
    return data
  }

  // NETWORK_FIRST: Her zaman yeni veriyi çek
  if (strategy === CacheStrategy.NETWORK_FIRST) {
    const data = await fetcher()
    await enhancedCache.set(key, data, ttl, tags)
    return data
  }

  // STALE_WHILE_REVALIDATE: Cache'i döndür, arka planda güncelle
  if (strategy === CacheStrategy.STALE_WHILE_REVALIDATE) {
    const cached = await enhancedCache.get<T>(key)

    if (cached !== null) {
      // Cache varsa: onu anında döndür, arka planda (kullanıcıyı bekletmeden) güncelle.
      // ✅ FIX: Önceden cache boşken de fetcher() burada bir kere daha
      // tetikleniyordu (aşağıdaki "cache yoksa" dalıyla birlikte AYNI ANDA
      // iki kere) - bu da özellikle soğuk başlangıçta (serverless DB henüz
      // uyanmamışken) veritabanına gereksiz çifte yük bindiriyordu. Artık
      // sadece cache GERÇEKTEN varsa arka plan yenilemesi tetikleniyor.
      fetcher().then(data => {
        enhancedCache.set(key, data, ttl, tags)
      }).catch(console.error)
      return cached
    }

    // Cache yoksa - tek seferlik bekle. fetcher() burada hata fırlatırsa
    // (örn. DB timeout), catch etmiyoruz - çağıran taraf (route handler)
    // yakalayıp kendi fallback'ini dönsün ve ÖNEMLİSİ cache'e YAZILMASIN.
    // Eskiden withTimeout() hataları yutup sahte bir "başarılı" sonuç
    // (sıfırlar) döndürüyordu, bu da aşağıdaki enhancedCache.set() ile
    // o sahte sıfırları 60 saniyeliğine cache'e yazıp herkese gösteriyordu.
    const data = await fetcher()
    await enhancedCache.set(key, data, ttl, tags)
    return data
  }

  // Fallback
  const data = await fetcher()
  await enhancedCache.set(key, data, ttl, tags)
  return data
}

/**
 * Specialized cache helpers
 */

export const CacheKeys = {
  USER: (userId: string) => `user:${userId}`,
  USER_STATS: (userId: string) => `user:${userId}:stats`,
  LEADERBOARD: (type: string) => `leaderboard:${type}`,
  SPONSORS: () => 'sponsors:all',
  SETTINGS: (key: string) => `settings:${key}`,
  WHEEL_PRIZES: () => 'wheel:prizes',
  WHEEL_WINNERS: () => 'wheel:winners',
  TASKS: () => 'tasks:all',
  SHOP_ITEMS: () => 'shop:items',
  SOCIAL_MEDIA: () => 'social:all',
} as const

export const CacheTags = {
  USER: 'user',
  LEADERBOARD: 'leaderboard',
  SPONSORS: 'sponsors',
  SETTINGS: 'settings',
  WHEEL: 'wheel',
  TASKS: 'tasks',
  SHOP: 'shop',
  SOCIAL: 'social',
  EVENTS: 'events',
} as const

/**
 * Throttle yönetimi için state
 */
let lastLeaderboardInvalidation = 0
const LEADERBOARD_INVALIDATION_THROTTLE = 5 * 60 * 1000 // 5 dakika

/**
 * Invalidation helpers
 */
export const invalidateCache = {
  user: (userId: string) => {
    enhancedCache.delete(CacheKeys.USER(userId))
    enhancedCache.delete(CacheKeys.USER_STATS(userId))
    enhancedCache.invalidateByTag(CacheTags.LEADERBOARD) // Leaderboard etkilenir
  },

  leaderboard: () => {
    enhancedCache.invalidateByTag(CacheTags.LEADERBOARD)
  },

  /**
   * Leaderboard cache'i throttled invalidate eder (performans için)
   * 5 dakikada bir invalidate eder - arada puan değişimleri birikerek toplu invalidate olur
   */
  leaderboardThrottled: () => {
    const now = Date.now()

    // Son invalidation'dan 5 dakika geçmediyse skip et
    if (now - lastLeaderboardInvalidation < LEADERBOARD_INVALIDATION_THROTTLE) {
      return
    }

    lastLeaderboardInvalidation = now
    enhancedCache.invalidateByTag(CacheTags.LEADERBOARD)

    console.log('🔄 Leaderboard cache invalidated (throttled)')
  },

  sponsors: () => {
    enhancedCache.invalidateByTag(CacheTags.SPONSORS)
  },

  wheel: () => {
    enhancedCache.invalidateByTag(CacheTags.WHEEL)
  },

  shop: () => {
    enhancedCache.invalidateByTag(CacheTags.SHOP)
  },

  tasks: () => {
    enhancedCache.invalidateByTag(CacheTags.TASKS)
  },

  social: () => {
    enhancedCache.invalidateByTag(CacheTags.SOCIAL)
  },

  events: () => {
    enhancedCache.invalidateByTag(CacheTags.EVENTS)
  },

  /**
   * Settings cache'i temizle
   */
  settings: async () => {
    enhancedCache.invalidateByTag(CacheTags.SETTINGS)
  },

  all: () => {
    enhancedCache.clear()
  }
} as const

/**
 * Helper functions - backward compatibility için
 */

// Settings cache helpers
export async function getCachedSettings(
  fetcher: () => Promise<any>,
  ttlSeconds: number = 3600
): Promise<any> {
  return getCachedData(
    'app_settings',
    fetcher,
    { ttl: ttlSeconds, tags: [CacheTags.SETTINGS] }
  )
}

export async function invalidateSettingsCache(): Promise<void> {
  await invalidateCache.settings()
}

// User profile photo cache
export async function getCachedUserPhoto(
  userId: string,
  fetcher: () => Promise<string | null>,
  ttlSeconds: number = 86400
): Promise<string | null> {
  return getCachedData(
    CacheKeys.USER(userId),
    fetcher,
    { ttl: ttlSeconds, tags: [CacheTags.USER] }
  )
}

export function invalidateUserPhotoCache(userId: string): void {
  enhancedCache.delete(CacheKeys.USER(userId))
}

// Leaderboard cache
export async function getCachedLeaderboard(
  sortBy: string,
  fetcher: () => Promise<any>,
  ttlSeconds: number = 300
): Promise<any> {
  return getCachedData(
    CacheKeys.LEADERBOARD(sortBy),
    fetcher,
    { ttl: ttlSeconds, tags: [CacheTags.LEADERBOARD] }
  )
}

export function invalidateLeaderboardCache(): void {
  invalidateCache.leaderboard()
}

export function invalidateLeaderboardCacheThrottled(): void {
  invalidateCache.leaderboardThrottled()
}
