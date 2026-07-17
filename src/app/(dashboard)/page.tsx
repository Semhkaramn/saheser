import { HydrationBoundary, dehydrate } from '@tanstack/react-query'
import { getQueryClient } from '@/lib/get-query-client'
import { fetchSponsorsServer, fetchBannersServer, fetchSocialMediaServer } from '@/lib/server-fetchers'
import HarleyHome from '@/components/home/HarleyHome'

// SSR + ISR: Her 5 dakikada bir revalidate
// ✅ FIX: Eskiden 60 saniyeydi - bu kadar sık yenileme, az trafikli anlarda
// birinin tam o "yeniden oluşturma" anına denk gelip veritabanı sorgusunun
// tamamlanmasını beklemesi ("kartlar geç geliyor" hissi) riskini artırıyordu.
// Sponsor/banner verisi zaten sık değişmiyor, 5 dakika gecikme kabul edilebilir.
export const revalidate = 300

export default async function HomePage() {
  const queryClient = getQueryClient()

  // 🚀 Server'da TÜM verileri paralel prefetch - Client'ta anında yüklenir
  // ⚠️ visitStats prefetch'ten çıkarıldı - anlık veri olması için client'ta çekilecek
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ['sponsors'],
      queryFn: fetchSponsorsServer,
    }),
    queryClient.prefetchQuery({
      queryKey: ['sideBanners'],
      queryFn: async () => {
        const data = await fetchBannersServer()
        return {
          leftBanner: data.left ? { enabled: true, imageUrl: data.left.imageUrl, sponsorId: data.left.sponsorId } : null,
          leftSponsor: data.left?.sponsor || null,
          rightBanner: data.right ? { enabled: true, imageUrl: data.right.imageUrl, sponsorId: data.right.sponsorId } : null,
          rightSponsor: data.right?.sponsor || null,
        }
      },
    }),
    // 🚀 Social Media SSR prefetch - Sidebar anında yüklenir
    queryClient.prefetchQuery({
      queryKey: ['socialMedia'],
      queryFn: fetchSocialMediaServer,
    }),
  ])

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <HarleyHome />
    </HydrationBoundary>
  )
}
