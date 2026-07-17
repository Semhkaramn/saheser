import { schedule } from '@netlify/functions'
import { getPrisma, disconnectPrisma, withTimeout } from './lib/prisma'

/**
 * Cron Job: Her gün Türkiye saati 03:00'da çalışır (UTC 00:00 = TR 03:00)
 * Süresi dolmuş admin session'ları temizler
 *
 * 🚀 FIX: Session yerine AdminSession kullanılıyor
 */
const handler = schedule('0 0 * * *', async () => {
  const prisma = getPrisma()

  try {
    const now = new Date()

    // Süresi dolmuş admin session'ları sil - 6 second timeout
    const deleted = await withTimeout(
      prisma.adminSession.deleteMany({
        where: {
          expiresAt: {
            lt: now
          }
        }
      }),
      6000,
      'Admin session cleanup'
    )

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Admin sessions cleaned up',
        deletedCount: deleted.count,
        timestamp: now.toISOString()
      }),
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const isTimeout = errorMessage.includes('timed out')

    console.error('❌ Error in session cleanup:', isTimeout ? 'Database operation timed out' : errorMessage)

    return {
      statusCode: 200, // Return 200 to prevent retries
      body: JSON.stringify({
        error: isTimeout ? 'Database timeout' : 'Failed to cleanup sessions',
        message: errorMessage
      }),
    }
  } finally {
    await disconnectPrisma()
  }
})

export { handler }
