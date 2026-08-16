/**
 * 🎮 Ortak Oyun Motoru (Mines / Zar / Rulet / Blackjack)
 *
 * ÖNEMLİ: Bu oyunlarda GERÇEK PARA YOKTUR. Sadece site içi puan kullanılır.
 * Puanlar yalnızca markette parasal değeri olmayan ürünlerle (rozet, avatar,
 * kozmetik vb.) değiştirilebilir. Bu dosya tüm oyunlar için ortak olan:
 *  - Ayar okuma (min/max bahis, house edge)
 *  - Sunucu taraflı adil rastgelelik (provably fair)
 *  - Bahis alma / puan iade etme transaction'ları
 *  - Kalıcı oyun geçmişi (GamePlay) kaydı
 * işlevlerini barındırır.
 */

import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { getTurkeyDate } from '@/lib/utils'
import { logActivity } from '@/lib/services/activity-log-service'
import { invalidateCache } from '@/lib/enhanced-cache'

export type GameType = 'mines' | 'dice' | 'roulette' | 'blackjack'

export interface GameSettingsResolved {
  gameType: GameType
  isEnabled: boolean
  minBet: number
  maxBet: number
  houseEdgePercent: number
  extraSettings: Record<string, any>
}

const DEFAULT_SETTINGS: Record<GameType, Omit<GameSettingsResolved, 'gameType'>> = {
  mines: {
    isEnabled: true,
    minBet: 10,
    maxBet: 10000,
    houseEdgePercent: 3,
    extraSettings: { gridSize: 25, minMines: 1, maxMines: 24 },
  },
  dice: {
    isEnabled: true,
    minBet: 10,
    maxBet: 10000,
    houseEdgePercent: 1,
    extraSettings: { minTarget: 2, maxTarget: 98 },
  },
  roulette: {
    isEnabled: true,
    minBet: 10,
    maxBet: 10000,
    houseEdgePercent: 2.7, // Avrupa ruleti tek sıfır
    extraSettings: {},
  },
  blackjack: {
    isEnabled: true,
    minBet: 10,
    maxBet: 10000,
    houseEdgePercent: 0.5,
    extraSettings: { decks: 6 },
  },
}

/**
 * Oyun ayarlarını getirir (yoksa varsayılanla birlikte DB'ye ilk kaydı oluşturur).
 */
export async function getGameSettings(gameType: GameType): Promise<GameSettingsResolved> {
  const existing = await prisma.gameSettings.findUnique({ where: { gameType } })

  if (!existing) {
    const defaults = DEFAULT_SETTINGS[gameType]
    const created = await prisma.gameSettings.create({
      data: {
        gameType,
        isEnabled: defaults.isEnabled,
        minBet: defaults.minBet,
        maxBet: defaults.maxBet,
        houseEdgePercent: defaults.houseEdgePercent,
        extraSettings: JSON.stringify(defaults.extraSettings),
      },
    })
    return {
      gameType,
      isEnabled: created.isEnabled,
      minBet: created.minBet,
      maxBet: created.maxBet,
      houseEdgePercent: created.houseEdgePercent,
      extraSettings: defaults.extraSettings,
    }
  }

  let extraSettings: Record<string, any> = {}
  try {
    extraSettings = existing.extraSettings ? JSON.parse(existing.extraSettings) : {}
  } catch {
    extraSettings = {}
  }

  return {
    gameType,
    isEnabled: existing.isEnabled,
    minBet: existing.minBet,
    maxBet: existing.maxBet,
    houseEdgePercent: existing.houseEdgePercent,
    extraSettings,
  }
}

/**
 * Provably-fair RNG: sunucu seed'i + istemci seed'i + nonce ile hash üretir.
 * Kullanıcı isterse serverSeedHash'i (oynamadan önce) ve sonrasında serverSeed'i
 * karşılaştırıp sonucun manipüle edilmediğini doğrulayabilir.
 */
export function generateServerSeed(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function hashServerSeed(serverSeed: string): string {
  return crypto.createHash('sha256').update(serverSeed).digest('hex')
}

/**
 * serverSeed:clientSeed:nonce kombinasyonundan 0-1 arası float üretir (HMAC tabanlı).
 */
export function fairRandom(serverSeed: string, clientSeed: string, nonce: number, cursor = 0): number {
  const hmac = crypto.createHmac('sha256', serverSeed).update(`${clientSeed}:${nonce}:${cursor}`).digest('hex')
  // İlk 8 hex karakteri (32 bit) kullanarak 0-1 arası float üret
  const slice = hmac.substring(0, 8)
  const intVal = parseInt(slice, 16)
  return intVal / 0xffffffff
}

/**
 * Bir sonraki fair random sayıyı almak için cursor'u artırarak dizi üretir.
 * Mines gibi birden fazla rastgele değer gereken oyunlarda kullanılır.
 */
export function fairRandomSequence(serverSeed: string, clientSeed: string, nonce: number, count: number): number[] {
  const result: number[] = []
  for (let i = 0; i < count; i++) {
    result.push(fairRandom(serverSeed, clientSeed, nonce, i))
  }
  return result
}

export class GameError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

/**
 * Zar/Rulet gibi TEK ADIMDA sonuçlanan oyunlar için: bahis alma + sonuçlandırma
 * AYNI veritabanı transaction'ı içinde yapılır. Böylece "bahis düşüldü ama
 * sonuç hiç işlenemedi, puan da geri gelmedi" gibi bir ara durumun oluşması
 * imkansız hale gelir — ya ikisi birden başarılı olur ya da hiçbiri olmaz.
 */
export async function placeBetAndResolveInstant(params: {
  userId: string
  gameType: GameType
  betAmount: number
  result: 'win' | 'lose'
  payout: number
  multiplier?: number
  details: Record<string, any>
  serverSeed: string
  serverSeedHash: string
  clientSeed: string
  nonce: number
}) {
  const { userId, gameType, betAmount, result, payout, multiplier, details, serverSeed, serverSeedHash, clientSeed, nonce } = params

  const settings = await getGameSettings(gameType)

  if (!settings.isEnabled) throw new GameError('GAME_DISABLED', 'Bu oyun şu anda kapalı')
  if (!Number.isInteger(betAmount) || betAmount <= 0) throw new GameError('INVALID_BET', 'Geçersiz bahis miktarı')
  if (betAmount < settings.minBet) throw new GameError('BET_TOO_LOW', `Minimum bahis: ${settings.minBet} puan`)
  if (betAmount > settings.maxBet) throw new GameError('BET_TOO_HIGH', `Maksimum bahis: ${settings.maxBet} puan`)

  const turkeyNow = getTurkeyDate()

  const { finalPlay, newPoints } = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true, points: true, isBanned: true } })
    if (!user) throw new GameError('USER_NOT_FOUND', 'Kullanıcı bulunamadı')
    if (user.isBanned) throw new GameError('USER_BANNED', 'Hesabınız kısıtlanmış')
    if (user.points < betAmount) throw new GameError('INSUFFICIENT_POINTS', 'Yetersiz puan bakiyesi')

    const netChange = payout - betAmount
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: { points: { increment: netChange } }, // kayıpta negatif, kazançta net pozitif/negatif fark
      select: { points: true },
    })

    const finalPlay = await tx.gamePlay.create({
      data: {
        userId,
        gameType,
        betAmount,
        payout,
        netChange,
        multiplier: multiplier ?? null,
        result,
        details: JSON.stringify(details),
        serverSeed,
        serverSeedHash,
        clientSeed,
        nonce,
        createdAt: turkeyNow,
        resolvedAt: turkeyNow,
      },
    })

    if (payout > 0) {
      await tx.pointHistory.create({
        data: {
          userId,
          amount: payout,
          type: `game_${gameType}_win`,
          description: `${gameLabel(gameType)} - kazanç`,
          relatedId: finalPlay.id,
          createdAt: turkeyNow,
        },
      })
    }

    return { finalPlay, newPoints: updatedUser.points }
  })

  invalidateCache.leaderboard()

  logActivity({
    userId,
    actionType: 'game_play',
    actionTitle: `${gameLabel(gameType)} oynadı`,
    actionDescription: result === 'lose' ? `${betAmount} puan bahis - kayıp` : `${betAmount} puan bahis, ${payout} puan kazanç`,
    relatedId: finalPlay.id,
    relatedType: 'game_play',
    metadata: { gameType, betAmount, payout, result, multiplier: multiplier ?? null },
  }).catch((err) => console.error('Game activity log error:', err))

  return { finalPlay, newPoints }
}

/**
 * Kullanıcının bahsini doğrular ve puanını düşerek "pending" bir GamePlay kaydı açar.
 * (Mines/Blackjack gibi çok adımlı oyunlarda bu kayıt daha sonra resolvePendingGamePlay
 * ile "win"/"lose" olarak kapatılır. Dice/Rulet gibi tek adımlı oyunlarda aynı transaction
 * içinde hemen sonuçlandırılabilir.)
 */
export async function placeBet(params: {
  userId: string
  gameType: GameType
  betAmount: number
  details?: Record<string, any>
  serverSeed?: string
  serverSeedHash?: string
  clientSeed?: string
  nonce?: number
}) {
  const { userId, gameType, betAmount, details, serverSeed, serverSeedHash, clientSeed, nonce } = params

  const settings = await getGameSettings(gameType)

  if (!settings.isEnabled) {
    throw new GameError('GAME_DISABLED', 'Bu oyun şu anda kapalı')
  }
  if (!Number.isInteger(betAmount) || betAmount <= 0) {
    throw new GameError('INVALID_BET', 'Geçersiz bahis miktarı')
  }
  if (betAmount < settings.minBet) {
    throw new GameError('BET_TOO_LOW', `Minimum bahis: ${settings.minBet} puan`)
  }
  if (betAmount > settings.maxBet) {
    throw new GameError('BET_TOO_HIGH', `Maksimum bahis: ${settings.maxBet} puan`)
  }

  const turkeyNow = getTurkeyDate()

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, points: true, isBanned: true },
    })

    if (!user) throw new GameError('USER_NOT_FOUND', 'Kullanıcı bulunamadı')
    if (user.isBanned) throw new GameError('USER_BANNED', 'Hesabınız kısıtlanmış')
    if (user.points < betAmount) throw new GameError('INSUFFICIENT_POINTS', 'Yetersiz puan bakiyesi')

    await tx.user.update({
      where: { id: userId },
      data: { points: { decrement: betAmount } },
    })

    const gamePlay = await tx.gamePlay.create({
      data: {
        userId,
        gameType,
        betAmount,
        payout: 0,
        netChange: -betAmount,
        result: 'pending',
        details: details ? JSON.stringify(details) : null,
        serverSeed: serverSeed || null,
        serverSeedHash: serverSeedHash || null,
        clientSeed: clientSeed || null,
        nonce: nonce ?? 0,
        createdAt: turkeyNow,
      },
    })

    return { gamePlay, remainingPoints: user.points - betAmount }
  })

  return result
}

/**
 * Açık (pending) bir GamePlay kaydını "win" / "lose" / "cashout" olarak kapatır
 * ve kazanılan puanı (varsa) kullanıcıya ekler. Her durumda kalıcı log bırakır.
 */
export async function resolveGamePlay(params: {
  gamePlayId: string
  userId: string
  result: 'win' | 'lose' | 'cashout'
  payout: number
  multiplier?: number
  details?: Record<string, any>
}) {
  const { gamePlayId, userId, result, payout, multiplier, details } = params
  const turkeyNow = getTurkeyDate()

  const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const gamePlay = await tx.gamePlay.findUnique({ where: { id: gamePlayId } })
    if (!gamePlay || gamePlay.userId !== userId) {
      throw new GameError('GAMEPLAY_NOT_FOUND', 'Oyun kaydı bulunamadı')
    }
    if (gamePlay.result !== 'pending') {
      throw new GameError('ALREADY_RESOLVED', 'Bu el zaten sonuçlandı')
    }

    let newPoints
    if (payout > 0) {
      const user = await tx.user.update({
        where: { id: userId },
        data: { points: { increment: payout } },
        select: { points: true },
      })
      newPoints = user.points
    } else {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { points: true } })
      newPoints = user?.points ?? 0
    }

    const mergedDetails = details
      ? JSON.stringify({ ...(gamePlay.details ? JSON.parse(gamePlay.details) : {}), ...details })
      : gamePlay.details

    const finalPlay = await tx.gamePlay.update({
      where: { id: gamePlayId },
      data: {
        result,
        payout,
        netChange: payout - gamePlay.betAmount,
        multiplier: multiplier ?? null,
        details: mergedDetails,
        resolvedAt: turkeyNow,
      },
    })

    if (payout > 0) {
      await tx.pointHistory.create({
        data: {
          userId,
          amount: payout,
          type: `game_${finalPlay.gameType}_win`,
          description: `${gameLabel(finalPlay.gameType as GameType)} - kazanç`,
          relatedId: finalPlay.id,
          createdAt: turkeyNow,
        },
      })
    }

    return { finalPlay, newPoints }
  })

  invalidateCache.leaderboard()

  logActivity({
    userId,
    actionType: 'game_play',
    actionTitle: `${gameLabel(updated.finalPlay.gameType as GameType)} oynadı`,
    actionDescription:
      result === 'lose'
        ? `${updated.finalPlay.betAmount} puan bahis - kayıp`
        : `${updated.finalPlay.betAmount} puan bahis, ${payout} puan kazanç`,
    relatedId: updated.finalPlay.id,
    relatedType: 'game_play',
    metadata: {
      gameType: updated.finalPlay.gameType,
      betAmount: updated.finalPlay.betAmount,
      payout,
      result,
      multiplier: multiplier ?? null,
    },
  }).catch((err) => console.error('Game activity log error:', err))

  return updated
}

/**
 * API route'larında ortak hata -> HTTP response çevirimi.
 */
export function gameErrorResponse(error: unknown) {
  if (error instanceof GameError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: 400 })
  }
  if (error instanceof Error && error.message === 'Unauthorized') {
    return NextResponse.json({ error: 'Oturum geçersiz. Lütfen tekrar giriş yapın.' }, { status: 401 })
  }
  console.error('Game API error:', error)
  return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
}

/**
 * Kullanıcının o oyun türünde yarım kalmış (pending) bir eli var mı kontrol eder.
 * Sayfa yenilenmesi/kapatılması durumunda oyunun kurtarılabilmesi için kullanılır.
 */
export async function getActivePendingGame(userId: string, gameType: GameType) {
  return prisma.gamePlay.findFirst({
    where: { userId, gameType, result: 'pending' },
    orderBy: { createdAt: 'desc' },
  })
}

export function gameLabel(gameType: GameType): string {
  switch (gameType) {
    case 'mines':
      return 'Mines'
    case 'dice':
      return 'Zar'
    case 'roulette':
      return 'Rulet'
    case 'blackjack':
      return 'Blackjack'
    default:
      return gameType
  }
}

/**
 * Kullanıcının oyun geçmişini getirir (profil / oyun sayfası için).
 */
export async function getUserGameHistory(userId: string, gameType?: GameType, take = 20) {
  return prisma.gamePlay.findMany({
    where: {
      userId,
      ...(gameType ? { gameType } : {}),
      result: { not: 'pending' },
    },
    orderBy: { createdAt: 'desc' },
    take,
  })
}
