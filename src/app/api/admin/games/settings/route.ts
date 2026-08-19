import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/admin-middleware'
import type { GameType } from '@/lib/services/games/game-engine'
import { getGameSettings } from '@/lib/services/games/game-engine'

const VALID_TYPES: GameType[] = ['mines', 'dice', 'roulette', 'blackjack']

export async function GET(request: NextRequest) {
  const authCheck = await requirePermission(request, 'canAccessGames')
  if (authCheck.error) return authCheck.error

  try {
    const settings = await Promise.all(VALID_TYPES.map((t) => getGameSettings(t)))
    return NextResponse.json({ settings })
  } catch (error) {
    console.error('Admin game settings GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const authCheck = await requirePermission(request, 'canAccessGames')
  if (authCheck.error) return authCheck.error

  try {
    const body = await request.json()
    const { gameType, isEnabled, minBet, maxBet, houseEdgePercent, extraSettings } = body

    if (!VALID_TYPES.includes(gameType)) {
      return NextResponse.json({ error: 'Geçersiz oyun türü' }, { status: 400 })
    }

    // Sayısal alanlar için NaN/Infinity ve mantıksız değer koruması. Bu kontroller
    // olmadan (ör. bozuk bir istekle) minBet=NaN kaydedilebilir, bu da tüm bahis
    // limitlerini etkisiz hale getirir (NaN ile yapılan her karşılaştırma false döner).
    if (minBet !== undefined && (typeof minBet !== 'number' || !Number.isFinite(minBet) || minBet < 0)) {
      return NextResponse.json({ error: 'Geçersiz minimum bahis' }, { status: 400 })
    }
    if (maxBet !== undefined && (typeof maxBet !== 'number' || !Number.isFinite(maxBet) || maxBet < 0)) {
      return NextResponse.json({ error: 'Geçersiz maksimum bahis' }, { status: 400 })
    }
    if (typeof minBet === 'number' && typeof maxBet === 'number' && minBet > maxBet) {
      return NextResponse.json({ error: 'Minimum bahis, maksimum bahisten büyük olamaz' }, { status: 400 })
    }
    if (
      houseEdgePercent !== undefined &&
      (typeof houseEdgePercent !== 'number' || !Number.isFinite(houseEdgePercent) || houseEdgePercent < 0 || houseEdgePercent > 50)
    ) {
      return NextResponse.json({ error: 'House edge %0-50 arasında olmalı' }, { status: 400 })
    }

    const updated = await prisma.gameSettings.upsert({
      where: { gameType },
      update: {
        ...(typeof isEnabled === 'boolean' ? { isEnabled } : {}),
        ...(typeof minBet === 'number' ? { minBet } : {}),
        ...(typeof maxBet === 'number' ? { maxBet } : {}),
        ...(typeof houseEdgePercent === 'number' ? { houseEdgePercent } : {}),
        ...(extraSettings ? { extraSettings: JSON.stringify(extraSettings) } : {}),
      },
      create: {
        gameType,
        isEnabled: isEnabled ?? true,
        minBet: minBet ?? 10,
        maxBet: maxBet ?? 10000,
        houseEdgePercent: houseEdgePercent ?? 3,
        extraSettings: extraSettings ? JSON.stringify(extraSettings) : null,
      },
    })

    return NextResponse.json({ success: true, settings: updated })
  } catch (error) {
    console.error('Admin game settings PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
