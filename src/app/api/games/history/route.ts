import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getUserGameHistory, gameErrorResponse, type GameType } from '@/lib/services/games/game-engine'

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request)
    const { searchParams } = new URL(request.url)
    const gameType = searchParams.get('gameType') as GameType | null
    const take = Number(searchParams.get('take') || 20)

    const history = await getUserGameHistory(session.userId, gameType || undefined, take)
    return NextResponse.json({ history })
  } catch (error) {
    return gameErrorResponse(error)
  }
}
