import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTurkeyToday } from '@/lib/utils'
import { enhancedCache } from '@/lib/enhanced-cache'

// Sayfa adını veritabanı alanına eşle
function getPageField(page: string): string {
  const pageMap: Record<string, string> = {
    '/': 'homeVisits',
    '/shop': 'shopVisits',
    '/wheel': 'wheelVisits',
    '/tasks': 'tasksVisits',
    '/events': 'eventsVisits',
    '/leaderboard': 'leaderboardVisits',
    '/profile': 'profileVisits',
    '/tickets': 'ticketsVisits',
  }
  return pageMap[page] || 'homeVisits'
}

// 🚀 Günlük benzersiz ziyaretçi takibi için Set
const UNIQUE_VISITORS_CACHE_KEY = 'unique_visitors_today'

// Türkiye tarihini string olarak al (YYYY-MM-DD)
function getTurkeyDateString(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(new Date()) // "2024-12-17" formatında
}

// Benzersiz ziyaretçi Set'ini al veya oluştur
async function getUniqueVisitorsSet(): Promise<Set<string>> {
  const cached = await enhancedCache.get<{ visitors: string[], date: string }>(UNIQUE_VISITORS_CACHE_KEY)

  // Bugünün tarihini kontrol et (Türkiye saati) - yeni gün ise Set'i sıfırla
  const today = getTurkeyDateString()

  if (cached && cached.date === today) {
    return new Set(cached.visitors)
  }

  return new Set()
}

// Benzersiz ziyaretçi Set'ini kaydet
async function saveUniqueVisitorsSet(visitors: Set<string>): Promise<void> {
  const today = getTurkeyDateString()
  await enhancedCache.set(
    UNIQUE_VISITORS_CACHE_KEY,
    { visitors: Array.from(visitors), date: today },
    86400 // 24 saat
  )
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { page, visitorId, isFirstVisitToday } = body

    // Bugünün tarihini al (Türkiye saati)
    const today = getTurkeyToday()
    const pageField = getPageField(page || '/')

    // 🚀 Benzersiz ziyaretçi kontrolü
    let isNewUniqueVisitor = false
    if (visitorId && isFirstVisitToday) {
      const uniqueVisitors = await getUniqueVisitorsSet()
      if (!uniqueVisitors.has(visitorId)) {
        uniqueVisitors.add(visitorId)
        await saveUniqueVisitorsSet(uniqueVisitors)
        isNewUniqueVisitor = true
      }
    }

    // Günlük istatistiği upsert et (varsa güncelle, yoksa oluştur)
    // Benzersiz ziyaretçi varsa uniqueVisitors'ı da artır
    await prisma.dailyStats.upsert({
      where: { date: today },
      create: {
        date: today,
        totalVisits: 1,
        uniqueVisitors: isNewUniqueVisitor ? 1 : 0,
        [pageField]: 1,
      },
      update: {
        totalVisits: { increment: 1 },
        [pageField]: { increment: 1 },
        ...(isNewUniqueVisitor ? { uniqueVisitors: { increment: 1 } } : {}),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error tracking visit:', error)
    // Hata olsa bile başarılı dön (tracking başarısız olsa bile kullanıcı deneyimi etkilenmesin)
    return NextResponse.json({ success: true })
  }
}
