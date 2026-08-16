/**
 * 🃏 Blackjack Oyunu (klasik kurallar)
 * - Çoklu deste (varsayılan 6), her elde yeniden karılır (basitlik ve adillik için)
 * - Dealer 17'de durur (soft 17 dahil durur)
 * - Blackjack (ilk 2 kartla 21) 3:2 öder
 * - Double (2 katına çıkarma) ilk 2 kartta desteklenir
 */

import type { Prisma } from '@prisma/client'
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

export type Suit = '♠' | '♥' | '♦' | '♣'
export interface Card {
  rank: string // 'A','2'..'10','J','Q','K'
  suit: Suit
}

interface BlackjackDetails {
  deck: Card[] // kalan kartlar (üstten çekilir)
  playerHand: Card[]
  dealerHand: Card[]
  status: 'playing' | 'dealer_turn' | 'done'
  doubled: boolean
  clientSeed: string
  cursor: number
}

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const SUITS: Suit[] = ['♠', '♥', '♦', '♣']

function buildShuffledDeck(serverSeed: string, clientSeed: string, deckCount: number): Card[] {
  const cards: Card[] = []
  for (let d = 0; d < deckCount; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({ rank, suit })
      }
    }
  }
  const randoms = fairRandomSequence(serverSeed, clientSeed, 0, cards.length)
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(randoms[i] * (i + 1))
    ;[cards[i], cards[j]] = [cards[j], cards[i]]
  }
  return cards
}

export function handValue(hand: Card[]): { total: number; isSoft: boolean } {
  let total = 0
  let aces = 0
  for (const card of hand) {
    if (card.rank === 'A') {
      aces++
      total += 11
    } else if (['J', 'Q', 'K'].includes(card.rank)) {
      total += 10
    } else {
      total += parseInt(card.rank, 10)
    }
  }
  let isSoft = aces > 0
  while (total > 21 && aces > 0) {
    total -= 10
    aces--
    isSoft = aces > 0
  }
  return { total, isSoft }
}

function isBlackjack(hand: Card[]): boolean {
  return hand.length === 2 && handValue(hand).total === 21
}

function drawCard(details: BlackjackDetails): Card {
  const card = details.deck.pop()
  if (!card) throw new GameError('DECK_EMPTY', 'Deste bitti, yeni el başlatın')
  return card
}

export async function startBlackjackGame(userId: string, betAmount: number, clientSeed: string) {
  // Yarım kalmış bir el varsa (sayfa yenilendi/kapatıldı vb.) yeni bahis almak yerine
  // mevcut eli döndür.
  const existing = await getActivePendingGame(userId, 'blackjack')
  if (existing) {
    const existingDetails: BlackjackDetails = JSON.parse(existing.details || '{}')
    return {
      resumed: true as const,
      gamePlayId: existing.id,
      playerHand: existingDetails.playerHand,
      dealerUpcard: existingDetails.dealerHand[0],
      playerValue: handValue(existingDetails.playerHand),
      status: 'playing' as const,
      canDouble: existingDetails.playerHand.length === 2 && !existingDetails.doubled,
    }
  }

  const settings = await getGameSettings('blackjack')
  const deckCount = settings.extraSettings.decks ?? 6

  const serverSeed = generateServerSeed()
  const serverSeedHash = hashServerSeed(serverSeed)
  const deck = buildShuffledDeck(serverSeed, clientSeed, deckCount)

  const playerHand = [deck.pop()!, deck.pop()!]
  const dealerHand = [deck.pop()!, deck.pop()!]

  const details: BlackjackDetails = {
    deck,
    playerHand,
    dealerHand,
    status: 'playing',
    doubled: false,
    clientSeed,
    cursor: deckCount * 52 - deck.length,
  }

  const { gamePlay, remainingPoints } = await placeBet({
    userId,
    gameType: 'blackjack',
    betAmount,
    details,
    serverSeed,
    serverSeedHash,
    clientSeed,
    nonce: 0,
  })

  const playerBJ = isBlackjack(playerHand)
  const dealerBJ = isBlackjack(dealerHand)

  // Açılışta blackjack varsa el hemen biter
  if (playerBJ || dealerBJ) {
    return finishRound(gamePlay.id, userId, details, betAmount, remainingPoints, true)
  }

  return {
    resumed: false as const,
    gamePlayId: gamePlay.id,
    playerHand,
    dealerUpcard: dealerHand[0], // dealer'ın ikinci kartı el bitene kadar gizli
    playerValue: handValue(playerHand),
    status: 'playing' as const,
    remainingPoints,
    canDouble: true,
  }
}

async function finishRound(
  gamePlayId: string,
  userId: string,
  details: BlackjackDetails,
  betAmount: number,
  currentPoints: number,
  immediateBJCheck = false
) {
  let { playerHand, dealerHand, deck } = details
  const playerValue = handValue(playerHand)
  const dealerValueInitial = handValue(dealerHand)

  let outcome: 'player_blackjack' | 'dealer_blackjack' | 'push' | 'player_bust' | 'dealer_bust' | 'player_win' | 'dealer_win'

  if (immediateBJCheck && (isBlackjack(playerHand) || isBlackjack(dealerHand))) {
    if (isBlackjack(playerHand) && isBlackjack(dealerHand)) outcome = 'push'
    else if (isBlackjack(playerHand)) outcome = 'player_blackjack'
    else outcome = 'dealer_blackjack'
  } else if (playerValue.total > 21) {
    outcome = 'player_bust'
  } else {
    // Dealer 17'ye kadar (soft 17 dahil dur) kart çeker
    let dealerValue = handValue(dealerHand)
    while (dealerValue.total < 17) {
      const card = deck.pop()
      if (!card) break
      dealerHand = [...dealerHand, card]
      dealerValue = handValue(dealerHand)
    }
    if (dealerValue.total > 21) outcome = 'dealer_bust'
    else if (dealerValue.total > playerValue.total) outcome = 'dealer_win'
    else if (dealerValue.total < playerValue.total) outcome = 'player_win'
    else outcome = 'push'
  }

  const betMultiplierMap: Record<typeof outcome, number> = {
    player_blackjack: 2.5, // 3:2 kazanç + orijinal bahis
    dealer_blackjack: 0,
    push: 1, // bahis iade
    player_bust: 0,
    dealer_bust: 2,
    player_win: 2,
    dealer_win: 0,
  } as any

  const multiplier = betMultiplierMap[outcome]
  const payout = Math.floor(betAmount * multiplier)
  const result: 'win' | 'lose' | 'cashout' = payout > betAmount ? 'win' : payout === betAmount ? 'cashout' : 'lose'

  const resolved = await resolveGamePlay({
    gamePlayId,
    userId,
    result,
    payout,
    multiplier,
    details: { playerHand, dealerHand, outcome },
  })

  return {
    gamePlayId,
    playerHand,
    dealerHand,
    playerValue: handValue(playerHand),
    dealerValue: handValue(dealerHand),
    outcome,
    payout,
    status: 'done' as const,
    newPoints: resolved.newPoints,
  }
}

async function loadPending(userId: string, gamePlayId: string) {
  const gamePlay = await prisma.gamePlay.findUnique({ where: { id: gamePlayId } })
  if (!gamePlay || gamePlay.userId !== userId) throw new GameError('GAMEPLAY_NOT_FOUND', 'Oyun bulunamadı')
  if (gamePlay.gameType !== 'blackjack') throw new GameError('INVALID_GAME', 'Geçersiz oyun')
  if (gamePlay.result !== 'pending') throw new GameError('ALREADY_RESOLVED', 'Bu el zaten bitti')
  const details: BlackjackDetails = JSON.parse(gamePlay.details || '{}')
  return { gamePlay, details }
}

export async function hitBlackjack(userId: string, gamePlayId: string) {
  const { gamePlay, details } = await loadPending(userId, gamePlayId)
  const card = drawCard(details)
  details.playerHand = [...details.playerHand, card]

  await prisma.gamePlay.update({ where: { id: gamePlayId }, data: { details: JSON.stringify(details) } })

  const value = handValue(details.playerHand)
  if (value.total > 21) {
    const final = await finishRound(gamePlayId, userId, details, gamePlay.betAmount, 0)
    return final
  }

  return {
    gamePlayId,
    playerHand: details.playerHand,
    dealerUpcard: details.dealerHand[0],
    playerValue: value,
    status: 'playing' as const,
    canDouble: false,
  }
}

export async function standBlackjack(userId: string, gamePlayId: string) {
  const { gamePlay, details } = await loadPending(userId, gamePlayId)
  return finishRound(gamePlayId, userId, details, gamePlay.betAmount, 0)
}

export async function doubleBlackjack(userId: string, gamePlayId: string) {
  const { gamePlay, details } = await loadPending(userId, gamePlayId)
  if (details.playerHand.length !== 2) throw new GameError('CANNOT_DOUBLE', 'Sadece ilk 2 kartla double yapılabilir')

  // Ek bahis miktarı kadar puan daha düş
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { points: true } })
    if (!user || user.points < gamePlay.betAmount) throw new GameError('INSUFFICIENT_POINTS', 'Double için yetersiz puan')
    await tx.user.update({ where: { id: userId }, data: { points: { decrement: gamePlay.betAmount } } })
    await tx.gamePlay.update({ where: { id: gamePlayId }, data: { betAmount: gamePlay.betAmount * 2 } })
  })

  const card = drawCard(details)
  details.playerHand = [...details.playerHand, card]
  details.doubled = true
  await prisma.gamePlay.update({ where: { id: gamePlayId }, data: { details: JSON.stringify(details) } })

  return finishRound(gamePlayId, userId, details, gamePlay.betAmount * 2, 0)
}
