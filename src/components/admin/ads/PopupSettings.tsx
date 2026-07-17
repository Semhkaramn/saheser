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

export default function PopupSettings() {
  const [popupEnabled, setPopupEnabled] = useState(false)
  const [sponsors, setSponsors] = useState<Sponsor[]>([])
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [popupForm, setPopupForm] = useState({
    title: '',
    description: '',
    imageUrl: '',
    sponsorId: ''
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

      const popupEnabledSetting = settingsData.settings.find((s: Setting) => s.key === 'popup_enabled')
      setPopupEnabled(popupEnabledSetting?.value === 'true')

      const popupData = settingsData.settings.find((s: Setting) => s.key === 'popup_data')
      if (popupData?.value) {
        try {
          const parsed = JSON.parse(popupData.value)
          setPopupForm(parsed)
        } catch (e) {
          console.error('Error parsing popup data:', e)
        }
      }
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Veriler yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  async function togglePopup() {
    const newValue = !popupEnabled
    setPopupEnabled(newValue)
    setSaving(true)

    try {
      const token = localStorage.getItem('admin_token')
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ key: 'popup_enabled', value: newValue.toString() })
      })

      const data = await response.json()
      if (data.success) {
        toast.success(newValue ? 'Popup aktif edildi' : 'Popup kapatıldı')
      } else {
        setPopupEnabled(!newValue)
        toast.error(data.error || 'İşlem başarısız')
      }
    } catch (error) {
      setPopupEnabled(!newValue)
      toast.error('Bir hata oluştu')
    } finally {
      setSaving(false)
    }
  }

  async function savePopupData() {
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
          key: 'popup_data',
          value: JSON.stringify(popupForm)
        })
      })

      const data = await response.json()
      if (data.success) {
        toast.success('Popup ayarları kaydedildi')
      } else {
        toast.error(data.error || 'Ayarlar kaydedilemedi')
      }
    } catch (error) {
      toast.error('Bir hata oluştu')
    } finally {
      setSaving(false)
    }
  }

  async function uploadImage(file: File) {
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
        const newPopupForm = { ...popupForm, imageUrl: data.url }
        setPopupForm(newPopupForm)

        // Auto-save immediately
        const token = localStorage.getItem('admin_token')
        const saveResponse = await fetch('/api/admin/settings', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            key: 'popup_data',
            value: JSON.stringify(newPopupForm)
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  const selectedSponsor = sponsors.find(s => s.id === popupForm.sponsorId)

  return (
    <>
      {/* Popup Toggle */}
      <Card className="admin-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white mb-2">Ana Sayfa Popup Durumu</h2>
            <p className="text-gray-400 text-sm">
              Popup açıkken kullanıcılar ana sayfayı ziyaret ettiğinde popup görecekler
            </p>
          </div>
          <button
            onClick={togglePopup}
            disabled={saving}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ml-4 ${
              popupEnabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'
            }`}
          >
            {popupEnabled ? 'Açık' : 'Kapalı'}
          </button>
        </div>

        <div className={`mt-4 p-4 rounded-lg border ${popupEnabled ? 'bg-green-500/10 border-green-500/30' : 'bg-gray-500/10 border-gray-500/30'}`}>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${popupEnabled ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></div>
            <span className="text-white font-medium">
              {popupEnabled ? 'Popup Aktif' : 'Popup Kapalı'}
            </span>
          </div>
        </div>
      </Card>

      {/* Popup Content */}
      <Card className="admin-card p-6">
        <h2 className="text-xl font-bold text-white mb-4">Popup İçeriği</h2>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <Label htmlFor="popup-title" className="admin-text-primary">Başlık (Kalın)</Label>
            <Input
              id="popup-title"
              value={popupForm.title}
              onChange={(e) => setPopupForm(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Popup başlığı"
              className="admin-card text-white mt-2"
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="popup-description" className="admin-text-primary">Açıklama (Normal)</Label>
            <Textarea
              id="popup-description"
              value={popupForm.description}
              onChange={(e) => setPopupForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Popup açıklaması"
              className="admin-card text-white mt-2 min-h-[100px]"
            />
          </div>

          {/* Sponsor Selection */}
          <div>
            <Label htmlFor="popup-sponsor" className="admin-text-primary">Sponsor Seçin</Label>
            <Select
              value={popupForm.sponsorId}
              onValueChange={(value) => setPopupForm(prev => ({ ...prev, sponsorId: value }))}
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
              Popup'a tıklandığında bu sponsorun linkine gidilecek
            </p>
          </div>

          {/* Image Upload */}
          <div>
            <Label htmlFor="popup-image" className="admin-text-primary">Resim (Opsiyonel)</Label>
            <div className="mt-2 space-y-2">
              <Input
                id="popup-image"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) uploadImage(file)
                }}
                disabled={uploading}
                className="admin-card admin-text-primary"
              />
              <p className="text-xs admin-text-muted">
                Resim yüklenmezse seçili sponsorun logosu kullanılacak
              </p>

              {/* Preview */}
              {(popupForm.imageUrl || selectedSponsor?.logoUrl) && (
                <div className="relative w-full max-w-md h-48 rounded-lg overflow-hidden border border-white/10 bg-white/5">
                  <Image
                    src={optimizeCloudinaryImage(popupForm.imageUrl || selectedSponsor?.logoUrl || '', 800, 384)}
                    unoptimized
                    alt="Popup preview"
                    fill
                    className="object-contain p-4"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Save Button */}
          <Button
            onClick={savePopupData}
            disabled={saving || uploading}
            className="w-full admin-btn-primary"
          >
            {saving ? 'Kaydediliyor...' : 'Popup Ayarlarını Kaydet'}
          </Button>
        </div>
      </Card>

      {/* Preview */}
      {popupForm.title && (
        <Card className="admin-card p-6">
          <h2 className="text-xl font-bold text-white mb-4">Önizleme</h2>
          <div className="max-w-md mx-auto bg-gray-900 border-2 border-white/20 rounded-2xl p-6 space-y-4">
            <h3 className="text-2xl font-bold text-white text-center">{popupForm.title}</h3>
            {popupForm.description && (
              <p className="text-gray-300 text-center whitespace-pre-wrap">{popupForm.description}</p>
            )}
            {(popupForm.imageUrl || selectedSponsor?.logoUrl) && (
              <div className="relative w-full h-48 rounded-lg overflow-hidden bg-white/5">
                <Image
                  src={optimizeCloudinaryImage(popupForm.imageUrl || selectedSponsor?.logoUrl || '', 800, 384)}
                  unoptimized
                  alt="Preview"
                  fill
                  className="object-contain p-4"
                />
              </div>
            )}
            {selectedSponsor && (
              <p className="text-gray-400 text-center text-sm">
                Tıklandığında: {selectedSponsor.name}
              </p>
            )}
          </div>
        </Card>
      )}
    </>
  )
}

