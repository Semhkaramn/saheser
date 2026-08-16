import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getActivePendingGame, gameErrorResponse } from '@/lib/services/games/game-engine'

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request)
    const active = await getActivePendingGame(session.userId, 'mines')
    if (!active) return NextResponse.json({ active: null })

    const details = JSON.parse(active.details || '{}')
    return NextResponse.json({
      active: {
        gamePlayId: active.id,
        betAmount: active.betAmount,
        mineCount: details.mineCount,
        gridSize: details.gridSize,
        revealedTiles: details.revealedTiles || [],
        multiplier: details.currentMultiplier || 1,
      },
    })
  } catch (error) {
    return gameErrorResponse(error)
  }
}
