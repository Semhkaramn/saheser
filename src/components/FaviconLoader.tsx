'use client'

import { useEffect, useRef } from 'react'
import { SITE_CONFIG } from '@/lib/site-config'

export default function FaviconLoader() {
  const hasLoaded = useRef(false)

  useEffect(() => {
    // Sadece bir kere çalış
    if (hasLoaded.current) return
    hasLoaded.current = true

    // SITE_CONFIG'den logo al
    const logoUrl = SITE_CONFIG.siteLogo
    const existingFavicons = document.querySelectorAll("link[rel*='icon']")

    // Zaten doğru favicon varsa değiştirme
    const hasCorrectFavicon = Array.from(existingFavicons).some(
      (f) => (f as HTMLLinkElement).href.includes(`${logoUrl}?v=2`)
    )
    if (hasCorrectFavicon) return

    // Eski favicon'ları kaldır
    existingFavicons.forEach(favicon => favicon.remove())

    // Yeni favicon ekle
    const link = document.createElement('link')
    link.rel = 'icon'
    link.type = 'image/webp'
    link.href = `${logoUrl}?v=2`
    document.head.appendChild(link)
  }, [])

  return null
}
