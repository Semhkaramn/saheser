import { prisma } from '@/lib/prisma'
import { sendTelegramMessage, pinChatMessage } from '../core'
import { isBotSystemEnabled } from '../bot-system-check'

// Manuel başlat/durdur ile çalışan aktiflik yarışması. Yarışma başladığı andan
// itibaren gruptaki her mesaj (ayarlanan min karakter / min cümle şartlarını
// geçerse) ActivityContestParticipant'ta sayılır; "Bitir" dendiğinde en aktif
// N kişi, tanımlı ödül metinleriyle (ve varsa otomatik puanla) birlikte
// duyurulur.

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

export async function setActivityRewardPoints(groupId: string, rank: number, pointsReward: number) {
  return prisma.activityContestReward.upsert({
    where: { groupId_rank: { groupId, rank } },
    update: { pointsReward },
    create: { groupId, rank, rewardText: '', pointsReward },
  })
}

export async function clearActivityReward(groupId: string, rank: number) {
  await prisma.activityContestReward.deleteMany({ where: { groupId, rank } })
}

/**
 * Yarışma başlamadan/başlarken min karakter, min cümle gibi ayarları
 * güncellemek için. Kısmi güncelleme yapılabilir (sadece verilen alanlar
 * değişir).
 */
export async function setActivityContestOptions(
  groupId: string,
  options: Partial<{
    topCount: number
    minCharCount: number
    minCharEnabled: boolean
    minSentenceCount: number
    minSentenceEnabled: boolean
  }>
) {
  return prisma.activityContestSettings.upsert({
    where: { groupId },
    update: options,
    create: {
      groupId,
      topCount: options.topCount ?? 20,
      minCharCount: options.minCharCount ?? 10,
      minCharEnabled: options.minCharEnabled ?? true,
      minSentenceCount: options.minSentenceCount ?? 2,
      minSentenceEnabled: options.minSentenceEnabled ?? false,
    },
  })
}

export async function startActivityContest(groupId: string, topCount?: number) {
  if (!(await isBotSystemEnabled('activity_rewards'))) return { ok: false as const, error: 'Aktiflik ödülleri sistemi kapalı' }

  const existing = await getActivityContestSettings(groupId)
  if (existing?.isRunning) return { ok: false as const, error: 'Bu grupta zaten çalışan bir yarışma var' }

  await prisma.activityContestParticipant.deleteMany({ where: { groupId } })
  await prisma.activityContestSettings.upsert({
    where: { groupId },
    update: { isRunning: true, topCount: topCount ?? existing?.topCount ?? 20, startedAt: new Date(), endedAt: null },
    create: { groupId, isRunning: true, topCount: topCount ?? 20, startedAt: new Date() },
  })

  return { ok: true as const }
}

/**
 * Bir metindeki cümle sayısını hesaplar. Cümle sonu noktalama işaretlerine
 * (. ! ? …) göre böler, boş parçaları saymaz. Noktalama hiç yoksa ve metin
 * doluysa 1 cümle kabul edilir.
 */
export function countSentences(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  const parts = trimmed.split(/[.!?…]+/).map((p) => p.trim()).filter(Boolean)
  return parts.length > 0 ? parts.length : 1
}

/**
 * Yarışma açıkken her mesajda çağrılır (message-handler.ts içinden).
 * minCharEnabled açıksa mesaj minCharCount'tan kısa olamaz;
 * minSentenceEnabled açıksa mesaj minSentenceCount'tan az cümle içeremez.
 * İkisi de kapalıysa her mesaj sayılır.
 */
export async function trackActivityContestMessage(groupId: string, telegramId: string, username: string | null, firstName: string | null, messageText: string) {
  const settings = await getActivityContestSettings(groupId)
  if (!settings?.isRunning) return

  const text = messageText || ''

  if (settings.minCharEnabled && text.trim().length < settings.minCharCount) return
  if (settings.minSentenceEnabled && countSentences(text) < settings.minSentenceCount) return

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
  const rewardMap = new Map(rewards.map((r) => [r.rank, r]))

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
      reward: rewardMap.get(i + 1)?.rewardText || null,
      pointsReward: rewardMap.get(i + 1)?.pointsReward || 0,
    })),
  }
}

/**
 * Kazanan bir kullanıcıya, bağlı site hesabı varsa, otomatik puan ekler.
 * Bağlı hesap yoksa sessizce atlanır (puan kaybolmaz, sadece verilemez).
 */
async function awardPointsToTelegramUser(telegramId: string, points: number, rank: number, groupId: string) {
  if (points <= 0) return

  const tgUser = await prisma.telegramGroupUser.findUnique({
    where: { telegramId },
    select: { linkedUserId: true },
  })
  if (!tgUser?.linkedUserId) return

  await prisma.user.update({
    where: { id: tgUser.linkedUserId },
    data: { points: { increment: points } },
  })

  await prisma.pointHistory.create({
    data: {
      userId: tgUser.linkedUserId,
      amount: points,
      type: 'activity_contest',
      description: `Aktiflik yarışması ${rank}. sıra ödülü`,
      relatedId: groupId,
    },
  })
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
  const rewardMap = new Map(rewards.map((r) => [r.rank, r]))

  await prisma.activityContestSettings.update({ where: { groupId }, data: { isRunning: false, endedAt: new Date() } })

  if (topUsers.length === 0) {
    return { ok: true as const, message: null }
  }

  // Otomatik puan ödülleri - duyurudan önce, sırayla eklenir.
  await Promise.all(
    topUsers.map((u, i) => {
      const reward = rewardMap.get(i + 1)
      if (!reward?.pointsReward) return Promise.resolve()
      return awardPointsToTelegramUser(u.telegramId, reward.pointsReward, i + 1, groupId).catch((err) =>
        console.error('Aktiflik yarışması puan ödülü hatası:', err)
      )
    })
  )

  const lines = ['🏆 <b>Aktiflik Yarışması Sonuçları</b>', '']
  topUsers.forEach((u, i) => {
    const name = u.username ? `@${u.username}` : (u.firstName || u.telegramId)
    const reward = rewardMap.get(i + 1)
    const rewardParts: string[] = []
    if (reward?.rewardText) rewardParts.push(reward.rewardText)
    if (reward?.pointsReward) rewardParts.push(`+${reward.pointsReward} puan`)
    const rewardText = rewardParts.length > 0 ? ` → 🎁 ${rewardParts.join(' + ')}` : ''
    lines.push(`${i + 1}. ${name} — ${u.messageCount} mesaj${rewardText}`)
  })

  const text = lines.join('\n')
  const sent = await sendTelegramMessage(groupId, text)
  if (sent?.message_id) {
    await pinChatMessage(groupId, sent.message_id).catch(() => {})
  }

  return { ok: true as const, message: text }
}
