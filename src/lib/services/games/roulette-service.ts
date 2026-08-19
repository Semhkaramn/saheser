/**
 * 🎡 Rulet Oyunu (Avrupa tipi - tek sıfır, 0-36)
 * Kullanıcı birden fazla bahis türünü aynı elde birleştirebilir
 * (örn. hem kırmızıya hem de tek sayıya aynı anda oynayabilir).
 */

import {
  placeBetAndResolveInstant,
  getGameSettings,
  generateServerSeed,
  hashServerSeed,
  fairRandom,
  GameError,
} from './game-engine'

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36])

export type RouletteBetType =
  | 'straight' // tek sayı (0-36) - value: number
  | 'red'
  | 'black'
  | 'even'
  | 'odd'
  | 'low' // 1-18
  | 'high' // 19-36
  | 'dozen1' // 1-12
  | 'dozen2' // 13-24
  | 'dozen3' // 25-36

export interface RouletteBet {
  type: RouletteBetType
  amount: number
  value?: number // sadece 'straight' için
}

const BASE_PAYOUTS: Record<RouletteBetType, number> = {
  straight: 36,
  red: 2,
  black: 2,
  even: 2,
  odd: 2,
  low: 2,
  high: 2,
  dozen1: 3,
  dozen2: 3,
  dozen3: 3,
}

function isColorRed(n: number): boolean {
  return RED_NUMBERS.has(n)
}

function betWins(bet: RouletteBet, spinResult: number): boolean {
  if (spinResult === 0) return bet.type === 'straight' && bet.value === 0

  switch (bet.type) {
    case 'straight':
      return bet.value === spinResult
    case 'red':
      return isColorRed(spinResult)
    case 'black':
      return !isColorRed(spinResult)
    case 'even':
      return spinResult % 2 === 0
    case 'odd':
      return spinResult % 2 === 1
    case 'low':
      return spinResult >= 1 && spinResult <= 18
    case 'high':
      return spinResult >= 19 && spinResult <= 36
    case 'dozen1':
      return spinResult >= 1 && spinResult <= 12
    case 'dozen2':
      return spinResult >= 13 && spinResult <= 24
    case 'dozen3':
      return spinResult >= 25 && spinResult <= 36
    default:
      return false
  }
}

export async function playRoulette(params: {
  userId: string
  bets: RouletteBet[]
  clientSeed: string
}) {
  const { userId, bets, clientSeed } = params

  if (!bets.length) throw new GameError('NO_BETS', 'En az bir bahis eklemelisin')
  if (bets.length > 12) throw new GameError('TOO_MANY_BETS', 'Çok fazla bahis türü')

  for (const bet of bets) {
    if (!Number.isInteger(bet.amount) || bet.amount <= 0) {
      throw new GameError('INVALID_BET', 'Geçersiz bahis miktarı')
    }
    if (bet.type === 'straight' && (bet.value === undefined || !Number.isInteger(bet.value) || bet.value < 0 || bet.value > 36)) {
      throw new GameError('INVALID_STRAIGHT_VALUE', 'Geçersiz sayı seçimi (0-36)')
    }
  }

  const totalBet = bets.reduce((sum, b) => sum + b.amount, 0)
  const settings = await getGameSettings('roulette')

  if (totalBet < settings.minBet) throw new GameError('BET_TOO_LOW', `Minimum toplam bahis: ${settings.minBet} puan`)
  if (totalBet > settings.maxBet) throw new GameError('BET_TOO_HIGH', `Maksimum toplam bahis: ${settings.maxBet} puan`)

  const serverSeed = generateServerSeed()
  const serverSeedHash = hashServerSeed(serverSeed)
  const nonce = Math.floor(Math.random() * 1_000_000_000) // Int4 (postgres) sınırları içinde kalmalı

  const roll = fairRandom(serverSeed, clientSeed, nonce)
  const spinResult = Math.floor(roll * 37) // 0-36

  let totalPayout = 0
  const betResults = bets.map((bet) => {
    const won = betWins(bet, spinResult)
    const payout = won ? bet.amount * BASE_PAYOUTS[bet.type] : 0
    totalPayout += payout
    return { ...bet, won, payout }
  })

  const won = totalPayout > 0
  const { newPoints } = await placeBetAndResolveInstant({
    userId,
    gameType: 'roulette',
    betAmount: totalBet,
    result: won ? 'win' : 'lose',
    payout: totalPayout,
    multiplier: totalBet > 0 ? totalPayout / totalBet : 0,
    details: { bets, spinResult, betResults },
    serverSeed,
    serverSeedHash,
    clientSeed,
    nonce,
  })

  return {
    spinResult,
    isRed: spinResult !== 0 ? isColorRed(spinResult) : null,
    betResults,
    totalBet,
    totalPayout,
    won,
    serverSeed,
    serverSeedHash,
    newPoints,
  }
}
