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

export default function YatayBannerSettings() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [bannerData, setBannerData] = useState({
    imageUrl: '',
    sponsorId: '',
    enabled: false
  })

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

      const yatayBannerData = settingsData.settings.find((s: Setting) => s.key === 'yatay_banner_data')

      if (yatayBannerData?.value) {
        try {
          setBannerData(JSON.parse(yatayBannerData.value))
        } catch (e) {
          console.error('Error parsing yatay banner:', e)
        }
      }
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Veriler yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  async function saveBanner() {
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
          key: 'yatay_banner_data',
          value: JSON.stringify(bannerData)
        })
      })

      const data = await response.json()
      if (data.success) {
        toast.success('Yatay banner kaydedildi')
      } else {
        toast.error(data.error || 'Banner kaydedilemedi')
      }
    } catch (error) {
      toast.error('Bir hata oluştu')
    } finally {
      setSaving(false)
    }
  }

  async function uploadImage(file: File, type: 'desktop' = 'desktop') {
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
        const newBannerData = { ...bannerData, imageUrl: data.url }
        setBannerData(newBannerData)

        // Auto-save
        const token = localStorage.getItem('admin_token')
        const saveResponse = await fetch('/api/admin/settings', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            key: 'yatay_banner_data',
            value: JSON.stringify(newBannerData)
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

  async function toggleBanner() {
    const newEnabled = !bannerData.enabled
    setBannerData(prev => ({ ...prev, enabled: newEnabled }))

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
          key: 'yatay_banner_data',
          value: JSON.stringify({ ...bannerData, enabled: newEnabled })
        })
      })

      const data = await response.json()
      if (data.success) {
        toast.success(newEnabled ? 'Yatay banner aktif edildi' : 'Yatay banner kapatıldı')
      } else {
        setBannerData(prev => ({ ...prev, enabled: !newEnabled }))
        toast.error(data.error || 'İşlem başarısız')
      }
    } catch (error) {
      setBannerData(prev => ({ ...prev, enabled: !newEnabled }))
      toast.error('Bir hata oluştu')
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

  const selectedSponsor = sponsors.find(s => s.id === bannerData.sponsorId)

  return (
    <>
      <Card className="bg-blue-500/10 border-blue-500/30 p-4 mb-6">
        <h4 className="text-blue-300 font-semibold mb-2">Yatay Banner Sistemi</h4>
        <ul className="text-blue-200 text-sm space-y-1">
          <li>Bu banner ana sayfa ve üye sayfalarında (mağaza, görevler, çark, bilet, etkinlik, liderlik) görünür</li>
          <li>GIF formatı desteklenir - animasyonlu bannerlar için idealdir</li>
          <li>Önerilen boyut: 1200x100px veya 1920x150px (yatay)</li>
          <li>Banner'a tıklandığında seçili sponsorun linkine yönlendirilir</li>
        </ul>
      </Card>

      {/* Banner Toggle */}
      <Card className="admin-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white mb-2">Yatay Banner Durumu</h2>
            <p className="text-gray-400 text-sm">
              Banner açıkken üye sayfalarında yatay banner görünür
            </p>
          </div>
          <button
            onClick={toggleBanner}
            disabled={saving}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ml-4 ${
              bannerData.enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'
            }`}
          >
            {bannerData.enabled ? 'Açık' : 'Kapalı'}
          </button>
        </div>

        <div className={`mt-4 p-4 rounded-lg border ${bannerData.enabled && bannerData.imageUrl ? 'bg-green-500/10 border-green-500/30' : 'bg-gray-500/10 border-gray-500/30'}`}>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${bannerData.enabled && bannerData.imageUrl ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></div>
            <span className="text-white font-medium">
              {bannerData.enabled && bannerData.imageUrl
                ? `Aktif - ${selectedSponsor?.name || 'Sponsor seçilmedi'}`
                : 'Pasif'}
            </span>
          </div>
        </div>
      </Card>

      {/* Banner Content */}
      <Card className="admin-card p-6">
        <h2 className="text-xl font-bold text-white mb-4">Banner İçeriği</h2>

        <div className="space-y-4">
          {/* Banner Görseli - artık tek yükleme, tüm cihazlarda otomatik oranlanıyor */}
          <div>
            <Label className="admin-text-primary">Banner Görseli (Yatay - GIF Desteklenir)</Label>
            <div className="mt-2 space-y-2">
              <Input
                type="file"
                accept="image/*,.gif"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) uploadImage(file, 'desktop')
                }}
                disabled={uploading}
                className="admin-card admin-text-primary"
              />
              <p className="text-xs admin-text-muted">
                Tek görsel yeterli - telefon, tablet ve masaüstünde otomatik olarak orantılı gösterilir. Önerilen boyut: 1600x230px (yaklaşık 7:1 yatay oran). GIF dosyaları desteklenir.
              </p>

              {/* Preview */}
              {bannerData.imageUrl && (
                <div className="relative w-full aspect-[7/1] rounded-lg overflow-hidden border border-white/10 bg-white/5">
                  <Image
                    src={bannerData.imageUrl}
                    alt="Banner Preview"
                    fill
                    className="object-cover"
                    unoptimized={bannerData.imageUrl.toLowerCase().endsWith('.gif')}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Sponsor Selection */}
          <div>
            <Label className="admin-text-primary">Sponsor Seçin</Label>
            <Select
              value={bannerData.sponsorId}
              onValueChange={async (value) => {
                const newBannerData = { ...bannerData, sponsorId: value }
                setBannerData(newBannerData)

                // Auto-save
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
                      key: 'yatay_banner_data',
                      value: JSON.stringify(newBannerData)
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
                <SelectItem value="" className="admin-text-primary">
                  Sponsor Seçilmedi
                </SelectItem>
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
        </div>
      </Card>

      {/* Live Preview */}
      {bannerData.imageUrl && (
        <Card className="admin-card p-6">
          <h2 className="text-xl font-bold text-white mb-4">Canlı Önizleme</h2>
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-white/10 rounded-lg overflow-hidden">
            <div className="relative w-full h-16 sm:h-20 md:h-24">
              <Image
                src={bannerData.imageUrl}
                alt="Preview"
                fill
                className="object-contain"
                unoptimized={bannerData.imageUrl.toLowerCase().endsWith('.gif')}
              />
            </div>
          </div>
          {selectedSponsor && (
            <p className="text-gray-400 text-center text-sm mt-2">
              Tıklandığında: {selectedSponsor.name} ({selectedSponsor.websiteUrl || 'Link yok'})
            </p>
          )}
        </Card>
      )}
    </>
  )
}
