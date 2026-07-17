import { prisma } from '@/lib/prisma'
import type { BotSystemKey } from './bot-systems'

/**
 * Bir bot modülünün açık olup olmadığını kontrol eder.
 * Veritabanında kaydı yoksa varsayılan olarak AÇIK kabul edilir.
 */
export async function isBotSystemEnabled(key: BotSystemKey): Promise<boolean> {
  const setting = await prisma.botSystemSetting.findUnique({ where: { key } })
  return setting?.enabled ?? true
}
