import { prisma } from '@/lib/prisma'
import { sendTelegramMessage, pinChatMessage, checkTelegramAdmin, getGroupAdmins } from '../core'
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
    minWordCount: number
    minWordEnabled: boolean
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
      minWordCount: options.minWordCount ?? 3,
      minWordEnabled: options.minWordEnabled ?? false,
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
 * Bir metindeki kelime sayısını hesaplar. Boşluk karakterlerine (space, tab,
 * newline vb.) göre böler, birden fazla ardışık boşluğu tek boşluk gibi
 * sayar, boş parçaları saymaz.
 */
export function countWords(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).filter(Boolean).length
}

/**
 * Yarışma açıkken her mesajda çağrılır (message-handler.ts içinden).
 * Adminlerin mesajları sayılmaz (checkTelegramAdmin ile kontrol edilir).
 * minCharEnabled açıksa mesaj minCharCount'tan kısa olamaz;
 * minWordEnabled açıksa mesaj minWordCount'tan az kelime içeremez.
 * İkisi de kapalıysa (admin olmayan) her mesaj sayılır.
 */
export async function trackActivityContestMessage(groupId: string, telegramId: string, username: string | null, firstName: string | null, messageText: string) {
  const settings = await getActivityContestSettings(groupId)
  if (!settings?.isRunning) return

  // Adminler aktiflik yarışmasına dahil edilmez - mesajları sayılmaz.
  const isAdmin = await checkTelegramAdmin(Number(groupId), Number(telegramId))
  if (isAdmin) return

  const text = messageText || ''

  if (settings.minCharEnabled && text.trim().length < settings.minCharCount) return
  if (settings.minWordEnabled && countWords(text) < settings.minWordCount) return

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
  const topCount = settings?.topCount || 20

  // ⚠️ Admin filtresi SORGUDAN SONRA uygulanıyor, bu yüzden "take" ile erken
  // kesmiyoruz - yoksa ilk N kişiden bazıları admin çıkarsa, admin olmayan
  // sıradaki kullanıcılar listeye hiç giremez. Önce geniş çekip filtreleyip
  // sonra topCount'a kesiyoruz.
  const allParticipants = await prisma.activityContestParticipant.findMany({
    where: { groupId },
    orderBy: { messageCount: 'desc' },
    take: 200,
  })

  const groupAdmins = await getGroupAdmins(groupId).catch(() => [])
  const adminIds = new Set(groupAdmins.map((a) => String(a.userId)))

  const topUsers = allParticipants
    .filter((u) => !adminIds.has(u.telegramId))
    .slice(0, topCount)

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

  // ⚠️ Aynı sebeple (bkz. getActivityContestLeaderboard) admin filtresini
  // "take" ile kesmeden önce değil, geniş çekip filtreledikten sonra uyguluyoruz.
  const allParticipants = await prisma.activityContestParticipant.findMany({
    where: { groupId },
    orderBy: { messageCount: 'desc' },
    take: 200,
  })

  const groupAdmins = await getGroupAdmins(groupId).catch(() => [])
  const adminIds = new Set(groupAdmins.map((a) => String(a.userId)))

  const topUsers = allParticipants
    .filter((u) => !adminIds.has(u.telegramId))
    .slice(0, settings.topCount)

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
    const name = u.username ? `@${u.username}` : `<a href="tg://user?id=${u.telegramId}">${u.firstName || 'Kullanıcı'}</a>`
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
