'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Plus, Edit, Trash2, BarChart3, Coins, Loader2 } from 'lucide-react'
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

interface Rank {
  id: string
  name: string
  minXp: number
  icon: string
  color: string
  order: number
  pointsReward: number
  _count?: {
    users: number
  }
}

export default function AdminRanksPage() {
  const router = useRouter()
  const [ranks, setRanks] = useState<Rank[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRank, setEditingRank] = useState<Rank | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    minXp: 0,
    icon: '⭐',
    color: '#FFD700',
    order: 0,
    pointsReward: 0
  })

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (!token) {
      router.push('/admin')
      return
    }
    loadRanks()
  }, [router])

  async function loadRanks() {
    try {
      const response = await fetch('/api/admin/ranks')
      const data = await response.json()
      setRanks(data.ranks || [])
    } catch (error) {
      console.error('Error loading ranks:', error)
      toast.error('Rütbeler yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  function openDialog(rank?: Rank) {
    if (rank) {
      setEditingRank(rank)
      setFormData({
        name: rank.name,
        minXp: rank.minXp,
        icon: rank.icon,
        color: rank.color,
        order: rank.order,
        pointsReward: rank.pointsReward || 0
      })
    } else {
      setEditingRank(null)
      setFormData({
        name: '',
        minXp: 0,
        icon: '⭐',
        color: '#FFD700',
        order: ranks.length,
        pointsReward: 0
      })
    }
    setDialogOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    try {
      const url = editingRank
        ? `/api/admin/ranks/${editingRank.id}`
        : '/api/admin/ranks'

      const method = editingRank ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (data.rank) {
        toast.success(editingRank ? 'Rütbe güncellendi' : 'Rütbe eklendi')
        setDialogOpen(false)
        loadRanks()
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
      const response = await fetch(`/api/admin/ranks/${deleteId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Rütbe silindi')
        loadRanks()
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen" style={{ background: theme.background }}>
        <Loader2 className="w-8 h-8 animate-spin mb-3" style={{ color: theme.primary }} />
        <p className="text-sm" style={{ color: theme.textMuted }}>Rütbeler yükleniyor...</p>
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
              <BarChart3 className="w-6 h-6" />
              Rütbe Sistemi
            </h1>
            <p className="text-sm" style={{ color: theme.textMuted }}>Rütbeleri yönetin</p>
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
            Yeni Rütbe Ekle
          </Button>
        </div>

        {/* Ranks Table */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: theme.card,
            border: `1px solid ${theme.border}`,
            boxShadow: `0 8px 32px ${theme.gradientFrom}10`
          }}
        >
          {ranks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: `${theme.primary}15`, border: `1px solid ${theme.primary}20` }}
              >
                <BarChart3 className="w-8 h-8" style={{ color: `${theme.primary}60` }} />
              </div>
              <h3 className="text-sm font-semibold mb-1" style={{ color: theme.textSecondary }}>Henüz rütbe eklenmemiş</h3>
              <p className="text-xs" style={{ color: theme.textMuted }}>Yeni bir rütbe eklemek için yukarıdaki butonu kullanın</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead style={{ background: `${theme.backgroundSecondary}80`, borderBottom: `1px solid ${theme.border}` }}>
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: theme.textMuted }}>İkon</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: theme.textMuted }}>Rütbe Adı</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: theme.textMuted }}>Minimum XP</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: theme.textMuted }}>Puan Ödülü</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: theme.textMuted }}>Kullanıcı</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: theme.textMuted }}>İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {ranks.map((rank, index) => (
                    <tr
                      key={rank.id}
                      className="transition-colors"
                      style={{
                        borderBottom: `1px solid ${theme.border}`,
                        background: index % 2 === 0 ? 'transparent' : `${theme.backgroundSecondary}30`
                      }}
                    >
                      <td className="px-6 py-4">
                        <div
                          className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
                          style={{ backgroundColor: `${rank.color}20`, color: rank.color }}
                        >
                          {rank.icon}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold" style={{ color: rank.color }}>
                          {rank.name}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span style={{ color: '#a855f7' }}>{rank.minXp.toLocaleString('tr-TR')} XP</span>
                      </td>
                      <td className="px-6 py-4">
                        {rank.pointsReward > 0 ? (
                          <span className="flex items-center gap-1" style={{ color: '#f59e0b' }}>
                            <Coins className="w-4 h-4" />
                            +{rank.pointsReward.toLocaleString('tr-TR')}
                          </span>
                        ) : (
                          <span style={{ color: theme.textMuted }}>-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {rank._count && (
                          <span style={{ color: theme.success }}>{rank._count.users}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            onClick={() => openDialog(rank)}
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
                            onClick={() => handleDelete(rank.id)}
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
          className="max-w-md max-h-[90vh] overflow-y-auto"
          style={{
            background: theme.backgroundSecondary,
            border: `1px solid ${theme.border}`,
            color: theme.text
          }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: theme.text }}>
              {editingRank ? 'Rütbeyi Düzenle' : 'Yeni Rütbe Ekle'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name" style={{ color: theme.text }}>Rütbe Adı</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 border-0"
                style={{ background: theme.background, color: theme.text, border: `1px solid ${theme.border}` }}
                placeholder="Örn: Altın Üye"
                required
              />
            </div>

            <div>
              <Label htmlFor="minXp" style={{ color: theme.text }}>Minimum XP</Label>
              <Input
                id="minXp"
                type="number"
                value={formData.minXp}
                onChange={(e) => setFormData({ ...formData, minXp: parseInt(e.target.value) })}
                className="mt-1 border-0"
                style={{ background: theme.background, color: theme.text, border: `1px solid ${theme.border}` }}
                min="0"
                required
              />
            </div>

            <div>
              <Label htmlFor="pointsReward" className="flex items-center gap-1" style={{ color: theme.text }}>
                <Coins className="w-4 h-4" style={{ color: '#f59e0b' }} />
                Puan Ödülü (Rütbe Yükselme Bonusu)
              </Label>
              <Input
                id="pointsReward"
                type="number"
                value={formData.pointsReward}
                onChange={(e) => setFormData({ ...formData, pointsReward: parseInt(e.target.value) || 0 })}
                className="mt-1 border-0"
                style={{ background: theme.background, color: theme.text, border: `1px solid ${theme.border}` }}
                min="0"
                placeholder="0"
              />
              <p className="text-xs mt-1" style={{ color: theme.textMuted }}>
                Bu rütbeye ulaşıldığında kullanıcıya verilecek puan
              </p>
            </div>

            <div>
              <Label htmlFor="icon" style={{ color: theme.text }}>İkon (Emoji)</Label>
              <Input
                id="icon"
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                className="mt-1 border-0"
                style={{ background: theme.background, color: theme.text, border: `1px solid ${theme.border}` }}
                placeholder="⭐"
                required
              />
              <p className="text-xs mt-1" style={{ color: theme.textMuted }}>
                Emoji seçmek için Windows: Win + . veya Mac: Cmd + Ctrl + Space
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
                  placeholder="#FFD700"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="order" style={{ color: theme.text }}>Sıralama</Label>
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
                {editingRank ? 'Güncelle' : 'Ekle'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Rütbe Silme"
        description="Bu rütbeyi silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
        onConfirm={confirmDelete}
      />
    </div>
  )
}
