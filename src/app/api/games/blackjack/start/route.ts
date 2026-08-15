import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { startBlackjackGame } from '@/lib/services/games/blackjack-service'
import { gameErrorResponse } from '@/lib/services/games/game-engine'

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request)
    const body = await request.json()
    const result = await startBlackjackGame(
      session.userId,
      Number(body.betAmount),
      String(body.clientSeed || Math.random().toString(36).slice(2))
    )
    return NextResponse.json(result)
  } catch (error) {
    return gameErrorResponse(error)
  }
}
