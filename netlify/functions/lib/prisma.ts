/**
 * 🔧 Netlify Functions için Prisma Client
 *
 * Ana uygulama @/lib/prisma'yı kullanırken,
 * Netlify Functions ayrı bir ortamda çalıştığı için
 * kendi Prisma client'ına ihtiyaç duyar.
 *
 * ✅ Neon Serverless adapter kullanır
 * ✅ Her invocation sonunda disconnect eder
 * ✅ Timeout handling eklenmiştir
 */

import { PrismaClient } from '@prisma/client'
import { Pool, neonConfig } from '@neondatabase/serverless'
import { PrismaNeon } from '@prisma/adapter-neon'
import ws from 'ws'

let prismaInstance: PrismaClient | null = null

export function getPrisma(): PrismaClient {
  if (prismaInstance) {
    return prismaInstance
  }

  // Neon.tech serverless için WebSocket configurasyonu
  neonConfig.webSocketConstructor = ws
  // Disable pooling for serverless
  neonConfig.useSecureWebSocket = true
  neonConfig.pipelineConnect = false

  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error('DATABASE_URL is not defined in environment variables')
  }

  // Serverless için optimize edilmiş pool ayarları
  const pool = new Pool({
    connectionString,
    max: 3, // Serverless için daha da düşük tutuyoruz
    idleTimeoutMillis: 5000, // 5 saniye - daha kısa
    connectionTimeoutMillis: 5000, // 5 saniye
  })

  const adapter = new PrismaNeon(pool)

  prismaInstance = new PrismaClient({
    adapter,
    log: ['error'],
  })

  return prismaInstance
}

export async function disconnectPrisma(): Promise<void> {
  if (prismaInstance) {
    try {
      await prismaInstance.$disconnect()
    } catch (error) {
      console.error('Error disconnecting Prisma:', error)
    }
    prismaInstance = null
  }
}

/**
 * Timeout helper for database operations
 * Wraps a promise with a timeout to prevent hanging
 */
export const withTimeout = <T>(promise: Promise<T>, ms: number, operation = 'Database operation'): Promise<T> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${operation} timed out after ${ms}ms`))
    }, ms)

    promise
      .then((result) => {
        clearTimeout(timer)
        resolve(result)
      })
      .catch((error) => {
        clearTimeout(timer)
        reject(error)
      })
  })
}
