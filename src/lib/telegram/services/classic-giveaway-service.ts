import { prisma } from '@/lib/prisma'
import { isBotSystemEnabled } from '../bot-system-check'

// randy-web'deki giveaway servisinden uyarlandı.
// Mantık: Başlangıç-bitiş arasında rastgele "kazanma anları" üretilir.
// O ana denk gelen ilk mesajı atan (admin olmayan) kişi ödülü kazanır.
// Arka planda bekleyen bir görev YOK — her mesajda checkAndAwardWinner
// çağrılıyor (message-handler.ts içinde).

export async function getClassicGiveawaySettings(groupId: string) {
  return prisma.classicGiveawaySettings.findUnique({ where: { groupId } })
}

export async function saveClassicGiveawaySettings(
  groupId: string,
  data: Partial<{ defaultDurationHours: number; defaultWinnerCount: number; maxWinsPerUser: number | null }>
) {
  return prisma.classicGiveawaySettings.upsert({
    where: { groupId },
    update: data,
    create: { groupId, ...data },
  })
}

export async function getActiveClassicGiveaway(groupId: string) {
  return prisma.classicGiveaway.findFirst({ where: { groupId, status: 'active' } })
}

function generateRandomWinTimes(start: Date, end: Date, count: number): Date[] {
  const totalSeconds = Math.floor((end.getTime() - start.getTime()) / 1000)
  const minGap = 300
  const minOffset = Math.min(300, Math.floor(totalSeconds / 4))
  const maxOffset = Math.max(120, Math.floor(totalSeconds / 10))
  const usableRange = totalSeconds - minOffset - maxOffset

  const evenlySpread = () => {
    const interval = Math.floor(totalSeconds / (count + 1))
    return Array.from({ length: count }, (_, i) => new Date(start.getTime() + interval * (i + 1) * 1000))
  }

  if (usableRange < 60 || usableRange < count * minGap) return evenlySpread()

  const used: number[] = []
  const times: Date[] = []

  for (let i = 0; i < count; i++) {
    let attempts = 0
    let placed = false
    while (attempts < 100) {
      const rand = minOffset + Math.floor(Math.random() * (totalSeconds - maxOffset - minOffset))
      if (used.every((u) => Math.abs(rand - u) >= minGap)) {
        used.push(rand)
        times.push(new Date(start.getTime() + rand * 1000))
        placed = true
        break
      }
      attempts++
    }
    if (!placed) {
      for (let s = minOffset; s < totalSeconds - maxOffset; s += 60) {
        if (used.every((u) => Math.abs(s - u) >= minGap)) {
          used.push(s)
          times.push(new Date(start.getTime() + s * 1000))
          break
        }
      }
    }
  }

  return times.sort((a, b) => a.getTime() - b.getTime())
}

export async function createClassicGiveaway(input: {
  groupId: string
  creatorTelegramId: string
  prizeText: string
  durationHours: number
  winnerCount: number
  maxWinsPerUser?: number
}) {
  if (!(await isBotSystemEnabled('classic_giveaway'))) return { ok: false as const, error: 'Klasik çekiliş sistemi şu anda kapalı' }

  const existing = await getActiveClassicGiveaway(input.groupId)
  if (existing) return { ok: false as const, error: 'Bu grupta zaten aktif bir çekiliş var' }

  const now = new Date()
  const endsAt = new Date(now.getTime() + input.durationHours * 3600_000)

  const giveaway = await prisma.classicGiveaway.create({
    data: {
      groupId: input.groupId,
      creatorTelegramId: input.creatorTelegramId,
      prizeText: input.prizeText,
      winnerCount: input.winnerCount,
      maxWinsPerUser: input.maxWinsPerUser ?? null,
      status: 'active',
      startedAt: now,
      endsAt,
    },
  })

  const winTimes = generateRandomWinTimes(now, endsAt, input.winnerCount)
  await prisma.classicGiveawayWinTime.createMany({
    data: winTimes.map((t, i) => ({ giveawayId: giveaway.id, winTime: t, slotNumber: i + 1 })),
  })

  return { ok: true as const, giveaway }
}

async function getPendingWinSlot(groupId: string) {
  const now = new Date()
  return prisma.classicGiveawayWinTime.findFirst({
    where: { isWon: false, winTime: { lte: now }, giveaway: { groupId, status: 'active' } },
    orderBy: { winTime: 'asc' },
    include: { giveaway: true },
  })
}

async function checkUserWinEligibility(groupId: string, telegramId: string, maxWins: number | null): Promise<boolean> {
  if (!maxWins) return true
  const record = await prisma.classicGiveawayUserWin.findUnique({ where: { groupId_telegramId: { groupId, telegramId } } })
  if (!record) return true
  return record.winCount < maxWins
}

export interface ClassicAwardResult {
  giveawayId: string
  prizeText: string
  pinWinnerMessage: boolean
}

/**
 * Her grup mesajında çağrılır. Bekleyen bir kazanma anı varsa ve kullanıcı
 * uygunsa, o mesajı atan kişi ödülü anında kazanır.
 */
export async function checkAndAwardClassicWinner(
  groupId: string,
  telegramId: string,
  username: string | null,
  firstName: string | null,
  isAdmin: boolean
): Promise<ClassicAwardResult | null> {
  if (isAdmin) return null

  const giveaway = await getActiveClassicGiveaway(groupId)
  if (!giveaway) return null

  const slot = await getPendingWinSlot(groupId)
  if (!slot) return null

  const eligible = await checkUserWinEligibility(groupId, telegramId, giveaway.maxWinsPerUser)
  if (!eligible) return null

  const now = new Date()

  await prisma.$transaction(async (tx) => {
    await tx.classicGiveawayWinTime.update({
      where: { id: slot.id },
      data: { winnerTelegramId: telegramId, winnerUsername: username, winnerFirstName: firstName, isWon: true, wonAt: now },
    })

    await tx.classicGiveawayUserWin.upsert({
      where: { groupId_telegramId: { groupId, telegramId } },
      update: { winCount: { increment: 1 }, lastWinAt: now },
      create: { groupId, telegramId, winCount: 1, lastWinAt: now },
    })

    const remaining = await tx.classicGiveawayWinTime.count({ where: { giveawayId: giveaway.id, isWon: false } })
    if (remaining === 0) {
      await tx.classicGiveaway.update({ where: { id: giveaway.id }, data: { status: 'ended', endedAt: now } })
    }
  })

  return { giveawayId: giveaway.id, prizeText: giveaway.prizeText, pinWinnerMessage: giveaway.pinWinnerMessage }
}

export async function endClassicGiveaway(id: string) {
  await prisma.classicGiveaway.update({ where: { id }, data: { status: 'ended', endedAt: new Date() } })
}

export async function cancelClassicGiveaway(id: string) {
  await prisma.classicGiveaway.update({ where: { id }, data: { status: 'cancelled', endedAt: new Date() } })
}

export async function getPastClassicGiveaways(groupId: string, limit = 10) {
  return prisma.classicGiveaway.findMany({
    where: { groupId, status: { in: ['ended', 'cancelled'] } },
    orderBy: { startedAt: 'desc' },
    take: limit,
    include: { winTimes: { where: { isWon: true } } },
  })
}
