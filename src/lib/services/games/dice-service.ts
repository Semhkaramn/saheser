/**
 * 🎲 Zar (Dice) Oyunu
 * Kullanıcı 0.00-100.00 arası bir hedef sayı ve yön (üst/alt) seçer.
 * Sonuç hedefe göre kazandırırsa çarpan uygulanır.
 */

import {
  placeBetAndResolveInstant,
  getGameSettings,
  generateServerSeed,
  hashServerSeed,
  fairRandom,
  GameError,
} from './game-engine'

export type DiceDirection = 'over' | 'under'

function calcWinChance(target: number, direction: DiceDirection): number {
  return direction === 'over' ? 100 - target : target
}

function calcMultiplier(target: number, direction: DiceDirection, houseEdgePercent: number): number {
  const winChance = calcWinChance(target, direction)
  const fairMultiplier = 100 / winChance
  return fairMultiplier * (1 - houseEdgePercent / 100)
}

export async function playDice(params: {
  userId: string
  betAmount: number
  target: number
  direction: DiceDirection
  clientSeed: string
}) {
  const { userId, betAmount, target, direction, clientSeed } = params
  const settings = await getGameSettings('dice')
  const minTarget = settings.extraSettings.minTarget ?? 2
  const maxTarget = settings.extraSettings.maxTarget ?? 98

  if (target < minTarget || target > maxTarget) {
    throw new GameError('INVALID_TARGET', `Hedef ${minTarget}-${maxTarget} arasında olmalı`)
  }

  const serverSeed = generateServerSeed()
  const serverSeedHash = hashServerSeed(serverSeed)
  const nonce = Math.floor(Math.random() * 1_000_000_000) // Int4 (postgres) sınırları içinde kalmalı

  // 0.00 - 100.00 arası sonuç (2 ondalık)
  const roll = Math.floor(fairRandom(serverSeed, clientSeed, nonce) * 10001) / 100

  const won = direction === 'over' ? roll > target : roll < target
  const multiplier = calcMultiplier(target, direction, settings.houseEdgePercent)
  const payout = won ? Math.floor(betAmount * multiplier) : 0

  const { finalPlay, newPoints } = await placeBetAndResolveInstant({
    userId,
    gameType: 'dice',
    betAmount,
    result: won ? 'win' : 'lose',
    payout,
    multiplier,
    details: { target, direction, roll },
    serverSeed,
    serverSeedHash,
    clientSeed,
    nonce,
  })

  return {
    roll,
    won,
    multiplier,
    payout,
    winChance: calcWinChance(target, direction),
    serverSeed,
    serverSeedHash,
    newPoints,
  }
}
