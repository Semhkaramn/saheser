/**
 * ✅ REFACTORED: Task API Routes
 * Business logic lib/services/task-service.ts'e taşındı
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { invalidateCache } from '@/lib/enhanced-cache'
import { createErrorResponse } from '@/lib/error-handler'
import { getUserTasks, claimTaskReward } from '@/lib/services/task-service'

// GET - Kullanıcının görevlerini getir
export async function GET(request: NextRequest) {
  try {
    // ✅ Auth opsiyonel - giriş yapmadan da görevleri görebilmeli
    let userId: string | null = null

    try {
      const session = await requireAuth(request)
      userId = session.userId
    } catch (error) {
      // Giriş yapmamış - progress 0 olacak
      console.log('User not authenticated, showing tasks without progress')
    }

    // ✅ Service layer'dan görevleri al
    const result = await getUserTasks(userId)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Get tasks error:', error)
    return createErrorResponse(
      error instanceof Error ? error : new Error('Görevler yüklenirken bir hata oluştu')
    )
  }
}

// POST - Görev ödülünü talep et
export async function POST(request: NextRequest) {
  try {
    // ✅ Session kontrolü
    const session = await requireAuth(request)
    const userId = session.userId

    const body = await request.json()
    const { taskId } = body

    if (!taskId) {
      return NextResponse.json(
        { error: 'taskId required' },
        { status: 400 }
      )
    }

    // ✅ Service layer'dan ödül al
    const result = await claimTaskReward(userId, taskId)

    // ✅ Cache'i temizle (puan/XP değişti)
    invalidateCache.leaderboard()

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Oturum geçersiz. Lütfen tekrar giriş yapın.' },
        { status: 401 }
      )
    }

    console.error('Claim task reward error:', error)
    return createErrorResponse(
      error instanceof Error ? error : new Error('Görev ödülü alınırken bir hata oluştu')
    )
  }
}
