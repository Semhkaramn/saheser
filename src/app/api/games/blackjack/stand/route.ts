import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { standBlackjack } from '@/lib/services/games/blackjack-service'
import { gameErrorResponse } from '@/lib/services/games/game-engine'

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request)
    const body = await request.json()
    const result = await standBlackjack(session.userId, String(body.gamePlayId))
    return NextResponse.json(result)
  } catch (error) {
    return gameErrorResponse(error)
  }
}
