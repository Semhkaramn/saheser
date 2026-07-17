import { prisma } from '@/lib/prisma'
import { banUserFromChat, unbanUserFromChat } from '../core'
import { isBotSystemEnabled } from '../bot-system-check'

// randy-web'deki crossBan servisinden uyarlandı.
// Bir grupta biri banlanınca (kicked), botun aktif olduğu diğer tüm
// grup/kanallardan da otomatik banlanır.
//
// DÖNGÜ KORUMASI: banUserFromChat çağrımız da Telegram'dan chat_member
// güncellemesi tetikleyebilir, bu da tekrar çapraz ban akışını başlatıp
// gruplar arası gereksiz zincire yol açabilir. Bunu önlemek için: aynı
// kullanıcı için son 60 saniye içinde zaten bir çapraz ban kaydı varsa,
// yeni tetiklenen olay tamamen atlanır.

const LOOP_GUARD_WINDOW_MS = 10_000

export async function isCrossBanEnabled(groupId: string): Promise<boolean> {
  const settings = await prisma.crossBanSettings.findUnique({ where: { groupId } })
  return settings?.enabled ?? true // varsayılan: bot eklenen her grup ağa dahil
}

export async function setCrossBanEnabled(groupId: string, enabled: boolean) {
  await prisma.crossBanSettings.upsert({
    where: { groupId },
    update: { enabled },
    create: { groupId, enabled },
  })
}

async function getCrossBanNetworkGroups(excludeGroupId: string) {
  const groups = await prisma.telegramGroup.findMany({ where: { isActive: true, groupId: { not: excludeGroupId } } })

  // Sponsor onay kartlarının gönderildiği gruplar tek amaçlı - orada hiçbir
  // moderasyon işlemi (ban dahil) yapılmamalı, çapraz ban hedefi olmasınlar.
  const sponsorApprovalGroups = await prisma.sponsor.findMany({
    where: { approvalGroupId: { not: null } },
    select: { approvalGroupId: true },
  })
  const sponsorGroupIds = new Set(sponsorApprovalGroups.map((s: { approvalGroupId: string | null }) => s.approvalGroupId))
  const nonSponsorGroups = groups.filter((g) => !sponsorGroupIds.has(g.groupId))

  const settings = await prisma.crossBanSettings.findMany({ where: { groupId: { in: nonSponsorGroups.map((g) => g.groupId) } } })
  const disabledSet = new Set(settings.filter((s) => !s.enabled).map((s) => s.groupId))
  return nonSponsorGroups.filter((g) => !disabledSet.has(g.groupId))
}

export async function listCrossBanChannels() {
  return prisma.crossBanChannel.findMany({ orderBy: { createdAt: 'desc' } })
}

export async function addCrossBanChannel(channelId: string, title?: string | null, username?: string | null) {
  return prisma.crossBanChannel.upsert({
    where: { channelId },
    update: { title, username },
    create: { channelId, title, username },
  })
}

export async function removeCrossBanChannel(id: number) {
  return prisma.crossBanChannel.delete({ where: { id } })
}

async function getEnabledCrossBanChannels() {
  return prisma.crossBanChannel.findMany({ where: { enabled: true } })
}

// ⚠️ FIX: Eskiden bu kontrol "action" farkına bakmadan, kullanıcı için SON
// 60 saniyede HERHANGİ bir kayıt varsa (ban ya da unban, fark etmez) yeni
// işlemi tamamen atlıyordu. Bu, "unban yap, hemen arkasından tekrar banla"
// gibi tamamen normal, art arda gelen İKİ FARKLI işlemi de yanlışlıkla
// "döngü" sanıp ikincisini engelliyordu. Artık sadece AYNI işlem (ban->ban
// ya da unban->unban) kısa sürede tekrarlanırsa engelleniyor - botun kendi
// çapraz işlemlerinin geri yansıyıp sonsuz zincire dönüşmesini önlemek için
// zaten bu kadarı yeterli, farklı işlemleri (ban sonrası unban ya da tam
// tersi) engellemesine hiç gerek yok.
async function wasRecentlyCrossBanned(telegramId: string, action: 'ban' | 'unban'): Promise<boolean> {
  const cutoff = new Date(Date.now() - LOOP_GUARD_WINDOW_MS)
  const recent = await prisma.crossBanLog.findFirst({ where: { telegramId, action, createdAt: { gte: cutoff } } })
  return Boolean(recent)
}

export interface CrossBanResult {
  triggered: boolean
  targetCount: number
  successCount: number
}

/**
 * Webhook'ta bir chat_member güncellemesi "banlandı" (kicked) olduğunda çağrılır.
 */
export async function executeCrossBan(
  sourceGroupId: string,
  telegramId: string,
  username: string | null,
  firstName: string | null
): Promise<CrossBanResult> {
  if (!(await isBotSystemEnabled('cross_ban'))) return { triggered: false, targetCount: 0, successCount: 0 }

  const sourceEnabled = await isCrossBanEnabled(sourceGroupId)
  if (!sourceEnabled) return { triggered: false, targetCount: 0, successCount: 0 }

  if (await wasRecentlyCrossBanned(telegramId, 'ban')) {
    return { triggered: false, targetCount: 0, successCount: 0 }
  }

  // Döngü korumasını hemen (banlamadan ÖNCE) kaydet
  const log = await prisma.crossBanLog.create({
    data: { telegramId, username, firstName, sourceGroupId, targetCount: 0, successCount: 0, action: 'ban' },
  })

  const targets = await getCrossBanNetworkGroups(sourceGroupId)
  const channelTargets = await getEnabledCrossBanChannels()
  let successCount = 0

  for (const target of targets) {
    const ok = await banUserFromChat(target.groupId, Number(telegramId))
    if (ok) successCount++
  }
  for (const channel of channelTargets) {
    const ok = await banUserFromChat(channel.channelId, Number(telegramId))
    if (ok) successCount++
  }

  const totalTargets = targets.length + channelTargets.length

  await prisma.crossBanLog.update({
    where: { id: log.id },
    data: { targetCount: totalTargets, successCount },
  })

  return { triggered: true, targetCount: totalTargets, successCount }
}

export async function getRecentCrossBans(limit = 30) {
  return prisma.crossBanLog.findMany({ orderBy: { createdAt: 'desc' }, take: limit })
}

/**
 * Webhook'ta bir chat_member güncellemesi "kicked" durumundan ÇIKTIĞINDA
 * (yani ban kaldırıldığında) çağrılır - executeCrossBan'in tam tersi.
 * Aynı döngü korumasını (crossBanLog) paylaşıyor - bir ban/unban zinciri
 * kendi kendini tetiklemesin diye.
 */
export async function executeCrossUnban(
  sourceGroupId: string,
  telegramId: string,
  username: string | null,
  firstName: string | null
): Promise<CrossBanResult> {
  if (!(await isBotSystemEnabled('cross_ban'))) return { triggered: false, targetCount: 0, successCount: 0 }

  const sourceEnabled = await isCrossBanEnabled(sourceGroupId)
  if (!sourceEnabled) return { triggered: false, targetCount: 0, successCount: 0 }

  if (await wasRecentlyCrossBanned(telegramId, 'unban')) {
    return { triggered: false, targetCount: 0, successCount: 0 }
  }

  // Döngü korumasını hemen (unban'lamadan ÖNCE) kaydet
  const log = await prisma.crossBanLog.create({
    data: { telegramId, username, firstName, sourceGroupId, targetCount: 0, successCount: 0, action: 'unban' },
  })

  const targets = await getCrossBanNetworkGroups(sourceGroupId)
  const channelTargets = await getEnabledCrossBanChannels()
  let successCount = 0

  for (const target of targets) {
    const ok = await unbanUserFromChat(target.groupId, Number(telegramId))
    if (ok) successCount++
  }
  for (const channel of channelTargets) {
    const ok = await unbanUserFromChat(channel.channelId, Number(telegramId))
    if (ok) successCount++
  }

  const totalTargets = targets.length + channelTargets.length

  await prisma.crossBanLog.update({
    where: { id: log.id },
    data: { targetCount: totalTargets, successCount },
  })

  return { triggered: true, targetCount: totalTargets, successCount }
}
