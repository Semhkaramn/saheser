import { getTurkeyDate, getTurkeyToday, getTurkeyWeekStart } from '@/lib/utils'

/**
 * Calculate expiresAt date for tasks based on category
 * Used by both admin task creation and task completion
 *
 * ✅ FIX: Türkiye saat dilimine göre doğru hesaplama
 */
export function calculateTaskExpiresAt(
  category: string,
  customExpiresAt?: string | Date | null
): Date | null {
  if (customExpiresAt) {
    return customExpiresAt instanceof Date ? customExpiresAt : new Date(customExpiresAt)
  }

  if (category === 'permanent') {
    return null
  }

  if (category === 'daily') {
    // Günlük task - Türkiye saatine göre yarın 00:00
    // getTurkeyToday() bugünün başlangıcını UTC olarak döndürür
    // Bir gün ekleyerek yarının başlangıcını buluyoruz
    const todayStart = getTurkeyToday()
    const tomorrow = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)
    return tomorrow
  }

  if (category === 'weekly') {
    // Haftalık task - Türkiye saatine göre bir sonraki pazartesi 00:00
    // getTurkeyWeekStart() bu haftanın pazartesi 00:00'ını UTC olarak döndürür
    // 7 gün ekleyerek bir sonraki pazartesiyi buluyoruz
    const weekStart = getTurkeyWeekStart()
    const nextMonday = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)
    return nextMonday
  }

  return null
}

/**
 * Calculate the start of the current period for a given category
 * Used for completion limit checks
 *
 * ✅ FIX: Türkiye saat dilimine göre doğru hesaplama
 */
export function getPeriodStart(category: string, now: Date): Date | null {
  if (category === 'daily') {
    // Bugünün başlangıcı (Türkiye saatine göre)
    return getTurkeyToday()
  }

  if (category === 'weekly') {
    // Bu haftanın başlangıcı - Pazartesi (Türkiye saatine göre)
    return getTurkeyWeekStart()
  }

  // Permanent tasks don't have periods
  return null
}

/**
 * Validate task form data
 */
export function validateTaskData(data: {
  title: string
  targetValue: number
  xpReward: number
  pointsReward: number
  completionLimit?: number | null
  duration?: number | null
}) {
  const errors: string[] = []

  if (!data.title || data.title.trim().length === 0) {
    errors.push('Görev başlığı zorunludur')
  }

  if (data.targetValue < 1) {
    errors.push('Hedef değer en az 1 olmalıdır')
  }

  if (data.xpReward < 0) {
    errors.push('XP ödülü negatif olamaz')
  }

  if (data.pointsReward < 0) {
    errors.push('Puan ödülü negatif olamaz')
  }

  if (data.completionLimit !== null && data.completionLimit !== undefined && data.completionLimit < 1) {
    errors.push('Tamamlanma limiti en az 1 olmalıdır')
  }

  if (data.duration !== null && data.duration !== undefined && data.duration < 1) {
    errors.push('Süre en az 1 saat olmalıdır')
  }

  return errors
}

/**
 * Task type definitions
 */
// ✅ Mesaj ve çark türleri
export const TASK_TYPES = {
  SEND_MESSAGES: 'send_messages',
  SPIN_WHEEL: 'spin_wheel'
} as const

export const TASK_CATEGORIES = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  STREAK: 'streak',
  PERMANENT: 'permanent'
} as const
