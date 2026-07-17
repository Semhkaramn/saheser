import { NextRequest, NextResponse } from 'next/server'
import { enhancedCache, invalidateCache, invalidateSettingsCache } from '@/lib/enhanced-cache'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin-middleware'

/**
 * Admin endpoint to manually clear all caches
 * POST /api/admin/clear-cache
 */
export async function POST(request: NextRequest) {
  const authCheck = await requireAdmin(request)
  if (authCheck.error) return authCheck.error

  try {
    // Clear all enhanced caches
    enhancedCache.clear()

    // Clear leaderboard cache
    invalidateCache.leaderboard()

    // Clear settings cache (hem enhanced hem telegram)
    await invalidateSettingsCache()

    // Revalidate all important paths
    const paths = [
      '/',
      '/tasks',
      '/shop',
      '/wheel',
      '/leaderboard',
      '/api/tasks',
      '/api/shop',
      '/api/wheel',
      '/api/leaderboard',
      '/api/sponsors',
      '/api/settings',
      '/api/social-media'
    ]

    for (const path of paths) {
      revalidatePath(path)
    }

    console.log('🧹 TÜM CACHE TEMİZLENDİ (Admin tarafından manuel olarak)')

    return NextResponse.json({
      success: true,
      message: 'Tüm cache\'ler temizlendi',
      clearedPaths: paths.length
    })
  } catch (error) {
    console.error('Clear cache error:', error)
    return NextResponse.json(
      { error: 'Cache temizlenirken hata oluştu' },
      { status: 500 }
    )
  }
}
