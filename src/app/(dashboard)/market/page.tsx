import { HydrationBoundary, dehydrate } from '@tanstack/react-query'
import { getQueryClient } from '@/lib/get-query-client'
import { fetchShopItemsServer } from '@/lib/server-fetchers'
import ShopContent from './_components/ShopContent'
// Not: modülün dışa aktardığı varsayılan bileşenin adı ShopPageClient'tır
// (dosya içinde zaten "ShopContent" adında ayrı bir iç bileşen olduğu için
// isim çakışmasını önlemek adına farklı adlandırıldı) - import ismi burada
// istediğimiz gibi olabilir, sadece varsayılan export olduğu için sorun yok.

// ✅ Market resimlerinin "geç yükleniyor" hissinin asıl sebebi: sayfa client-side
// mount olduktan SONRA veri çekiliyordu (boş ekran → istek → cevap → resimler
// YENİ istenmeye başlıyordu). Artık liste, ana sayfadaki gibi sunucuda
// önceden hazırlanıp HTML ile birlikte gönderiliyor - tarayıcı resimleri
// JS hiç çalışmadan istemeye başlayabiliyor.
export default async function ShopPage() {
  const queryClient = getQueryClient()

  await queryClient.prefetchQuery({
    queryKey: ['shop-items', undefined],
    queryFn: async () => {
      const items = await fetchShopItemsServer()
      return { items }
    },
  })

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ShopContent />
    </HydrationBoundary>
  )
}
