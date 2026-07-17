'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { SITE_CONFIG } from '@/lib/site-config'

// 🚀 Site bazlı localStorage key prefix
// Boşluklar ve özel karakterler tek _ ile değiştirilir, baş/son _ temizlenir
const STORAGE_PREFIX = SITE_CONFIG.siteName
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')  // Ardışık özel karakterleri tek _ yap
  .replace(/^_|_$/g, '')         // Baş ve sondaki _ kaldır

// 🚀 Benzersiz ziyaretçi ID'si oluştur veya al
function getOrCreateVisitorId(): string {
  if (typeof window === 'undefined') return ''

  const VISITOR_KEY = `${STORAGE_PREFIX}_visitor_id`
  let visitorId = localStorage.getItem(VISITOR_KEY)

  if (!visitorId) {
    // Benzersiz ID oluştur (UUID benzeri)
    visitorId = 'v_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 15)
    localStorage.setItem(VISITOR_KEY, visitorId)
  }

  return visitorId
}

// 🚀 Bugün bu ziyaretçi kaydedildi mi kontrol et
function hasVisitedToday(): boolean {
  if (typeof window === 'undefined') return true

  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
  const lastVisitDate = localStorage.getItem(`${STORAGE_PREFIX}_last_visit_date`)

  return lastVisitDate === today
}

// 🚀 Bugünkü ziyareti kaydet
function markVisitedToday(): void {
  if (typeof window === 'undefined') return

  const today = new Date().toISOString().split('T')[0]
  localStorage.setItem(`${STORAGE_PREFIX}_last_visit_date`, today)
}

export default function VisitTracker() {
  const pathname = usePathname()
  const visitedPages = useRef(new Set<string>())
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // ✅ OPTIMIZE: Aynı session'da aynı sayfayı tekrar kaydetme
    const sessionKey = `visited_${pathname}`
    if (visitedPages.current.has(sessionKey)) {
      return
    }

    // ✅ OPTIMIZE: 3 saniye debounce - Hızlı navigasyon durumunda sadece son sayfayı kaydet
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    debounceTimer.current = setTimeout(async () => {
      try {
        // Session'a ekle
        visitedPages.current.add(sessionKey)

        // 🚀 Benzersiz ziyaretçi ID'si ve bugün ilk ziyaret kontrolü
        const visitorId = getOrCreateVisitorId()
        const isFirstVisitToday = !hasVisitedToday()

        // navigator.sendBeacon kullan (sponsor click'te olduğu gibi)
        // Sayfa kapatılsa bile istek tamamlanır
        const data = JSON.stringify({
          page: pathname,
          visitorId,
          isFirstVisitToday
        })
        const blob = new Blob([data], { type: 'application/json' })

        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/visit/track', blob)
        } else {
          // Fallback: Eski tarayıcılar için fetch
          await fetch('/api/visit/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: data,
            keepalive: true // Sayfa kapatılsa bile devam et
          })
        }

        // 🚀 Bugünkü ziyareti işaretle
        if (isFirstVisitToday) {
          markVisitedToday()
        }
      } catch (error) {
        // Hata olsa bile sessizce başarısız ol
        console.debug('Visit tracking failed:', error)
      }
    }, 3000) // 3 saniye debounce

    // Cleanup
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [pathname])

  return null // Hiçbir şey render etme
}
