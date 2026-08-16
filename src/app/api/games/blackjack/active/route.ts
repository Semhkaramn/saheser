import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getActivePendingGame, gameErrorResponse } from '@/lib/services/games/game-engine'
import { handValue } from '@/lib/services/games/blackjack-service'

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request)
    const active = await getActivePendingGame(session.userId, 'blackjack')
    if (!active) return NextResponse.json({ active: null })

    const details = JSON.parse(active.details || '{}')
    return NextResponse.json({
      active: {
        gamePlayId: active.id,
        betAmount: active.betAmount,
        playerHand: details.playerHand,
        dealerUpcard: details.dealerHand?.[0],
        playerValue: handValue(details.playerHand || []),
        canDouble: (details.playerHand || []).length === 2 && !details.doubled,
      },
    })
  } catch (error) {
    return gameErrorResponse(error)
  }
}
