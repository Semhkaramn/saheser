'use client'

import { useEffect, useState, useRef } from 'react'
import Image from 'next/image'
import { X } from 'lucide-react'
import { optimizeCloudinaryImage, ensureAbsoluteUrl } from '@/lib/utils'
import { useUserTheme } from '@/components/providers/user-theme-provider'

interface PopupData {
  title: string
  description: string
  imageUrl: string
  sponsorId: string
}

interface Sponsor {
  id: string
  name: string
  logoUrl?: string
  websiteUrl?: string
}

export default function HomePopup() {
  const [isOpen, setIsOpen] = useState(false)
  const [popupData, setPopupData] = useState<PopupData | null>(null)
  const [sponsor, setSponsor] = useState<Sponsor | null>(null)
  const [loading, setLoading] = useState(false)
  const hasLoadedRef = useRef(false)
  const { theme } = useUserTheme()

  useEffect(() => {
    // ✅ FIX: Basitleştirilmiş kontrol
    // Sadece bu sayfa yüklenişinde bir kez popup göster
    // hasLoadedRef component mount başına bir kez çalışmasını sağlar
    if (hasLoadedRef.current) return
    hasLoadedRef.current = true

    // Session içinde zaten görüldüyse gösterme
    const hasSeenThisSession = sessionStorage.getItem('hasSeenPopup')
    if (hasSeenThisSession) {
      return
    }

    loadPopup()
  }, [])

  async function loadPopup() {
    try {
      setLoading(true)

      // ✅ OPTIMIZE: Paralel API çağrıları ile performans iyileştirmesi
      // Cache-busting: timestamp ekleyerek her zaman taze veri al
      const cacheBuster = Date.now()
      const [settingsRes, popupRes] = await Promise.all([
        fetch(`/api/admin/settings/popup-enabled?_=${cacheBuster}`, { cache: 'no-store' }),
        fetch(`/api/admin/settings/popup-data?_=${cacheBuster}`, { cache: 'no-store' })
      ])

      const [settingsData, popupResponseData] = await Promise.all([
        settingsRes.json(),
        popupRes.json()
      ])

      if (!settingsData.enabled || !popupResponseData.data) {
        return
      }

      const data = popupResponseData.data
      setPopupData(data)

      // Load sponsor data (eğer varsa)
      if (data.sponsorId) {
        const sponsorRes = await fetch(`/api/sponsors/${data.sponsorId}`)
        const sponsorData = await sponsorRes.json()
        setSponsor(sponsorData.sponsor)
      }

      // Popup'ı aç ve session'a kaydet
      setIsOpen(true)
      sessionStorage.setItem('hasSeenPopup', 'true')
    } catch (error) {
      console.error('Error loading popup:', error)
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    setIsOpen(false)
  }

  function handleLogin() {
    // Sponsor linkine yönlendir
    if (sponsor?.websiteUrl) {
      window.open(ensureAbsoluteUrl(sponsor.websiteUrl), '_blank', 'noopener,noreferrer')

      // Track click
      if (sponsor.id) {
        fetch('/api/sponsors/click', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sponsorId: sponsor.id })
        }).catch(err => console.error('Click tracking failed:', err))
      }
    }
    handleClose()
  }

  function handlePopupClick() {
    if (sponsor?.websiteUrl) {
      window.open(ensureAbsoluteUrl(sponsor.websiteUrl), '_blank', 'noopener,noreferrer')

      // Track click
      if (sponsor.id) {
        fetch('/api/sponsors/click', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sponsorId: sponsor.id })
        }).catch(err => console.error('Click tracking failed:', err))
      }
    }
  }

  if (loading || !isOpen || !popupData) {
    return null
  }

  const displayImage = popupData.imageUrl || sponsor?.logoUrl

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
      onClick={handleClose}
    >
      <div
        className="relative max-w-md w-full max-h-[90vh] overflow-y-auto rounded-2xl p-6 md:p-8 shadow-2xl animate-scale-in"
        style={{
          background: `linear-gradient(to bottom, ${theme.colors.background}, ${theme.colors.backgroundSecondary})`,
          border: `2px solid ${theme.colors.border}50`
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleClose()
          }}
          className="absolute top-4 right-4 p-2 rounded-full transition-all z-10"
          style={{
            backgroundColor: `${theme.colors.text}20`,
            color: theme.colors.text
          }}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content - Tam ortalanmış */}
        <div className="space-y-6">
          {/* Title - Ortalanmış, padding yok */}
          {popupData.title && (
            <h2 className="text-2xl font-bold text-center" style={{ color: theme.colors.text }}>
              {popupData.title}
            </h2>
          )}

          {/* Description - Ortalanmış */}
          {popupData.description && (
            <p className="text-center whitespace-pre-wrap leading-relaxed" style={{ color: theme.colors.textSecondary }}>
              {popupData.description}
            </p>
          )}

          {/* Image */}
          {displayImage && (
            <div
              className="relative w-full h-56 rounded-2xl overflow-hidden cursor-pointer"
              onClick={handlePopupClick}
            >
              <Image
                src={optimizeCloudinaryImage(displayImage, 800, 448)}
                unoptimized
                alt={popupData.title || 'Popup'}
                fill
                className="object-cover"
                priority
                fetchPriority="high"
                sizes="(max-width: 768px) 100vw, 800px"
              />
            </div>
          )}

          {/* GİRİŞ YAP Butonu - Ortalanmış */}
          <div className="flex justify-center pt-2">
            <button
              onClick={handleLogin}
              className="px-8 py-3 font-semibold rounded-full transition-all transform hover:scale-105 shadow-lg text-white"
              style={{
                background: `linear-gradient(to right, ${theme.colors.gradientFrom}, ${theme.colors.gradientTo})`
              }}
            >
              GİRİŞ YAP
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
