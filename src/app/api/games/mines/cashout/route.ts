import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { cashoutMinesGame } from '@/lib/services/games/mines-service'
import { gameErrorResponse } from '@/lib/services/games/game-engine'

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request)
    const body = await request.json()
    const result = await cashoutMinesGame(session.userId, String(body.gamePlayId))
    return NextResponse.json(result)
  } catch (error) {
    return gameErrorResponse(error)
  }
}
