'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, MonitorPlay, GripVertical, Eye, EyeOff, Share2, Plus, Edit2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { Switch } from '@/components/ui/switch'
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

export default function SocialMediaSettings() {
  const [socialMedia, setSocialMedia] = useState<SocialMedia[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [draggedItem, setDraggedItem] = useState<number | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<SocialMedia | null>(null)
  const [form, setForm] = useState({
    name: '',
    platform: '',
    username: ''
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const response = await fetch('/api/admin/social-media')
      const data = await response.json()
      setSocialMedia(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error loading social media:', error)
      toast.error('Sosyal medya bağlantıları yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  async function saveItem() {
    if (!form.name || !form.platform || !form.username) {
      toast.error('Tüm alanları doldurun')
      return
    }

    setSaving(true)
    try {
      const url = editingItem
        ? `/api/admin/social-media/${editingItem.id}`
        : '/api/admin/social-media'

      const response = await fetch(url, {
        method: editingItem ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          isActive: true,
          order: editingItem?.order ?? socialMedia.length
        })
      })

      const data = await response.json()
      if (data.id) {
        toast.success(editingItem ? 'Güncellendi' : 'Eklendi')
        loadData()
        closeDialog()
      } else {
        toast.error(data.error || 'İşlem başarısız')
      }
    } catch (error) {
      toast.error('Bir hata oluştu')
    } finally {
      setSaving(false)
    }
  }

  async function deleteItem(id: string) {
    if (!confirm('Silmek istediğinize emin misiniz?')) return

    try {
      const response = await fetch(`/api/admin/social-media/${id}`, { method: 'DELETE' })
      const data = await response.json()
      if (data.success) {
        toast.success('Silindi')
        loadData()
      } else {
        toast.error(data.error || 'Silme başarısız')
      }
    } catch (error) {
      toast.error('Bir hata oluştu')
    }
  }

  async function toggleActive(id: string, currentValue: boolean) {
    try {
      const item = socialMedia.find(s => s.id === id)
      if (!item) return

      const response = await fetch(`/api/admin/social-media/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...item, isActive: !currentValue })
      })

      const data = await response.json()
      if (data.id) {
        setSocialMedia(prev => prev.map(s =>
          s.id === id ? { ...s, isActive: !currentValue } : s
        ))
        toast.success(!currentValue ? 'Aktif edildi' : 'Pasif edildi')
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

    const newItems = [...socialMedia]
    const draggedItemData = newItems[draggedItem]
    newItems.splice(draggedItem, 1)
    newItems.splice(index, 0, draggedItemData)

    setSocialMedia(newItems)
    setDraggedItem(index)
  }

  async function handleDragEnd() {
    if (draggedItem === null) return

    try {
      const updates = socialMedia.map((item, index) => ({
        id: item.id,
        order: index
      }))

      const response = await fetch('/api/admin/social-media/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: updates })
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

  function openDialog(item?: SocialMedia) {
    if (item) {
      setEditingItem(item)
      setForm({
        name: item.name,
        platform: item.platform,
        username: item.username
      })
    } else {
      setEditingItem(null)
      setForm({ name: '', platform: '', username: '' })
    }
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
    setEditingItem(null)
    setForm({ name: '', platform: '', username: '' })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => openDialog()} className="admin-btn-primary">
          <Plus className="w-4 h-4 mr-2" />
          Sosyal Medya Ekle
        </Button>
      </div>

      <Card className="admin-card p-6">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-white mb-2">Sosyal Medya Bağlantıları</h2>
          <p className="text-gray-400 text-sm">
            Aktif olanlar sidebar'ın en altında görünecektir. Sürükleyerek sıralayın.
          </p>
        </div>

        {socialMedia.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400 mb-3">Henüz sosyal medya bağlantısı eklenmemiş</p>
            <Button onClick={() => openDialog()} className="admin-btn-primary">
              <Plus className="w-4 h-4 mr-2" />
              Sosyal Medya Ekle
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {socialMedia.map((item, index) => (
              <div
                key={item.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-4 p-4 rounded-lg border transition-all cursor-move ${
                  item.isActive
                    ? 'bg-blue-500/10 border-blue-500/30'
                    : 'admin-card'
                } ${draggedItem === index ? 'opacity-50' : ''} hover:border-blue-500/50`}
              >
                <GripVertical className="w-5 h-5 admin-text-muted" />
                <div className="text-white font-bold text-lg bg-white/10 rounded-full w-8 h-8 flex items-center justify-center">
                  {index + 1}
                </div>
                <div className="text-2xl">{SOCIAL_PLATFORMS.find(p => p.value === item.platform)?.icon}</div>

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-semibold">{item.name}</h3>
                    <span className="text-gray-400 text-xs bg-white/10 px-2 py-0.5 rounded">
                      {SOCIAL_PLATFORMS.find(p => p.value === item.platform)?.label}
                    </span>
                    {!item.isActive && (
                      <span className="bg-red-500/20 text-red-400 text-xs font-bold px-2 py-0.5 rounded border border-red-500/30">
                        Pasif
                      </span>
                    )}
                  </div>
                  <p className="text-gray-400 text-sm mt-1">{item.username}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={item.isActive ? "default" : "outline"}
                    onClick={() => toggleActive(item.id, item.isActive)}
                    className={`${item.isActive
                      ? "bg-green-600 hover:bg-green-700"
                      : "admin-btn-outline"
                    }`}
                  >
                    {item.isActive ? (
                      <>
                        <Eye className="w-4 h-4 md:mr-2" />
                        <span className="hidden md:inline">Aktif</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-4 h-4 md:mr-2" />
                        <span className="hidden md:inline">Pasif</span>
                      </>
                    )}
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openDialog(item)}
                    className="admin-btn-outline"
                  >
                    <Edit2 className="w-4 h-4" />
                    <span className="hidden md:inline ml-2">Düzenle</span>
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => deleteItem(item.id)}
                    className="border-red-500/30 hover:bg-red-500/20 text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden md:inline ml-2">Sil</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-gray-900 border-white/10">
          <DialogHeader>
            <DialogTitle className="admin-text-primary">
              {editingItem ? 'Sosyal Medya Güncelle' : 'Yeni Sosyal Medya Ekle'}
            </DialogTitle>
            <DialogDescription className="admin-text-muted">
              {editingItem ? 'Mevcut sosyal medya bilgilerini güncelleyin' : 'Yeni sosyal medya bağlantısı ekleyin'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name" className="admin-text-primary">Gösterilecek İsim</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Örn: Telegram Kanalımız"
                className="admin-card text-white mt-2"
              />
            </div>

            <div>
              <Label htmlFor="platform" className="admin-text-primary">Platform</Label>
              <Select
                value={form.platform}
                onValueChange={(value) => setForm(prev => ({ ...prev, platform: value }))}
              >
                <SelectTrigger className="admin-card text-white mt-2">
                  <SelectValue placeholder="Platform seçin" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-white/10">
                  {SOCIAL_PLATFORMS.map(platform => (
                    <SelectItem key={platform.value} value={platform.value} className="admin-text-primary">
                      {platform.icon} {platform.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="username" className="admin-text-primary">Kullanıcı Adı / Link</Label>
              <Input
                id="username"
                value={form.username}
                onChange={(e) => setForm(prev => ({ ...prev, username: e.target.value }))}
                placeholder={form.platform === 'telegram' ? 'harley' : 'kullaniciadi veya tam link'}
                className="admin-card text-white mt-2"
              />
              <p className="text-xs admin-page-subtitle">
                {form.platform === 'telegram'
                  ? '@ işareti olmadan sadece kullanıcı adı yazın'
                  : 'Kullanıcı adı veya tam link girebilirsiniz'}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeDialog}
              disabled={saving}
              className="admin-btn-outline"
            >
              İptal
            </Button>
            <Button
              onClick={saveItem}
              disabled={saving}
              className="admin-btn-primary"
            >
              {saving ? 'Kaydediliyor...' : editingItem ? 'Güncelle' : 'Ekle'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

