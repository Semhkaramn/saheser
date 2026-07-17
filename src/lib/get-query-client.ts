import { QueryClient } from '@tanstack/react-query'
import { cache } from 'react'

// Server-side QueryClient - her request için yeni instance
// cache() ile aynı request içinde paylaşılır
export const getQueryClient = cache(
  () =>
    new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 1000 * 60 * 5, // 5 dakika
          gcTime: 1000 * 60 * 10, // 10 dakika
        },
      },
    })
)
