'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import type { ReactNode } from 'react'

// ⚠️ ÖNEMLİ: QueryClient'ı modül seviyesinde tek bir singleton olarak
// oluşturmuyoruz. Next.js App Router'da bu component sunucuda da render
// edildiği için (SSR/RSC), modül-seviyesi bir singleton Node.js process'i
// yeniden başlayana kadar TÜM kullanıcı istekleri arasında paylaşılırdı -
// bu da bir kullanıcının cache'lenmiş verisinin başka bir kullanıcıya
// sızmasına yol açabilirdi. Bunun yerine: sunucuda HER ZAMAN yeni bir
// client oluşturuyoruz, tarayıcıda ise tek bir client'ı yeniden kullanıyoruz
// (TanStack Query'nin resmi Next.js SSR önerisi).
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // 🚀 OPTIMIZATION: Reasonable stale time
        staleTime: 1000 * 60 * 2, // 2 minutes

        // 🚀 OPTIMIZATION: Longer garbage collection time
        gcTime: 1000 * 60 * 15, // 15 minutes

        // 🚀 OPTIMIZATION: Reduce refetch frequency to avoid overloading
        refetchOnWindowFocus: false, // Disabled to reduce unnecessary requests

        // ✅ FIX: refetchOnMount true yapıldı - sayfa geçişlerinde güncel veri
        // 'always' yerine true kullanarak staleTime'a saygı duyar, sadece stale ise refetch yapar
        refetchOnMount: true,

        refetchOnReconnect: true, // Refetch when reconnecting

        // 🚀 Background refetching disabled by default
        refetchInterval: false, // Her query kendi interval'ını belirleyecek

        // 🚀 OPTIMIZATION: Retry strategy
        retry: 2, // Retry failed requests twice
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff

        // 🚀 OPTIMIZATION: Network mode
        networkMode: 'online', // Only fetch when online

        // 🚀 Instant loading from cache - eski veriyi göster, yeni veri gelene kadar
        placeholderData: (previousData: unknown) => previousData,
      },
      mutations: {
        // 🚀 OPTIMIZATION: Retry mutations once
        retry: 1,
        retryDelay: 1000,
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined

function getQueryClientForProvider() {
  if (typeof window === 'undefined') {
    // Sunucu: her render için yeni client (istekler arası paylaşım YOK)
    return makeQueryClient()
  }
  // Tarayıcı: aynı client'ı yeniden kullan (sayfa geçişlerinde cache korunur)
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient()
  }
  return browserQueryClient
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(getQueryClientForProvider)

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
