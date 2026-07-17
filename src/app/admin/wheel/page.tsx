'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Plus, Edit, Trash2, Ticket, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

// Sabit mavi tema renkleri
const theme = {
  primary: '#3b82f6',
  primaryLight: '#60a5fa',
  primaryDark: '#2563eb',
  gradientFrom: '#3b82f6',
  gradientTo: '#1d4ed8',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  card: 'rgba(30, 41, 59, 0.8)',
  cardHover: 'rgba(30, 41, 59, 0.95)',
  border: 'rgba(71, 85, 105, 0.5)',
  text: '#f1f5f9',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  background: '#0f172a',
  backgroundSecondary: '#1e293b',
}

interface WheelPrize {
  id: string
  name: string
  points: number
  probability: number
  color: string
  isActive: boolean
  order: number
  _count?: {
    wheelSpins: number
  }
}

export default function AdminWheelPage() {
  const router = useRouter()
  const [prizes, setPrizes] = useState<WheelPrize[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPrize, setEditingPrize] = useState<WheelPrize | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    points: 0,
    probability: 1.0,
    color: '#FF6B6B',
    order: 0
  })

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (!token) {
      router.push('/admin')
      return
    }
    loadPrizes()
  }, [router])

  async function loadPrizes() {
    try {
      const response = await fetch('/api/admin/wheel')
      const data = await response.json()
      setPrizes(data.prizes || [])
    } catch (error) {
      console.error('Error loading prizes:', error)
      toast.error('Ödüller yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  function openDialog(prize?: WheelPrize) {
    if (prize) {
      setEditingPrize(prize)
      setFormData({
        name: prize.name,
        points: prize.points,
        probability: prize.probability,
        color: prize.color,
        order: prize.order
      })
    } else {
      setEditingPrize(null)
      setFormData({
        name: '',
        points: 0,
        probability: 1.0,
        color: '#FF6B6B',
        order: prizes.length
      })
    }
    setDialogOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    try {
      const url = editingPrize
        ? `/api/admin/wheel/${editingPrize.id}`
        : '/api/admin/wheel'

      const method = editingPrize ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (data.prize) {
        toast.success(editingPrize ? 'Ödül güncellendi' : 'Ödül eklendi')
        setDialogOpen(false)
        loadPrizes()
      } else {
        toast.error(data.error || 'İşlem başarısız')
      }
    } catch (error) {
      console.error('Submit error:', error)
      toast.error('Bir hata oluştu')
    }
  }

  async function handleDelete(id: string) {
    setDeleteId(id)
    setConfirmOpen(true)
  }

  async function confirmDelete() {
    if (!deleteId) return

    try {
      const response = await fetch(`/api/admin/wheel/${deleteId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Ödül silindi')
        loadPrizes()
      } else {
        toast.error(data.error || 'Silme başarısız')
      }
    } catch (error) {
      console.error('Delete error:', error)
      toast.error('Bir hata oluştu')
    } finally {
      setConfirmOpen(false)
      setDeleteId(null)
    }
  }

  async function toggleActive(id: string, currentActive: boolean) {
    try {
      const response = await fetch(`/api/admin/wheel/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentActive })
      })

      const data = await response.json()

      if (data.prize) {
        toast.success('Durum güncellendi')
        loadPrizes()
      } else {
        toast.error(data.error || 'Güncelleme başarısız')
      }
    } catch (error) {
      console.error('Toggle error:', error)
      toast.error('Bir hata oluştu')
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen" style={{ background: theme.background }}>
        <Loader2 className="w-8 h-8 animate-spin mb-3" style={{ color: theme.primary }} />
        <p className="text-sm" style={{ color: theme.textMuted }}>Ödüller yükleniyor...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: theme.background }}>
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold mb-1 flex items-center gap-2" style={{ color: theme.text }}>
              <Ticket className="w-6 h-6" />
              Çark Ödülleri
            </h1>
            <p className="text-sm" style={{ color: theme.textMuted }}>Şans çarkı ödüllerini yönetin</p>
          </div>
          <Button
            onClick={() => openDialog()}
            className="font-semibold rounded-xl px-5 h-10 text-sm border-0 transition-all duration-200 hover:scale-105"
            style={{
              background: `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})`,
              color: 'white',
              boxShadow: `0 4px 16px ${theme.gradientFrom}40`
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Yeni Ödül Ekle
          </Button>
        </div>

        {/* Prizes Table */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: theme.card,
            border: `1px solid ${theme.border}`,
            boxShadow: `0 8px 32px ${theme.gradientFrom}10`
          }}
        >
          {prizes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: `${theme.primary}15`, border: `1px solid ${theme.primary}20` }}
              >
                <Ticket className="w-8 h-8" style={{ color: `${theme.primary}60` }} />
              </div>
              <h3 className="text-sm font-semibold mb-1" style={{ color: theme.textSecondary }}>Henüz ödül eklenmemiş</h3>
              <p className="text-xs" style={{ color: theme.textMuted }}>Yeni bir ödül eklemek için yukarıdaki butonu kullanın</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead style={{ background: `${theme.backgroundSecondary}80`, borderBottom: `1px solid ${theme.border}` }}>
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: theme.textMuted }}>Renk</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: theme.textMuted }}>Ödül Adı</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: theme.textMuted }}>Puan</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: theme.textMuted }}>Olasılık</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: theme.textMuted }}>Kazanım</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: theme.textMuted }}>Durum</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: theme.textMuted }}>İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {prizes.map((prize, index) => (
                    <tr
                      key={prize.id}
                      className="transition-colors"
                      style={{
                        borderBottom: `1px solid ${theme.border}`,
                        background: index % 2 === 0 ? 'transparent' : `${theme.backgroundSecondary}30`
                      }}
                    >
                      <td className="px-6 py-4">
                        <div
                          className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm"
                          style={{ backgroundColor: prize.color }}
                        >
                          {prize.points}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold" style={{ color: theme.text }}>{prize.name}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span style={{ color: '#facc15' }}>{prize.points}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span style={{ color: '#a855f7' }}>{prize.probability}</span>
                      </td>
                      <td className="px-6 py-4">
                        {prize._count && (
                          <span style={{ color: theme.success }}>{prize._count.wheelSpins}</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                          style={{
                            background: prize.isActive ? `${theme.success}20` : `${theme.textMuted}20`,
                            color: prize.isActive ? theme.success : theme.textMuted
                          }}
                        >
                          {prize.isActive ? 'Aktif' : 'Pasif'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            onClick={() => toggleActive(prize.id, prize.isActive)}
                            className="text-xs px-3 py-1.5 rounded-lg font-semibold border-0"
                            style={{
                              background: prize.isActive ? `${theme.textMuted}20` : `${theme.success}20`,
                              color: prize.isActive ? theme.textMuted : theme.success
                            }}
                          >
                            {prize.isActive ? 'Devre Dışı' : 'Aktif Et'}
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => openDialog(prize)}
                            className="text-xs px-3 py-1.5 rounded-lg font-semibold border-0"
                            style={{
                              background: `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})`,
                              color: 'white'
                            }}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleDelete(prize.id)}
                            className="text-xs px-3 py-1.5 rounded-lg font-semibold border-0"
                            style={{ background: `${theme.danger}20`, color: theme.danger }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="max-w-md"
          style={{
            background: theme.backgroundSecondary,
            border: `1px solid ${theme.border}`,
            color: theme.text
          }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: theme.text }}>
              {editingPrize ? 'Ödülü Düzenle' : 'Yeni Ödül Ekle'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name" style={{ color: theme.text }}>Ödül Adı</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 border-0"
                style={{ background: theme.background, color: theme.text, border: `1px solid ${theme.border}` }}
                placeholder="Örn: Büyük Ödül"
                required
              />
            </div>

            <div>
              <Label htmlFor="points" style={{ color: theme.text }}>Puan</Label>
              <Input
                id="points"
                type="number"
                value={formData.points}
                onChange={(e) => setFormData({ ...formData, points: parseInt(e.target.value) })}
                className="mt-1 border-0"
                style={{ background: theme.background, color: theme.text, border: `1px solid ${theme.border}` }}
                min="0"
                required
              />
            </div>

            <div>
              <Label htmlFor="probability" style={{ color: theme.text }}>Olasılık (1.0 = Normal)</Label>
              <Input
                id="probability"
                type="number"
                step="0.1"
                value={formData.probability}
                onChange={(e) => setFormData({ ...formData, probability: parseFloat(e.target.value) })}
                className="mt-1 border-0"
                style={{ background: theme.background, color: theme.text, border: `1px solid ${theme.border}` }}
                min="0.1"
                max="10"
                required
              />
              <p className="text-xs mt-1" style={{ color: theme.textMuted }}>
                Yüksek değer = Daha sık çıkar
              </p>
            </div>

            <div>
              <Label htmlFor="color" style={{ color: theme.text }}>Renk</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="color"
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-20 h-10 border-0"
                  style={{ background: theme.background, border: `1px solid ${theme.border}` }}
                  required
                />
                <Input
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="flex-1 border-0"
                  style={{ background: theme.background, color: theme.text, border: `1px solid ${theme.border}` }}
                  placeholder="#FF6B6B"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="order" style={{ color: theme.text }}>Sıralama (Çarkta gösterim sırası)</Label>
              <Input
                id="order"
                type="number"
                value={formData.order}
                onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) })}
                className="mt-1 border-0"
                style={{ background: theme.background, color: theme.text, border: `1px solid ${theme.border}` }}
                min="0"
                required
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="flex-1 border-0"
                style={{ background: `${theme.textMuted}20`, color: theme.text }}
              >
                İptal
              </Button>
              <Button
                type="submit"
                className="flex-1 border-0"
                style={{
                  background: `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})`,
                  color: 'white'
                }}
              >
                {editingPrize ? 'Güncelle' : 'Ekle'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Ödülü Sil"
        description="Bu ödülü silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
        onConfirm={confirmDelete}
      />
    </div>
  )
}
