/**
 * 💣 Mines Oyunu
 * 5x5 (25 hücre) ızgarada kullanıcı kaç mayın olacağını seçer, güvenli
 * hücreleri açtıkça çarpan artar. İstediği an "Al" (cashout) diyerek
 * biriken puanı alabilir; mayına basarsa bahsi kaybeder.
 */

import { prisma } from '@/lib/prisma'
import {
  placeBet,
  resolveGamePlay,
  getGameSettings,
  getActivePendingGame,
  generateServerSeed,
  hashServerSeed,
  fairRandomSequence,
  GameError,
} from './game-engine'

const GRID_SIZE = 25

interface MinesDetails {
  gridSize: number
  mineCount: number
  minePositions: number[] // sadece round bittiğinde client'a gönderilir
  revealedTiles: number[]
  currentMultiplier: number
}

/**
 * Kombinasyon bazlı adil çarpan hesabı (house edge dahil).
 * safePicks: o ana kadar açılan güvenli hücre sayısı
 */
function calcMultiplier(mineCount: number, safePicks: number, houseEdgePercent: number): number {
  const safeCount = GRID_SIZE - mineCount
  if (safePicks === 0) return 1
  let probability = 1
  for (let i = 0; i < safePicks; i++) {
    probability *= (safeCount - i) / (GRID_SIZE - i)
  }
  const fairMultiplier = 1 / probability
  const houseEdgeMultiplier = 1 - houseEdgePercent / 100
  return Math.max(1, fairMultiplier * houseEdgeMultiplier)
}

export async function startMinesGame(userId: string, betAmount: number, mineCount: number, clientSeed: string) {
  // Yarım kalmış bir el varsa (sayfa yenilendi/kapatıldı vb.) yeni oyun açmak yerine
  // mevcut eli kaldığı yerden devam ettirmesi için geri döndür.
  const existing = await getActivePendingGame(userId, 'mines')
  if (existing) {
    const existingDetails: MinesDetails = JSON.parse(existing.details || '{}')
    return {
      resumed: true as const,
      gamePlayId: existing.id,
      mineCount: existingDetails.mineCount,
      gridSize: existingDetails.gridSize,
      betAmount: existing.betAmount,
      revealedTiles: existingDetails.revealedTiles,
      multiplier: existingDetails.currentMultiplier,
    }
  }

  const settings = await getGameSettings('mines')
  const min = settings.extraSettings.minMines ?? 1
  const max = settings.extraSettings.maxMines ?? 24

  if (!Number.isInteger(mineCount) || mineCount < min || mineCount > max) {
    throw new GameError('INVALID_MINE_COUNT', `Mayın sayısı ${min}-${max} arasında olmalı`)
  }

  const serverSeed = generateServerSeed()
  const serverSeedHash = hashServerSeed(serverSeed)

  // Mayın konumlarını fair random ile belirle (Fisher-Yates benzeri seçim)
  const positions = Array.from({ length: GRID_SIZE }, (_, i) => i)
  const randoms = fairRandomSequence(serverSeed, clientSeed, 0, GRID_SIZE)
  for (let i = GRID_SIZE - 1; i > 0; i--) {
    const j = Math.floor(randoms[i] * (i + 1))
    ;[positions[i], positions[j]] = [positions[j], positions[i]]
  }
  const minePositions = positions.slice(0, mineCount).sort((a, b) => a - b)

  const details: MinesDetails = {
    gridSize: GRID_SIZE,
    mineCount,
    minePositions,
    revealedTiles: [],
    currentMultiplier: 1,
  }

  const { gamePlay, remainingPoints } = await placeBet({
    userId,
    gameType: 'mines',
    betAmount,
    details,
    serverSeed,
    serverSeedHash,
    clientSeed,
    nonce: 0,
  })

  return {
    resumed: false as const,
    gamePlayId: gamePlay.id,
    serverSeedHash, // serverSeed round bitmeden ASLA client'a gönderilmez
    mineCount,
    gridSize: GRID_SIZE,
    remainingPoints,
  }
}

export async function revealMinesTile(userId: string, gamePlayId: string, tileIndex: number) {
  const gamePlay = await prisma.gamePlay.findUnique({ where: { id: gamePlayId } })
  if (!gamePlay || gamePlay.userId !== userId) throw new GameError('GAMEPLAY_NOT_FOUND', 'Oyun bulunamadı')
  if (gamePlay.gameType !== 'mines') throw new GameError('INVALID_GAME', 'Geçersiz oyun')
  if (gamePlay.result !== 'pending') throw new GameError('ALREADY_RESOLVED', 'Bu el zaten bitti')

  const details: MinesDetails = JSON.parse(gamePlay.details || '{}')

  if (tileIndex < 0 || tileIndex >= details.gridSize) {
    throw new GameError('INVALID_TILE', 'Geçersiz hücre')
  }
  if (details.revealedTiles.includes(tileIndex)) {
    throw new GameError('TILE_ALREADY_REVEALED', 'Bu hücre zaten açık')
  }

  const settings = await getGameSettings('mines')
  const hitMine = details.minePositions.includes(tileIndex)

  if (hitMine) {
    // Kaybetti - tüm mayınları göster, bahis zaten düşülmüştü
    await resolveGamePlay({
      gamePlayId,
      userId,
      result: 'lose',
      payout: 0,
      details: { revealedTiles: [...details.revealedTiles, tileIndex], hitTile: tileIndex },
    })

    return {
      hitMine: true,
      minePositions: details.minePositions,
      serverSeed: gamePlay.serverSeed,
    }
  }

  const newRevealed = [...details.revealedTiles, tileIndex]
  const newMultiplier = calcMultiplier(details.mineCount, newRevealed.length, settings.houseEdgePercent)
  const safeCount = details.gridSize - details.mineCount
  const isBoardCleared = newRevealed.length === safeCount

  const updatedDetails: MinesDetails = {
    ...details,
    revealedTiles: newRevealed,
    currentMultiplier: newMultiplier,
  }

  await prisma.gamePlay.update({
    where: { id: gamePlayId },
    data: { details: JSON.stringify(updatedDetails) },
  })

  // Tüm güvenli hücreler açıldıysa otomatik cashout
  if (isBoardCleared) {
    const payout = Math.floor(gamePlay.betAmount * newMultiplier)
    await resolveGamePlay({
      gamePlayId,
      userId,
      result: 'cashout',
      payout,
      multiplier: newMultiplier,
      details: { minePositions: details.minePositions },
    })
    return {
      hitMine: false,
      boardCleared: true,
      multiplier: newMultiplier,
      payout,
      minePositions: details.minePositions,
    }
  }

  return {
    hitMine: false,
    boardCleared: false,
    multiplier: newMultiplier,
    revealedTiles: newRevealed,
  }
}

export async function cashoutMinesGame(userId: string, gamePlayId: string) {
  const gamePlay = await prisma.gamePlay.findUnique({ where: { id: gamePlayId } })
  if (!gamePlay || gamePlay.userId !== userId) throw new GameError('GAMEPLAY_NOT_FOUND', 'Oyun bulunamadı')
  if (gamePlay.result !== 'pending') throw new GameError('ALREADY_RESOLVED', 'Bu el zaten bitti')

  const details: MinesDetails = JSON.parse(gamePlay.details || '{}')
  if (details.revealedTiles.length === 0) {
    throw new GameError('NO_TILES_REVEALED', 'Önce en az bir hücre açmalısın')
  }

  const payout = Math.floor(gamePlay.betAmount * details.currentMultiplier)

  await resolveGamePlay({
    gamePlayId,
    userId,
    result: 'cashout',
    payout,
    multiplier: details.currentMultiplier,
    details: { minePositions: details.minePositions },
  })

  return {
    payout,
    multiplier: details.currentMultiplier,
    minePositions: details.minePositions,
    serverSeed: gamePlay.serverSeed,
  }
}
