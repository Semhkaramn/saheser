import { prisma } from '@/lib/prisma'
import { sendTelegramMessage, pinChatMessage } from '../core'
import { isBotSystemEnabled } from '../bot-system-check'

// Her hafta (varsayılan: Pazar akşamı) en aktif üyeleri otomatik duyurur.
// tamsite'de mesaj sayıları TelegramGroupUser.weeklyMessageCount üzerinden
// (tüm kayıtlı kullanıcılar için global) tutuluyor; bu servis o veriyi kullanır.

export async function getWeeklyRewardSettings(groupId: string) {
  return prisma.weeklyRewardSettings.findUnique({ where: { groupId } })
}

export async function setWeeklyRewardSettings(
  groupId: string,
  data: Partial<{ enabled: boolean; topCount: number; autoPostSunday: boolean; autoPin: boolean; postHour: number }>
) {
  return prisma.weeklyRewardSettings.upsert({
    where: { groupId },
    update: data,
    create: {
      groupId,
      enabled: data.enabled ?? false,
      topCount: data.topCount ?? 3,
      autoPostSunday: data.autoPostSunday ?? false,
      autoPin: data.autoPin ?? false,
      postHour: data.postHour ?? 20,
    },
  })
}

export async function getWeeklyRewards(groupId: string) {
  return prisma.weeklyReward.findMany({ where: { groupId }, orderBy: { rank: 'asc' } })
}

export async function setWeeklyReward(groupId: string, rank: number, rewardText: string) {
  return prisma.weeklyReward.upsert({
    where: { groupId_rank: { groupId, rank } },
    update: { rewardText },
    create: { groupId, rank, rewardText },
  })
}

export async function postWeeklyRewardAnnouncement(groupId: string): Promise<{ ok: boolean; message?: string }> {
  if (!(await isBotSystemEnabled('weekly_rewards'))) return { ok: false }

  const settings = await getWeeklyRewardSettings(groupId)
  if (!settings?.enabled) return { ok: false }

  const topUsers = await prisma.telegramGroupUser.findMany({
    where: { lastGroupId: groupId, weeklyMessageCount: { gt: 0 } },
    orderBy: { weeklyMessageCount: 'desc' },
    take: settings.topCount,
  })

  if (topUsers.length === 0) return { ok: false }

  const rewards = await getWeeklyRewards(groupId)
  const rewardMap = new Map(rewards.map((r) => [r.rank, r.rewardText]))

  const lines = ['🏆 <b>Haftalık Aktiflik Ödülleri</b>', '']
  topUsers.forEach((u, i) => {
    const name = u.username ? `@${u.username}` : (u.firstName || u.telegramId)
    const reward = rewardMap.get(i + 1)
    lines.push(`${i + 1}. ${name} — ${u.weeklyMessageCount} mesaj${reward ? ` → 🎁 ${reward}` : ''}`)
  })

  const text = lines.join('\n')
  const sent = await sendTelegramMessage(groupId, text)
  if (settings.autoPin && sent?.message_id) {
    await pinChatMessage(groupId, sent.message_id).catch(() => {})
  }

  return { ok: true, message: text }
}

/**
 * CRON job tarafından çağrılır: Türkiye saatine göre Pazar günü, ayarlanan
 * saatte, autoPostSunday açık olan tüm grupları duyurur.
 */
export async function runDueWeeklyRewardAnnouncements() {
  const allSettings = await prisma.weeklyRewardSettings.findMany({ where: { enabled: true, autoPostSunday: true } })
  const trNow = new Date(Date.now() + 3 * 3600_000)
  const isSunday = trNow.getUTCDay() === 0
  if (!isSunday) return { processed: 0 }

  const currentHour = trNow.getUTCHours()
  const due = allSettings.filter((s) => s.postHour === currentHour)

  const results = []
  for (const settings of due) {
    const result = await postWeeklyRewardAnnouncement(settings.groupId)
    results.push({ groupId: settings.groupId, ...result })
  }

  return { processed: results.length, results }
}
