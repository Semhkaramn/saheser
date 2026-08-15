import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { playDice } from '@/lib/services/games/dice-service'
import { gameErrorResponse } from '@/lib/services/games/game-engine'

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request)
    const body = await request.json()
    const result = await playDice({
      userId: session.userId,
      betAmount: Number(body.betAmount),
      target: Number(body.target),
      direction: body.direction === 'over' ? 'over' : 'under',
      clientSeed: String(body.clientSeed || Math.random().toString(36).slice(2)),
    })
    return NextResponse.json(result)
  } catch (error) {
    return gameErrorResponse(error)
  }
}
