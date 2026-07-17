import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function cleanupExpiredSessions() {
  try {
    console.log('🧹 Starting cleanup of expired admin sessions...')

    const result = await prisma.adminSession.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    })

    console.log(`✅ Deleted ${result.count} expired admin sessions`)
  } catch (error) {
    console.error('❌ Error cleaning up sessions:', error)
    throw error
  }
}

cleanupExpiredSessions()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
