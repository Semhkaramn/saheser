import { prisma } from '@/lib/prisma'

// ============================================================
// Grup varsayılanları — bot DM'den "Randy Ayarları" menüsüyle ya da web
// panelinden BİR KEZ ayarlanır: duyuru mesajı, şart tipi, kazanan sayısı,
// puan, zorunlu kanallar. Grupta "/randy" yazınca bu varsayılanlarla Randy
// ANINDA başlar - admin hiçbir şeyi yeniden yazmaz. "/number 5" sadece
// kazanan sayısını değiştirmek için kullanılır.
// ============================================================

export async function getRandyGroupDefaults(groupId: string) {
  return prisma.randyGroupDefaults.findUnique({ where: { groupId } })
}

export async function setRandyGroupDefaults(
  groupId: string,
  data: Partial<{ message: string | null; messageEntitiesJson: string | null; requirementType: string; requiredMessageCount: number | null; winnerCount: number | null; pointsReward: number | null; pointsOnly: boolean; requireWebsiteMembership: boolean }>
) {
  return prisma.randyGroupDefaults.upsert({
    where: { groupId },
    update: data,
    create: { groupId, ...data },
  })
}

export async function listRandyGroupDefaultChannels(groupId: string) {
  const [channels, sponsorApprovalGroups] = await Promise.all([
    prisma.randyGroupDefaultChannel.findMany({ where: { groupId }, orderBy: { id: 'asc' } }),
    prisma.sponsor.findMany({ where: { approvalGroupId: { not: null } }, select: { approvalGroupId: true } }),
  ])
  const sponsorGroupIds = new Set(sponsorApprovalGroups.map((s: { approvalGroupId: string | null }) => s.approvalGroupId))
  // Manuel eklenmiş bir zorunlu kanal, sonradan bir sponsörün onay grubu
  // olarak atandıysa artık burada da görünmemeli/kullanılmamalı.
  return channels.filter((c: { channelId: string }) => !sponsorGroupIds.has(c.channelId))
}

export async function addRandyGroupDefaultChannel(groupId: string, channelId: string, channelUsername?: string | null, channelTitle?: string | null) {
  return prisma.randyGroupDefaultChannel.upsert({
    where: { groupId_channelId: { groupId, channelId } },
    update: { channelUsername, channelTitle },
    create: { groupId, channelId, channelUsername, channelTitle },
  })
}

export async function removeRandyGroupDefaultChannel(groupId: string, channelId: string) {
  await prisma.randyGroupDefaultChannel.deleteMany({ where: { groupId, channelId } })
}

/**
 * Grup varsayılanlarını (mesaj, şart, kazanan sayısı, puan, kanallar)
 * kullanarak ANINDA bir Randy oluşturup başlatır. "/randy" komutunun
 * tamamı budur - ek bir soru-cevap adımı yok.
 */
export async function startRandyFromDefaults(groupId: string): Promise<{ success: boolean; error?: string; randy?: any }> {
  const defaults = await getRandyGroupDefaults(groupId)

  if (!defaults?.message) {
    return {
      success: false,
      error: 'Önce Randy mesajını ayarlamalısın. Bota özelden /panel yaz -> bu grubu seç -> Randy Ayarları -> Randy Mesajını Ayarla. Ya da web panelinden ayarla.',
    }
  }
  if (!defaults.winnerCount || defaults.winnerCount < 1) {
    return {
      success: false,
      error: 'Önce kazanan sayısını ayarlamalısın: grupta "/number 5" gibi yaz (5 = kazanan sayısı), ya da bot DM panelinden ayarla.',
    }
  }

  const channels = await listRandyGroupDefaultChannels(groupId)

  // Grup varsayılanları randy-web tarzı tek bir requirementType alanı
  // kullanıyor (none/daily/weekly/monthly/all_time/post_randy). Randy modeli
  // bunu requirementType + messageCountPeriod + messageCountRequired +
  // postRandyMessages olarak ayrı alanlarda tutuyor - burada eşliyoruz.
  let requirementType = 'none'
  let messageCountPeriod: string | null = null
  let messageCountRequired: number | null = null
  let postRandyMessages: number | null = null

  if (defaults.requirementType === 'post_randy') {
    requirementType = 'post_randy_messages'
    postRandyMessages = defaults.requiredMessageCount || 1
  } else if (defaults.requirementType !== 'none') {
    requirementType = 'message_count'
    messageCountPeriod = defaults.requirementType
    messageCountRequired = defaults.requiredMessageCount || 1
  }

  const randy = await prisma.randy.create({
    data: {
      title: defaults.message.slice(0, 60),
      message: defaults.message,
      messageEntitiesJson: defaults.messageEntitiesJson,
      targetGroupId: groupId,
      requirementType,
      messageCountPeriod,
      messageCountRequired,
      postRandyMessages,
      requireChannelMembership: channels.length > 0,
      membershipCheckChannelIds: channels.length > 0 ? channels.map((c) => c.channelId).join(',') : null,
      winnerCount: defaults.winnerCount,
      prizePoints: defaults.pointsReward || 0,
      pointsOnly: defaults.pointsOnly || false,
      requireWebsiteMembership: defaults.requireWebsiteMembership || false,
      pinMessage: false,
      status: 'draft',
    },
  })

  const { startRandy } = await import('./randy-bot-service')
  const result = await startRandy(randy.id)
  return { ...result, randy: (result as any).randy }
}

// ============================================================
// Grupta minimal komut arayüzü: sadece /randy ve /number.
//   /randy       -> varsayılanlarla Randy'yi anında başlatır.
//   /number 5    -> varsayılan kazanan sayısını 5 yapar (Randy başlatmaz).
// ============================================================

export async function handleRandyGroupCommand(groupId: string, isAdmin: boolean): Promise<string> {
  if (!isAdmin) return ''

  const result = await startRandyFromDefaults(groupId)
  if (!result.success) {
    return `⚠️ ${result.error}`
  }
  return '' // startRandy zaten duyuru mesajını gruba gönderdi, ekstra bir şey söylemeye gerek yok
}

export async function handleNumberGroupCommand(groupId: string, isAdmin: boolean, text: string): Promise<string> {
  if (!isAdmin) return ''

  const match = text.match(/^\/number(@\w+)?(\s+(\d+))?/i)
  const winnerCount = match?.[3] ? Number(match[3]) : null

  if (!winnerCount || winnerCount < 1) {
    return '📝 Kullanım: <code>/number 5</code> (5 = varsayılan kazanan sayısı)'
  }

  await setRandyGroupDefaults(groupId, { winnerCount })

  // ✅ Sadece gelecekteki Randy'ler için varsayılanı değil, o an AKTİF olan
  // bir Randy varsa onun kazanan sayısını da anında güncelle - "Randy
  // başladıktan sonra da kazanan sayısı değişebilmeli" isteği için.
  const activeRandy = await prisma.randy.findFirst({ where: { targetGroupId: groupId, status: 'active' } })
  if (activeRandy) {
    await prisma.randy.update({ where: { id: activeRandy.id }, data: { winnerCount } })
    return `✅ Kazanan sayısı ${winnerCount} olarak güncellendi (hem şu an aktif olan Randy hem sonrakiler için).`
  }

  return `✅ Varsayılan kazanan sayısı ${winnerCount} olarak ayarlandı. Artık grupta /randy yazarak başlatabilirsin.`
}
