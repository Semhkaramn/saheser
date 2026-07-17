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

export default function BannerSettings() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([])
  const [sponsorBannerEnabled, setSponsorBannerEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [draggedItem, setDraggedItem] = useState<number | null>(null)

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

      // ✅ FIX: Sadece order'a göre sırala - kullanıcının belirlediği sıra korunur
      setSponsors((sponsorsData.sponsors || []).sort((a: Sponsor, b: Sponsor) => a.order - b.order))

      const bannerSetting = settingsData.settings.find((s: Setting) => s.key === 'sponsor_banner_enabled')
      setSponsorBannerEnabled(bannerSetting?.value === 'true')
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Veriler yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  async function toggleBanner() {
    const newValue = !sponsorBannerEnabled
    setSponsorBannerEnabled(newValue)
    setSaving(true)

    try {
      const token = localStorage.getItem('admin_token')
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ key: 'sponsor_banner_enabled', value: newValue.toString() })
      })

      const data = await response.json()
      if (data.success) {
        toast.success(newValue ? 'Banner aktif edildi' : 'Banner kapatıldı')
      } else {
        setSponsorBannerEnabled(!newValue)
        toast.error(data.error || 'İşlem başarısız')
      }
    } catch (error) {
      setSponsorBannerEnabled(!newValue)
      toast.error('Bir hata oluştu')
    } finally {
      setSaving(false)
    }
  }

  async function toggleSponsorInBanner(sponsorId: string, currentValue: boolean) {
    try {
      const token = localStorage.getItem('admin_token')
      const response = await fetch(`/api/admin/sponsors/${sponsorId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ showInBanner: !currentValue })
      })

      const data = await response.json()
      if (data.sponsor) {
        setSponsors(prev => prev.map(s =>
          s.id === sponsorId ? { ...s, showInBanner: !currentValue } : s
        ))
        toast.success(!currentValue ? 'Sponsor banner\'a eklendi' : 'Sponsor banner\'dan çıkarıldı')
      }
    } catch (error) {
      toast.error('Bir hata oluştu')
    }
  }

  function handleDragStart(index: number) {
    setDraggedItem(index)
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    if (draggedItem === null || draggedItem === index) return

    const newSponsors = [...sponsors]
    const draggedSponsor = newSponsors[draggedItem]
    newSponsors.splice(draggedItem, 1)
    newSponsors.splice(index, 0, draggedSponsor)

    setSponsors(newSponsors)
    setDraggedItem(index)
  }

  async function handleDragEnd() {
    if (draggedItem === null) return

    try {
      const updates = sponsors.map((sponsor, index) => ({
        id: sponsor.id,
        order: index
      }))

      const token = localStorage.getItem('admin_token')
      const response = await fetch('/api/admin/sponsors/reorder', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ sponsors: updates })
      })

      const data = await response.json()
      if (data.success) {
        toast.success('Sıralama kaydedildi')
      } else {
        loadData()
      }
    } catch (error) {
      toast.error('Bir hata oluştu')
      loadData()
    } finally {
      setDraggedItem(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  const bannerSponsors = sponsors.filter(s => s.showInBanner && s.isActive && s.logoUrl)

  return (
    <>
      {/* Banner Toggle */}
      <Card className="admin-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white mb-2">Kayan Banner Durumu</h2>
            <p className="text-gray-400 text-sm">
              Banner açıkken seçili sponsorlar ana sayfada kayan şerit halinde görünür
            </p>
          </div>
          <button
            onClick={toggleBanner}
            disabled={saving}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ml-4 ${
              sponsorBannerEnabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'
            }`}
          >
            {sponsorBannerEnabled ? 'Açık' : 'Kapalı'}
          </button>
        </div>

        <div className={`mt-4 p-4 rounded-lg border ${sponsorBannerEnabled ? 'bg-green-500/10 border-green-500/30' : 'bg-gray-500/10 border-gray-500/30'}`}>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${sponsorBannerEnabled ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></div>
            <span className="text-white font-medium">
              {sponsorBannerEnabled ? `Banner Aktif - ${bannerSponsors.length} sponsor gösteriliyor` : 'Banner Kapalı'}
            </span>
          </div>
        </div>
      </Card>

      {/* Sponsors List */}
      <Card className="admin-card p-6">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-white mb-2">Banner'da Gösterilecek Sponsorlar</h2>
          <p className="text-gray-400 text-sm">
            Sponsorları sürükleyerek sıralayın. İlk sponsor en sağdan başlayacak.
          </p>
        </div>

        {sponsors.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400 mb-3">Henüz sponsor eklenmemiş</p>
            <Link href="/admin/sponsors">
              <Button className="admin-btn-primary">Sponsor Ekle</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {sponsors.map((sponsor, index) => (
              <div
                key={sponsor.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-4 p-4 rounded-lg border transition-all cursor-move ${
                  sponsor.showInBanner && sponsor.isActive && sponsor.logoUrl
                    ? 'bg-blue-500/10 border-blue-500/30'
                    : 'admin-card'
                } ${draggedItem === index ? 'opacity-50' : ''} hover:border-blue-500/50`}
              >
                <GripVertical className="w-5 h-5 admin-text-muted" />
                <div className="text-white font-bold text-lg bg-white/10 rounded-full w-8 h-8 flex items-center justify-center">
                  {index + 1}
                </div>

                {sponsor.logoUrl && (
                  <div className={`w-24 h-12 rounded-lg overflow-hidden flex-shrink-0 ${
                    sponsor.category === 'vip'
                      ? 'border-2 border-yellow-500/60 bg-gradient-to-br from-yellow-900/30 to-amber-800/30'
                      : 'border border-white/10 bg-white/5'
                  }`}>
                    <Image
                      src={optimizeCloudinaryImage(sponsor.logoUrl, 192, 96)}
                      unoptimized
                      alt={sponsor.name}
                      width={96}
                      height={48}
                      className="object-contain w-full h-full p-1"
                    />
                  </div>
                )}

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-semibold">{sponsor.name}</h3>
                    {sponsor.category === 'vip' && (
                      <span className="bg-gradient-to-r from-yellow-400 to-amber-500 text-black text-xs font-bold px-2 py-0.5 rounded">
                        VIP
                      </span>
                    )}
                    {!sponsor.isActive && (
                      <span className="bg-red-500/20 text-red-400 text-xs font-bold px-2 py-0.5 rounded border border-red-500/30">
                        Pasif
                      </span>
                    )}
                    {!sponsor.logoUrl && (
                      <span className="bg-orange-500/20 text-orange-400 text-xs font-bold px-2 py-0.5 rounded border border-orange-500/30">
                        Logo Yok
                      </span>
                    )}
                  </div>
                </div>

                <Button
                  size="sm"
                  variant={sponsor.showInBanner && sponsor.isActive && sponsor.logoUrl ? "default" : "outline"}
                  onClick={() => toggleSponsorInBanner(sponsor.id, sponsor.showInBanner)}
                  disabled={!sponsor.isActive || !sponsor.logoUrl}
                  className={sponsor.showInBanner && sponsor.isActive && sponsor.logoUrl
                    ? "bg-green-600 hover:bg-green-700"
                    : "admin-btn-outline"
                  }
                >
                  {sponsor.showInBanner && sponsor.isActive && sponsor.logoUrl ? (
                    <>
                      <Eye className="w-4 h-4 mr-2" />
                      Banner'da
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-4 h-4 mr-2" />
                      Gizli
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="bg-blue-500/10 border-blue-500/30 p-4">
        <h4 className="text-blue-300 font-semibold mb-2">💡 Sponsor Yönetimi</h4>
        <p className="text-blue-200 text-sm mb-3">
          Sponsor eklemek, düzenlemek veya silmek için Sponsor Yönetimi sayfasına gidin
        </p>
        <Link href="/admin/sponsors">
          <Button className="admin-btn-primary">Sponsorları Yönet</Button>
        </Link>
      </Card>
    </>
  )
}

