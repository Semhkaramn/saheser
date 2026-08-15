import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { startMinesGame } from '@/lib/services/games/mines-service'
import { gameErrorResponse } from '@/lib/services/games/game-engine'

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request)
    const body = await request.json()
    const betAmount = Number(body.betAmount)
    const mineCount = Number(body.mineCount)
    const clientSeed = String(body.clientSeed || Math.random().toString(36).slice(2))

    const result = await startMinesGame(session.userId, betAmount, mineCount, clientSeed)
    return NextResponse.json(result)
  } catch (error) {
    return gameErrorResponse(error)
  }
}
