/**
 * 🎰 Wheel Management Hook
 * React Query ile optimize edilmiş çark yönetimi
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

interface WheelPrize {
  id: string
  name: string
  points: number
  color: string
  order: number
}

interface RecentWinner {
  id: string
  pointsWon: number
  spunAt: string
  user: {
    siteUsername?: string
    avatar?: string
  }
  prize: {
    name: string
  }
}

interface WheelSpinResponse {
  success: boolean
  prize: WheelPrize
  pointsWon: number
  dailySpinsLeft: number
  message?: string
}

/**
 * Çark ödüllerini getir
 */
export function useWheelPrizes() {
  return useQuery({
    queryKey: ['wheel', 'prizes'],
    queryFn: async () => {
      const response = await fetch('/api/wheel/prizes')
      if (!response.ok) {
        throw new Error('Ödüller yüklenemedi')
      }
      const data = await response.json()
      return data.prizes as WheelPrize[]
    },
    staleTime: 5 * 60 * 1000, // 5 dakika
    gcTime: 10 * 60 * 1000 // 10 dakika (eski cacheTime)
  })
}

/**
 * Son kazananları getir
 * @param options.enablePolling - Otomatik polling aktif olsun mu (sadece wheel sayfasında kullanın)
 */
export function useRecentWinners(options?: { enablePolling?: boolean }) {
  return useQuery({
    queryKey: ['wheel', 'recent-winners'],
    queryFn: async () => {
      const response = await fetch('/api/wheel/recent-winners')
      if (!response.ok) {
        throw new Error('Kazananlar yüklenemedi')
      }
      const data = await response.json()
      return data.winners as RecentWinner[]
    },
    staleTime: 30 * 1000, // 30 saniye (sık güncellenen data)
    gcTime: 5 * 60 * 1000, // 5 dakika
    // Sadece wheel sayfasında polling yap (performans için)
    refetchInterval: options?.enablePolling ? 60 * 1000 : false
  })
}

/**
 * Çark çevirme mutation
 */
export function useSpinWheel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/wheel/spin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Çark çevrilemedi')
      }

      return await response.json() as WheelSpinResponse
    },
    onSuccess: () => {
      // Sadece kullanıcı bilgilerini güncelle
      // Kazananlar listesi animasyon bitince manuel olarak güncellenecek
      queryClient.invalidateQueries({ queryKey: ['user', 'me'] })
    }
  })
}

/**
 * Çark verilerini manuel olarak güncelle (animasyon sonrası)
 */
export function useRefreshWheelData() {
  const queryClient = useQueryClient()

  return () => {
    queryClient.invalidateQueries({ queryKey: ['wheel', 'recent-winners'] })
  }
}

/**
 * Tüm wheel datalarını birlikte getir (optimization)
 * @param options.enablePolling - Otomatik polling aktif olsun mu (sadece wheel sayfasında kullanın)
 */
export function useWheelData(options?: { enablePolling?: boolean }) {
  const prizes = useWheelPrizes()
  const winners = useRecentWinners(options)

  return {
    prizes: prizes.data ?? [],
    winners: winners.data ?? [],
    isLoading: prizes.isLoading || winners.isLoading,
    error: prizes.error || winners.error
  }
}
