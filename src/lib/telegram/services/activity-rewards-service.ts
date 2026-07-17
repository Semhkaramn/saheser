import { prisma } from '@/lib/prisma'
import { sendTelegramMessage, pinChatMessage } from '../core'
import { isBotSystemEnabled } from '../bot-system-check'

// Manuel başlat/durdur ile çalışan aktiflik yarışması. Yarışma başladığı andan
// itibaren gruptaki her mesaj ActivityContestParticipant'ta sayılır; "Bitir"
// dendiğinde en aktif N kişi, tanımlı ödül metinleriyle birlikte duyurulur.

export async function getActivityContestSettings(groupId: string) {
  return prisma.activityContestSettings.findUnique({ where: { groupId } })
}

export async function getActivityRewards(groupId: string) {
  return prisma.activityContestReward.findMany({ where: { groupId }, orderBy: { rank: 'asc' } })
}

export async function setActivityReward(groupId: string, rank: number, rewardText: string) {
  return prisma.activityContestReward.upsert({
    where: { groupId_rank: { groupId, rank } },
    update: { rewardText },
    create: { groupId, rank, rewardText },
  })
}

export async function startActivityContest(groupId: string, topCount = 20, minCharCount = 10) {
  if (!(await isBotSystemEnabled('activity_rewards'))) return { ok: false as const, error: 'Aktiflik ödülleri sistemi kapalı' }

  const existing = await getActivityContestSettings(groupId)
  if (existing?.isRunning) return { ok: false as const, error: 'Bu grupta zaten çalışan bir yarışma var' }

  await prisma.activityContestParticipant.deleteMany({ where: { groupId } })
  await prisma.activityContestSettings.upsert({
    where: { groupId },
    update: { isRunning: true, topCount, minCharCount, startedAt: new Date(), endedAt: null },
    create: { groupId, isRunning: true, topCount, minCharCount, startedAt: new Date() },
  })

  return { ok: true as const }
}

/**
 * Yarışma açıkken her mesajda çağrılır (message-handler.ts içinden).
 */
export async function trackActivityContestMessage(groupId: string, telegramId: string, username: string | null, firstName: string | null, messageText: string) {
  const settings = await getActivityContestSettings(groupId)
  if (!settings?.isRunning) return
  if (!messageText || messageText.trim().length < settings.minCharCount) return

  await prisma.activityContestParticipant.upsert({
    where: { groupId_telegramId: { groupId, telegramId } },
    update: { messageCount: { increment: 1 }, username: username || undefined, firstName: firstName || undefined },
    create: { groupId, telegramId, username, firstName, messageCount: 1 },
  })
}

/**
 * Yarışmayı bitirmeden mevcut anlık sıralamayı döndürür (randy-web'deki
 * ".aktiflik" komutu için - sadece görüntüleme, yarışmayı durdurmaz).
 */
export async function getActivityContestLeaderboard(groupId: string) {
  const settings = await getActivityContestSettings(groupId)
  const topUsers = await prisma.activityContestParticipant.findMany({
    where: { groupId },
    orderBy: { messageCount: 'desc' },
    take: settings?.topCount || 20,
  })
  const rewards = await getActivityRewards(groupId)
  const rewardMap = new Map(rewards.map((r) => [r.rank, r.rewardText]))

  return {
    isRunning: settings?.isRunning ?? false,
    startedAt: settings?.startedAt ?? null,
    hasData: topUsers.length > 0,
    leaderboard: topUsers.map((u, i) => ({
      rank: i + 1,
      telegramId: u.telegramId,
      username: u.username,
      firstName: u.firstName,
      messageCount: u.messageCount,
      reward: rewardMap.get(i + 1) || null,
    })),
  }
}

export async function stopActivityContestAndAnnounce(groupId: string) {
  const settings = await getActivityContestSettings(groupId)
  if (!settings?.isRunning) return { ok: false as const, error: 'Çalışan bir yarışma yok' }

  const topUsers = await prisma.activityContestParticipant.findMany({
    where: { groupId },
    orderBy: { messageCount: 'desc' },
    take: settings.topCount,
  })

  const rewards = await getActivityRewards(groupId)
  const rewardMap = new Map(rewards.map((r) => [r.rank, r.rewardText]))

  await prisma.activityContestSettings.update({ where: { groupId }, data: { isRunning: false, endedAt: new Date() } })

  if (topUsers.length === 0) {
    return { ok: true as const, message: null }
  }

  const lines = ['🏆 <b>Aktiflik Yarışması Sonuçları</b>', '']
  topUsers.forEach((u, i) => {
    const name = u.username ? `@${u.username}` : (u.firstName || u.telegramId)
    const reward = rewardMap.get(i + 1)
    lines.push(`${i + 1}. ${name} — ${u.messageCount} mesaj${reward ? ` → 🎁 ${reward}` : ''}`)
  })

  const text = lines.join('\n')
  const sent = await sendTelegramMessage(groupId, text)
  if (sent?.message_id) {
    await pinChatMessage(groupId, sent.message_id).catch(() => {})
  }

  return { ok: true as const, message: text }
}
