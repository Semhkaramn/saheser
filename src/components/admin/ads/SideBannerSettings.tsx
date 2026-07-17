'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, MonitorPlay, GripVertical, Eye, EyeOff, Share2, Plus, Edit2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import Image from 'next/image'
import { optimizeCloudinaryImage } from '@/lib/utils'

interface Setting {
  id: string
  key: string
  value: string
  description: string
  category: string
}

interface Sponsor {
  id: string
  name: string
  logoUrl?: string
  websiteUrl?: string
  category: string
  isActive: boolean
  order: number
  showInBanner: boolean
}

interface SocialMedia {
  id: string
  name: string
  platform: string
  username: string
  isActive: boolean
  order: number
}

const SOCIAL_PLATFORMS = [
  { value: 'telegram', label: 'Telegram', icon: '📱' },
  { value: 'instagram', label: 'Instagram', icon: '📷' },
  { value: 'twitter', label: 'Twitter/X', icon: '🐦' },
  { value: 'youtube', label: 'YouTube', icon: '📺' },
  { value: 'discord', label: 'Discord', icon: '💬' },
  { value: 'tiktok', label: 'TikTok', icon: '🎵' },
  { value: 'facebook', label: 'Facebook', icon: '👥' },
  { value: 'whatsapp', label: 'WhatsApp', icon: '💚' },
  { value: 'linkedin', label: 'LinkedIn', icon: '💼' },
  { value: 'twitch', label: 'Twitch', icon: '🎮' }
]

export default function SideBannerSettings() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [leftBanner, setLeftBanner] = useState({ imageUrl: '', sponsorId: '', enabled: false })
  const [rightBanner, setRightBanner] = useState({ imageUrl: '', sponsorId: '', enabled: false })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const token = localStorage.getItem('admin_token')
      const [sponsorsRes, settingsRes] = await Promise.all([
        fetch('/api/admin/sponsors', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/admin/settings', { headers: { 'Authorization': `Bearer ${token}` } })
      ])

      const sponsorsData = await sponsorsRes.json()
      const settingsData = await settingsRes.json()

      setSponsors(sponsorsData.sponsors || [])

      const leftBannerData = settingsData.settings.find((s: Setting) => s.key === 'left_banner_data')
      const rightBannerData = settingsData.settings.find((s: Setting) => s.key === 'right_banner_data')

      if (leftBannerData?.value) {
        try {
          setLeftBanner(JSON.parse(leftBannerData.value))
        } catch (e) {
          console.error('Error parsing left banner:', e)
        }
      }

      if (rightBannerData?.value) {
        try {
          setRightBanner(JSON.parse(rightBannerData.value))
        } catch (e) {
          console.error('Error parsing right banner:', e)
        }
      }
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Veriler yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  async function saveBanner(side: 'left' | 'right') {
    const bannerData = side === 'left' ? leftBanner : rightBanner
    setSaving(true)

    try {
      const token = localStorage.getItem('admin_token')
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          key: `${side}_banner_data`,
          value: JSON.stringify(bannerData)
        })
      })

      const data = await response.json()
      if (data.success) {
        toast.success(`${side === 'left' ? 'Sol' : 'Sağ'} banner kaydedildi`)
      } else {
        toast.error(data.error || 'Banner kaydedilemedi')
      }
    } catch (error) {
      toast.error('Bir hata oluştu')
    } finally {
      setSaving(false)
    }
  }

  async function uploadImage(file: File, side: 'left' | 'right') {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()
      if (data.url) {
        const currentBanner = side === 'left' ? leftBanner : rightBanner
        const newBanner = { ...currentBanner, imageUrl: data.url }

        // Anlık kaydet
        if (side === 'left') {
          setLeftBanner(newBanner)
        } else {
          setRightBanner(newBanner)
        }

        // Auto-save
        const token = localStorage.getItem('admin_token')
        const saveResponse = await fetch('/api/admin/settings', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            key: `${side}_banner_data`,
            value: JSON.stringify(newBanner)
          })
        })

        const saveData = await saveResponse.json()
        if (saveData.success) {
          toast.success('Resim yüklendi ve kaydedildi')
        } else {
          toast.error('Resim yüklendi ama kaydedilemedi')
        }
      } else {
        toast.error(data.error || 'Resim yüklenemedi')
      }
    } catch (error) {
      toast.error('Resim yüklenirken hata oluştu')
    } finally {
      setUploading(false)
    }
  }

  async function toggleBanner(side: 'left' | 'right') {
    const currentBanner = side === 'left' ? leftBanner : rightBanner
    const newEnabled = !currentBanner.enabled

    // Update state
    if (side === 'left') {
      setLeftBanner(prev => ({ ...prev, enabled: newEnabled }))
    } else {
      setRightBanner(prev => ({ ...prev, enabled: newEnabled }))
    }

    // Save immediately
    setSaving(true)
    try {
      const token = localStorage.getItem('admin_token')
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          key: `${side}_banner_data`,
          value: JSON.stringify({ ...currentBanner, enabled: newEnabled })
        })
      })

      const data = await response.json()
      if (data.success) {
        toast.success(`${side === 'left' ? 'Sol' : 'Sağ'} banner ${newEnabled ? 'aktif edildi' : 'kapatıldı'}`)
      } else {
        // Revert on error
        if (side === 'left') {
          setLeftBanner(prev => ({ ...prev, enabled: !newEnabled }))
        } else {
          setRightBanner(prev => ({ ...prev, enabled: !newEnabled }))
        }
        toast.error(data.error || 'İşlem başarısız')
      }
    } catch (error) {
      toast.error('Bir hata oluştu')
      // Revert on error
      if (side === 'left') {
        setLeftBanner(prev => ({ ...prev, enabled: !newEnabled }))
      } else {
        setRightBanner(prev => ({ ...prev, enabled: !newEnabled }))
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  const renderBannerCard = (side: 'left' | 'right') => {
    const banner = side === 'left' ? leftBanner : rightBanner
    const setBanner = side === 'left' ? setLeftBanner : setRightBanner
    const selectedSponsor = sponsors.find(s => s.id === banner.sponsorId)

    return (
      <Card className="admin-card p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-white mb-2">
              {side === 'left' ? 'Sol' : 'Sağ'} Yan Banner
            </h2>
            <p className="text-gray-400 text-sm">
              Masaüstünde {side === 'left' ? 'sol' : 'sağ'} tarafta sabit banner
            </p>
          </div>
          <button
            onClick={() => toggleBanner(side)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              banner.enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'
            }`}
          >
            {banner.enabled ? 'Açık' : 'Kapalı'}
          </button>
        </div>

        <div className="space-y-4">
          {/* Image Upload */}
          <div>
            <Label className="admin-text-primary">Banner Görseli (Dikey)</Label>
            <div className="mt-2 space-y-2">
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) uploadImage(file, side)
                }}
                disabled={uploading}
                className="admin-card admin-text-primary"
              />
              <p className="text-xs admin-text-muted">
                Önerilen boyut: 160x600px veya 300x600px
              </p>

              {/* Preview */}
              {banner.imageUrl && (
                <div className="relative w-40 h-60 rounded-lg overflow-hidden border border-white/10 bg-white/5 mx-auto">
                  <Image
                    src={optimizeCloudinaryImage(banner.imageUrl, 320, 480)}
                    unoptimized
                    alt={`${side} banner`}
                    fill
                    className="object-contain"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Sponsor Selection */}
          <div>
            <Label className="admin-text-primary">Sponsor Seçin</Label>
            <Select
              value={banner.sponsorId}
              onValueChange={async (value) => {
                setBanner(prev => ({ ...prev, sponsorId: value }))
                // Auto-save when sponsor changes
                const newBanner = { ...banner, sponsorId: value }
                setSaving(true)
                try {
                  const token = localStorage.getItem('admin_token')
                  const response = await fetch('/api/admin/settings', {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                      key: `${side}_banner_data`,
                      value: JSON.stringify(newBanner)
                    })
                  })

                  const data = await response.json()
                  if (data.success) {
                    toast.success('Sponsor kaydedildi')
                  } else {
                    toast.error(data.error || 'İşlem başarısız')
                  }
                } catch (error) {
                  toast.error('Bir hata oluştu')
                } finally {
                  setSaving(false)
                }
              }}
            >
              <SelectTrigger className="admin-card text-white mt-2">
                <SelectValue placeholder="Sponsor seçin" />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-white/10">
                {sponsors.map(sponsor => (
                  <SelectItem key={sponsor.id} value={sponsor.id} className="admin-text-primary">
                    {sponsor.name} {sponsor.category === 'vip' ? '⭐' : ''} {!sponsor.isActive ? '(Devre Dışı)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs admin-page-subtitle">
              Banner'a tıklandığında bu sponsorun linkine gidilecek
            </p>
          </div>

          {/* Status */}
          <div className={`p-4 rounded-lg border ${banner.enabled && banner.imageUrl && banner.sponsorId ? 'bg-green-500/10 border-green-500/30' : 'bg-gray-500/10 border-gray-500/30'}`}>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${banner.enabled && banner.imageUrl && banner.sponsorId ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></div>
              <span className="text-white font-medium text-sm">
                {banner.enabled && banner.imageUrl && banner.sponsorId
                  ? `Aktif - ${selectedSponsor?.name || 'Sponsor seçilmedi'}`
                  : 'Pasif'}
              </span>
            </div>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <>
      <Card className="bg-blue-500/10 border-blue-500/30 p-4 mb-6">
        <h4 className="text-blue-300 font-semibold mb-2">ℹ️ Yan Banner Sistemi</h4>
        <ul className="text-blue-200 text-sm space-y-1">
          <li>• Bannerlar sadece masaüstünde görünür (mobilde gizlenir)</li>
          <li>• Sayfa daraldığında otomatik olarak gizlenir</li>
          <li>• Banner'a tıklandığında seçili sponsorun linkine yönlendirilir</li>
          <li>• Önerilen görsel boyutu: 160x600px veya 300x600px (dikey)</li>
        </ul>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderBannerCard('left')}
        {renderBannerCard('right')}
      </div>
    </>
  )
}

