import { NextResponse } from 'next/server'
import { getGameSettings } from '@/lib/services/games/game-engine'

export const revalidate = 300

export async function GET() {
  const [mines, dice, roulette, blackjack] = await Promise.all([
    getGameSettings('mines'),
    getGameSettings('dice'),
    getGameSettings('roulette'),
    getGameSettings('blackjack'),
  ])
  return NextResponse.json({ mines, dice, roulette, blackjack })
}
