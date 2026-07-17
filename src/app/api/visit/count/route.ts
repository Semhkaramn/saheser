import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTurkeyToday, getTurkeyDateAgo } from '@/lib/utils'
import { getCachedData, CacheTTL, CacheStrategy } from '@/lib/enhanced-cache'

// 🚀 OPTIMIZATION: Timeout ile Promise - ESKİDEN zaman aşımında sessizce bir
// "fallback" (sıfırlar) değerine düşüyordu, bu da getCachedData tarafından
// GERÇEK veriymiş gibi 60 saniyeliğine cache'e yazılıyordu (bkz.
// enhanced-cache.ts STALE_WHILE_REVALIDATE) - yani bir kez yavaş bağlantı
// (soğuk başlangıç) olduğunda sıfırlar bir dakika boyunca herkese
// gösteriliyordu. Artık zaman aşımında hata FIRLATIYOR, böylece bozuk sonuç
// asla cache'e yazılmıyor - sadece bu tek istek için aşağıdaki route'un
// dış try/catch'i (cache'e dokunmayan) sıfır döndürüyor.
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('DB sorgusu zaman aşımına uğradı')), ms))
  ])
}

export async function GET() {
  try {
    // 🚀 OPTIMIZATION: Cache ile veri getir (60 saniye)
    const stats = await getCachedData(
      'visit_count_stats',
      async () => {
        const today = getTurkeyToday()
        const weekAgo = getTurkeyDateAgo(7)
        const monthAgo = getTurkeyDateAgo(30)

        // 🚀 OPTIMIZATION: Timeout ile DB sorguları (5 saniye) - zaman
        // aşımında hata fırlatır, çağıran route'un dış try/catch'i yakalar.
        const result = await withTimeout(
          Promise.all([
            // Tüm zamanların toplamı
            prisma.dailyStats.aggregate({
              _sum: { totalVisits: true }
            }),
            // Bugünkü ziyaretler (uniqueVisitors dahil)
            prisma.dailyStats.findUnique({
              where: { date: today }
            }),
            // Haftalık ziyaretler
            prisma.dailyStats.aggregate({
              where: { date: { gte: weekAgo } },
              _sum: { totalVisits: true }
            }),
            // Aylık ziyaretler
            prisma.dailyStats.aggregate({
              where: { date: { gte: monthAgo } },
              _sum: { totalVisits: true }
            }),
            // Tüm zamanların toplam benzersiz ziyaretçi sayısı
            prisma.dailyStats.aggregate({
              _sum: { uniqueVisitors: true }
            })
          ]),
          5000 // 5 saniye timeout
        )

        const [totalStats, todayStats, weeklyStats, monthlyStats, allTimeUniqueStats] = result

        return {
          totalVisits: totalStats._sum.totalVisits || 0,
          todayVisits: todayStats?.totalVisits || 0,
          weeklyVisits: weeklyStats._sum.totalVisits || 0,
          monthlyVisits: monthlyStats._sum.totalVisits || 0,
          uniqueVisitors: todayStats?.uniqueVisitors || 0,
          totalUniqueVisitors: allTimeUniqueStats._sum.uniqueVisitors || 0
        }
      },
      { ttl: CacheTTL.SHORT, strategy: CacheStrategy.STALE_WHILE_REVALIDATE }
    )

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error getting visit count:', error)
    // 🚀 FIX: Hata durumunda boş değerler döndür (503 önleme)
    return NextResponse.json({
      totalVisits: 0,
      todayVisits: 0,
      weeklyVisits: 0,
      monthlyVisits: 0,
      uniqueVisitors: 0,
      totalUniqueVisitors: 0
    })
  }
}
