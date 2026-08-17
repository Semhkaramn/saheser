import { NextResponse } from 'next/server'
import { getGameSettings } from '@/lib/services/games/game-engine'

// Bu ayarlar admin panelinden istenilen an değişebilir (aç/kapat vb.),
// bu yüzden önbelleklenmemeli - her istekte veritabanından taze okunmalı.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const [mines, dice, roulette, blackjack] = await Promise.all([
    getGameSettings('mines'),
    getGameSettings('dice'),
    getGameSettings('roulette'),
    getGameSettings('blackjack'),
  ])
  return NextResponse.json(
    { mines, dice, roulette, blackjack },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
  )
}

