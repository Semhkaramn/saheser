/**
 * 🚀 OPTIMIZED Site Configuration
 *
 * Bu dosya sık kullanılan ayarları ENV'den okur.
 * Artık her istekte DB sorgusu yapmaya gerek yok!
 *
 * Performance improvement: ~50-100ms per request
 */

import { prisma } from './prisma'
import { enhancedCache, CacheTTL } from './enhanced-cache'

/**
 * ✅ CRITICAL SETTINGS - ENV'den okunur (DB sorgusu YOK)
 */
export const SiteConfig = {
  // Telegram Bot
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramBotUsername: process.env.TELEGRAM_BOT_USERNAME || '',
  activityGroupId: process.env.ACTIVITY_GROUP_ID || process.env.activity_group_id || '',

  // Wheel Settings
  dailyWheelSpins: Number.parseInt(process.env.DAILY_WHEEL_SPINS || '3'),
  wheelResetTime: process.env.WHEEL_RESET_TIME || '00:00',
  wheelResetNotificationEnabled: process.env.WHEEL_RESET_NOTIFICATION_ENABLED !== 'false', // Default true

  // Site Settings
  siteName: process.env.NEXT_PUBLIC_SITE_NAME || 'Site',
  siteLogo: process.env.NEXT_PUBLIC_SITE_LOGO || '/logo.webp', // Static file from public folder - optimized WebP format

  // App URL
  appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',

  // Points and XP Settings (büyük/küçük harf desteği)
  pointsPerMessage: Number.parseInt(
    process.env.POINTS_PER_MESSAGE ||
    process.env.points_per_message ||
    '10'
  ),
  xpPerMessage: Number.parseInt(
    process.env.XP_PER_MESSAGE ||
    process.env.xp_per_message ||
    '5'
  ),
  messagesForXp: Number.parseInt(
    process.env.MESSAGES_FOR_XP ||
    process.env.messages_for_xp ||
    '1'
  ),

  // Message Restrictions (büyük/küçük harf desteği)
  minMessageLength: Number.parseInt(
    process.env.MIN_MESSAGE_LENGTH ||
    process.env.min_message_length ||
    '3'
  ),
  messageCooldownSeconds: Number.parseInt(
    process.env.MESSAGE_COOLDOWN_SECONDS ||
    process.env.message_cooldown_seconds ||
    '5'
  ),

  // Cloudinary Upload Settings
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
    uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET || '',
    // Folder prefix - ENV'den veya siteName'den türetilir
    folder: process.env.CLOUDINARY_FOLDER ||
      (process.env.NEXT_PUBLIC_SITE_NAME || 'uploads')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '')
  },

  // Cache TTL
  cache: {
    short: Number.parseInt(process.env.CACHE_TTL_SHORT || '60'),
    medium: Number.parseInt(process.env.CACHE_TTL_MEDIUM || '300'),
    long: Number.parseInt(process.env.CACHE_TTL_LONG || '3600'),
  }
} as const

/**
 * ✅ DYNAMIC SETTINGS - DB'den okunur ama cache'lenir
 * Sadece sık değişmeyen ayarlar için kullanın (popup, sponsor banner gibi)
 */
const DYNAMIC_SETTINGS_CACHE_KEY = 'dynamic_settings'

interface DynamicSettings {
  sponsorBannerEnabled?: boolean
  popupEnabled?: boolean
  popupData?: string
  rollEnabled?: boolean
  leftBannerData?: string
  rightBannerData?: string
  // Bildirim ayarları
  notifyOrderApproved?: boolean
  notifyLevelUp?: boolean
  notifyWheelReset?: boolean
}

/**
 * Dinamik ayarları getir (cache'lenmiş)
 * @param ttl Cache süresi (saniye)
 */
export async function getDynamicSettings(ttl: number = CacheTTL.LONG): Promise<DynamicSettings> {
  // Cache'ten dene
  const cached = await enhancedCache.get<DynamicSettings>(DYNAMIC_SETTINGS_CACHE_KEY)
  if (cached) {
    return cached
  }

  // DB'den getir
  const settings = await prisma.settings.findMany({
    where: {
      key: {
        in: [
          'sponsor_banner_enabled',
          'popup_enabled',
          'popup_data',
          'roll_enabled',
          'left_banner_data',
          'right_banner_data',
          // Bildirim ayarları
          'notify_order_approved',
          'notify_level_up',
          'notify_wheel_reset'
        ]
      }
    }
  })

  const dynamicSettings: DynamicSettings = {}

  for (const setting of settings) {
    switch (setting.key) {
      case 'sponsor_banner_enabled':
        dynamicSettings.sponsorBannerEnabled = setting.value === 'true'
        break
      case 'popup_enabled':
        dynamicSettings.popupEnabled = setting.value === 'true'
        break
      case 'popup_data':
        dynamicSettings.popupData = setting.value
        break
      case 'roll_enabled':
        dynamicSettings.rollEnabled = setting.value === 'true'
        break
      case 'left_banner_data':
        dynamicSettings.leftBannerData = setting.value
        break
      case 'right_banner_data':
        dynamicSettings.rightBannerData = setting.value
        break
      // Bildirim ayarları
      case 'notify_order_approved':
        dynamicSettings.notifyOrderApproved = setting.value === 'true'
        break
      case 'notify_level_up':
        dynamicSettings.notifyLevelUp = setting.value === 'true'
        break
      case 'notify_wheel_reset':
        dynamicSettings.notifyWheelReset = setting.value === 'true'
        break
    }
  }

  // Cache'e kaydet
  await enhancedCache.set(DYNAMIC_SETTINGS_CACHE_KEY, dynamicSettings, ttl, ['settings'])

  return dynamicSettings
}

/**
 * Tek bir dinamik ayarı getir
 */
export async function getDynamicSetting(key: string, defaultValue: string = ''): Promise<string> {
  const settings = await getDynamicSettings()

  switch (key) {
    case 'sponsor_banner_enabled':
      return String(settings.sponsorBannerEnabled ?? defaultValue)
    case 'popup_enabled':
      return String(settings.popupEnabled ?? defaultValue)
    case 'popup_data':
      return settings.popupData || defaultValue
    case 'roll_enabled':
      return String(settings.rollEnabled ?? defaultValue)
    case 'left_banner_data':
      return settings.leftBannerData || defaultValue
    case 'right_banner_data':
      return settings.rightBannerData || defaultValue
    // Bildirim ayarları
    case 'notify_order_approved':
      return String(settings.notifyOrderApproved ?? defaultValue)
    case 'notify_level_up':
      return String(settings.notifyLevelUp ?? defaultValue)
    case 'notify_wheel_reset':
      return String(settings.notifyWheelReset ?? defaultValue)
    default:
      return defaultValue
  }
}

/**
 * Dinamik ayarlar cache'ini temizle
 */
export async function invalidateDynamicSettings(): Promise<void> {
  await enhancedCache.delete(DYNAMIC_SETTINGS_CACHE_KEY)
  console.log('🔄 Dynamic settings cache cleared')
}

/**
 * Helper: Telegram bot token kontrolü
 */
export function getTelegramBotToken(): string {
  const token = SiteConfig.telegramBotToken
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN not configured in environment variables')
  }
  return token
}

/**
 * Helper: Aktif grup ID'sini getir (ENV'den)
 */
export function getActivityGroupId(): string {
  return SiteConfig.activityGroupId
}

/**
 * Alias for backwards compatibility
 */
export const getGroupChatId = getActivityGroupId

/**
 * ❌ DEPRECATED - Maintenance mode removed from system
 * @deprecated Use feature flags or admin-only access instead
 * @returns Always returns false
 */
export function isMaintenanceMode(): boolean {
  return false
}

/**
 * Helper: Wheel ayarlarını getir
 */
export function getWheelConfig() {
  return {
    dailySpins: SiteConfig.dailyWheelSpins,
    resetTime: SiteConfig.wheelResetTime
  }
}

/**
 * Alias for backwards compatibility
 * Some components use SITE_CONFIG (uppercase), others use SiteConfig
 */
export const SITE_CONFIG = SiteConfig
