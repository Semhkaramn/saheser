import { useQuery } from '@tanstack/react-query'

interface VisitStats {
  totalVisits: number
  todayVisits: number
  uniqueVisitors: number
  totalUniqueVisitors: number
}

async function fetchVisitStats() {
  const response = await fetch('/api/visit/count', {
    cache: 'no-store' // Cache'leme yapma, her zaman fresh data
  })
  if (!response.ok) throw new Error('Failed to fetch visit stats')
  return response.json() as Promise<VisitStats>
}

export function useVisitStats() {
  return useQuery({
    queryKey: ['visitStats'],
    queryFn: fetchVisitStats,
    staleTime: 30000, // 30sn boyunca cache'lenmiş veriyi anında göster, arka planda yenile
    gcTime: 5 * 60 * 1000, // Sayfalar arası geçişte veri hafızada kalsın, tekrar boş görünmesin
    refetchInterval: 30000, // 30 saniyede bir yenile
    refetchOnMount: false, // Cache'te veri varsa beklemeden anında göster
    refetchOnWindowFocus: true, // Sayfa fokuslandığında yenile
  })
}
