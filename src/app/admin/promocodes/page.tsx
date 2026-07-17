'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import AdminPermissionGuard from '@/components/AdminPermissionGuard'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import {
  Gift,
  Plus,
  Edit,
  Trash2,
  Copy,
  Users,
  Calendar,
  Star,
  Eye,
  Check
} from 'lucide-react'
import { toast } from 'sonner'

interface Promocode {
  id: string
  code: string
  description: string | null
  points: number
  maxUses: number
  usedCount: number
  isActive: boolean
  expiresAt: string | null
  createdAt: string
  createdBy: string | null
  _count: {
    usages: number
  }
}

interface PromocodeUsage {
  id: string
  userId: string
  pointsEarned: number
  usedAt: string
  user: {
    id: string
    siteUsername: string | null
    email: string | null
    telegramUsername: string | null
    firstName: string | null
  } | null
}

interface PromocodeDetail extends Promocode {
  usages: PromocodeUsage[]
}

function PromocodesContent() {
  const [promocodes, setPromocodes] = useState<Promocode[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedPromocode, setSelectedPromocode] = useState<PromocodeDetail | null>(null)
  const [editingPromocode, setEditingPromocode] = useState<Promocode | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    code: '',
    description: '',
    points: '',
    maxUses: '',
    expiresAt: '',
    isActive: true
  })

  useEffect(() => {
    loadPromocodes()

    // Real-time güncelleme için polling (her 3 saniyede bir)
    const interval = setInterval(() => {
      loadPromocodesQuiet()
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  async function loadPromocodes() {
    try {
      const token = localStorage.getItem('admin_token')
      const res = await fetch('/api/admin/promocodes', {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (res.ok) {
        const data = await res.json()
        setPromocodes(data.promocodes || [])
      }
    } catch (error) {
      console.error('Promocodes yüklenirken hata:', error)
      toast.error('Promocodlar yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  // Sessiz güncelleme - loading göstermeden
  async function loadPromocodesQuiet() {
    try {
      const token = localStorage.getItem('admin_token')
      const res = await fetch('/api/admin/promocodes', {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (res.ok) {
        const data = await res.json()
        setPromocodes(data.promocodes || [])
      }
    } catch (error) {
      // Sessiz hata - loglama yapma
    }
  }

  async function loadPromocodeDetail(id: string) {
    try {
      const token = localStorage.getItem('admin_token')
      const res = await fetch(`/api/admin/promocodes/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (res.ok) {
        const data = await res.json()
        setSelectedPromocode(data.promocode)
        setDetailOpen(true)
      }
    } catch (error) {
      console.error('Promocode detay yüklenirken hata:', error)
      toast.error('Detaylar yüklenemedi')
    }
  }

  // Detay modalı real-time güncelleme
  useEffect(() => {
    if (!detailOpen || !selectedPromocode) return

    const interval = setInterval(async () => {
      try {
        const token = localStorage.getItem('admin_token')
        const res = await fetch(`/api/admin/promocodes/${selectedPromocode.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        })

        if (res.ok) {
          const data = await res.json()
          setSelectedPromocode(data.promocode)
        }
      } catch (error) {
        // Sessiz hata
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [detailOpen, selectedPromocode?.id])

  function resetForm() {
    setFormData({
      code: '',
      description: '',
      points: '',
      maxUses: '',
      expiresAt: '',
      isActive: true
    })
  }

  function generateRandomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let code = ''
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setFormData(prev => ({ ...prev, code }))
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return

    if (!formData.code || !formData.points || !formData.maxUses) {
      toast.error('Kod, puan ve maksimum kullanım zorunludur')
      return
    }

    setSubmitting(true)

    try {
      const token = localStorage.getItem('admin_token')
      const res = await fetch('/api/admin/promocodes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          code: formData.code,
          description: formData.description || null,
          points: Number(formData.points),
          maxUses: Number(formData.maxUses),
          expiresAt: formData.expiresAt || null
        })
      })

      if (res.ok) {
        toast.success('Promocode oluşturuldu')
        setCreateOpen(false)
        resetForm()
        loadPromocodes()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Hata oluştu')
      }
    } catch (error) {
      console.error('Promocode oluşturma hatası:', error)
      toast.error('Bir hata oluştu')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (submitting || !editingPromocode) return

    setSubmitting(true)

    try {
      const token = localStorage.getItem('admin_token')
      const res = await fetch(`/api/admin/promocodes/${editingPromocode.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          code: formData.code,
          description: formData.description || null,
          points: Number(formData.points),
          maxUses: Number(formData.maxUses),
          expiresAt: formData.expiresAt || null,
          isActive: formData.isActive
        })
      })

      if (res.ok) {
        toast.success('Promocode güncellendi')
        setEditOpen(false)
        resetForm()
        setEditingPromocode(null)
        loadPromocodes()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Hata oluştu')
      }
    } catch (error) {
      console.error('Promocode güncelleme hatası:', error)
      toast.error('Bir hata oluştu')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Bu promocode\'u silmek istediğinizden emin misiniz?')) return

    try {
      const token = localStorage.getItem('admin_token')
      const res = await fetch(`/api/admin/promocodes/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })

      if (res.ok) {
        toast.success('Promocode silindi')
        loadPromocodes()
      } else {
        toast.error('Silme işlemi başarısız')
      }
    } catch (error) {
      console.error('Promocode silme hatası:', error)
      toast.error('Bir hata oluştu')
    }
  }

  async function handleToggleActive(promo: Promocode) {
    try {
      const token = localStorage.getItem('admin_token')
      const res = await fetch(`/api/admin/promocodes/${promo.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ isActive: !promo.isActive })
      })

      if (res.ok) {
        toast.success(promo.isActive ? 'Promocode devre dışı bırakıldı' : 'Promocode aktifleştirildi')
        loadPromocodes()
      }
    } catch (error) {
      console.error('Toggle hatası:', error)
    }
  }

  function openEditModal(promo: Promocode) {
    setEditingPromocode(promo)
    setFormData({
      code: promo.code,
      description: promo.description || '',
      points: String(promo.points),
      maxUses: String(promo.maxUses),
      expiresAt: promo.expiresAt ? new Date(promo.expiresAt).toISOString().slice(0, 16) : '',
      isActive: promo.isActive
    })
    setEditOpen(true)
  }

  function copyCode(code: string, id: string) {
    navigator.clipboard.writeText(code)
    setCopiedId(id)
    toast.success('Kod kopyalandı')
    setTimeout(() => setCopiedId(null), 2000)
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return <LoadingSpinner fullscreen />
  }

  return (
    <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center">
              <Gift className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Promocodlar</h1>
              <p className="text-slate-400">Promosyon kodlarını yönetin</p>
            </div>
          </div>

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button
                className="bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700"
                onClick={resetForm}
              >
                <Plus className="w-4 h-4 mr-2" />
                Yeni Promocode
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-700 max-w-md">
              <DialogHeader>
                <DialogTitle className="text-white">Yeni Promocode Oluştur</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">Kod</Label>
                  <div className="flex gap-2">
                    <Input
                      value={formData.code}
                      onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                      placeholder="PROMO2024"
                      className="bg-slate-800 border-slate-600 text-white flex-1"
                      required
                    />
                    <Button type="button" variant="outline" onClick={generateRandomCode} className="border-slate-600">
                      Rastgele
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Açıklama (Opsiyonel)</Label>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Yeni yıl kampanyası"
                    className="bg-slate-800 border-slate-600 text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Puan Miktarı</Label>
                    <Input
                      type="number"
                      value={formData.points}
                      onChange={(e) => setFormData(prev => ({ ...prev, points: e.target.value }))}
                      placeholder="100"
                      min="1"
                      className="bg-slate-800 border-slate-600 text-white"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-300">Maks. Kullanım</Label>
                    <Input
                      type="number"
                      value={formData.maxUses}
                      onChange={(e) => setFormData(prev => ({ ...prev, maxUses: e.target.value }))}
                      placeholder="100"
                      min="1"
                      className="bg-slate-800 border-slate-600 text-white"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Son Kullanım Tarihi (Opsiyonel)</Label>
                  <Input
                    type="datetime-local"
                    value={formData.expiresAt}
                    onChange={(e) => setFormData(prev => ({ ...prev, expiresAt: e.target.value }))}
                    className="bg-slate-800 border-slate-600 text-white"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} className="border-slate-600">
                    İptal
                  </Button>
                  <Button type="submit" disabled={submitting} className="bg-teal-500 hover:bg-teal-600">
                    {submitting ? 'Oluşturuluyor...' : 'Oluştur'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-slate-800/50 border-slate-700 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-teal-500/20 flex items-center justify-center">
                <Gift className="w-5 h-5 text-teal-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Toplam Kod</p>
                <p className="text-2xl font-bold text-white">{promocodes.length}</p>
              </div>
            </div>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <Check className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Aktif Kodlar</p>
                <p className="text-2xl font-bold text-white">
                  {promocodes.filter(p => p.isActive).length}
                </p>
              </div>
            </div>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Toplam Kullanım</p>
                <p className="text-2xl font-bold text-white">
                  {promocodes.reduce((acc, p) => acc + p.usedCount, 0)}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Promocodes Table */}
        <Card className="bg-slate-800/50 border-slate-700">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700">
                  <TableHead className="text-slate-400">Kod</TableHead>
                  <TableHead className="text-slate-400">Açıklama</TableHead>
                  <TableHead className="text-slate-400">Puan</TableHead>
                  <TableHead className="text-slate-400">Kullanım</TableHead>
                  <TableHead className="text-slate-400">Durum</TableHead>
                  <TableHead className="text-slate-400">Bitiş</TableHead>
                  <TableHead className="text-slate-400 text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {promocodes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-slate-500 py-8">
                      Henüz promocode oluşturulmamış
                    </TableCell>
                  </TableRow>
                ) : (
                  promocodes.map((promo) => (
                    <TableRow key={promo.id} className="border-slate-700">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="bg-slate-700 px-2 py-1 rounded text-teal-400 font-mono text-sm">
                            {promo.code}
                          </code>
                          <button
                            onClick={() => copyCode(promo.code, promo.id)}
                            className="text-slate-400 hover:text-white transition-colors"
                          >
                            {copiedId === promo.id ? (
                              <Check className="w-4 h-4 text-green-400" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-300">
                        {promo.description || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-yellow-400">
                          <Star className="w-4 h-4 fill-yellow-400" />
                          <span className="font-semibold">{promo.points}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`font-medium ${promo.usedCount >= promo.maxUses ? 'text-red-400' : 'text-slate-300'}`}>
                          {promo.usedCount} / {promo.maxUses}
                        </span>
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => handleToggleActive(promo)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            promo.isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'
                          }`}
                        >
                          {promo.isActive ? 'Açık' : 'Kapalı'}
                        </button>
                      </TableCell>
                      <TableCell className="text-slate-400 text-sm">
                        {promo.expiresAt ? formatDate(promo.expiresAt) : 'Süresiz'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1 sm:gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => loadPromocodeDetail(promo.id)}
                            className="text-slate-400 hover:text-white h-8 w-8 p-0 sm:h-9 sm:w-auto sm:px-3"
                            title="Detaylar"
                          >
                            <Eye className="w-4 h-4 flex-shrink-0" />
                            <span className="hidden sm:inline ml-1">Gör</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(promo)}
                            className="text-slate-400 hover:text-white h-8 w-8 p-0 sm:h-9 sm:w-auto sm:px-3"
                            title="Düzenle"
                          >
                            <Edit className="w-4 h-4 flex-shrink-0" />
                            <span className="hidden sm:inline ml-1">Düzenle</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(promo.id)}
                            className="text-red-400 hover:text-red-300 h-8 w-8 p-0 sm:h-9 sm:w-auto sm:px-3"
                            title="Sil"
                          >
                            <Trash2 className="w-4 h-4 flex-shrink-0" />
                            <span className="hidden sm:inline ml-1">Sil</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={editOpen} onOpenChange={(open) => {
          setEditOpen(open)
          if (!open) setEditingPromocode(null)
        }}>
          <DialogContent className="bg-slate-900 border-slate-700 max-w-md">
            <DialogHeader>
              <DialogTitle className="text-white">Promocode Düzenle</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Kod</Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  className="bg-slate-800 border-slate-600 text-white"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Açıklama</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="bg-slate-800 border-slate-600 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">Puan Miktarı</Label>
                  <Input
                    type="number"
                    value={formData.points}
                    onChange={(e) => setFormData(prev => ({ ...prev, points: e.target.value }))}
                    min="1"
                    className="bg-slate-800 border-slate-600 text-white"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Maks. Kullanım</Label>
                  <Input
                    type="number"
                    value={formData.maxUses}
                    onChange={(e) => setFormData(prev => ({ ...prev, maxUses: e.target.value }))}
                    min="1"
                    className="bg-slate-800 border-slate-600 text-white"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Son Kullanım Tarihi</Label>
                <Input
                  type="datetime-local"
                  value={formData.expiresAt}
                  onChange={(e) => setFormData(prev => ({ ...prev, expiresAt: e.target.value }))}
                  className="bg-slate-800 border-slate-600 text-white"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-slate-300">Aktif</Label>
                <button
                  onClick={() => setFormData(prev => ({ ...prev, isActive: !prev.isActive }))}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    formData.isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'
                  }`}
                >
                  {formData.isActive ? 'Açık' : 'Kapalı'}
                </button>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => {
                  setEditOpen(false)
                  setEditingPromocode(null)
                }} className="border-slate-600">
                  İptal
                </Button>
                <Button type="submit" disabled={submitting} className="bg-teal-500 hover:bg-teal-600">
                  {submitting ? 'Kaydediliyor...' : 'Kaydet'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Detail Dialog - Usage History */}
        <Dialog open={detailOpen} onOpenChange={(open) => {
          setDetailOpen(open)
          if (!open) setSelectedPromocode(null)
        }}>
          <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <code className="bg-slate-700 px-2 py-1 rounded text-teal-400 font-mono">
                  {selectedPromocode?.code}
                </code>
                Kullanım Geçmişi
              </DialogTitle>
            </DialogHeader>

            {selectedPromocode && (
              <div className="space-y-4">
                {/* Summary */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-slate-800 rounded-lg p-3 text-center">
                    <p className="text-slate-400 text-sm">Puan</p>
                    <p className="text-xl font-bold text-yellow-400">{selectedPromocode.points}</p>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-3 text-center">
                    <p className="text-slate-400 text-sm">Kullanım</p>
                    <p className="text-xl font-bold text-white">
                      {selectedPromocode.usedCount} / {selectedPromocode.maxUses}
                    </p>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-3 text-center">
                    <p className="text-slate-400 text-sm">Durum</p>
                    <Badge className={selectedPromocode.isActive ? 'bg-green-500' : 'bg-red-500'}>
                      {selectedPromocode.isActive ? 'Aktif' : 'Pasif'}
                    </Badge>
                  </div>
                </div>

                {/* Usage List */}
                <div className="space-y-2">
                  <h4 className="text-white font-medium">Kullanan Kullanıcılar</h4>
                  {!selectedPromocode.usages || selectedPromocode.usages.length === 0 ? (
                    <p className="text-slate-500 text-center py-4">Henüz kimse kullanmadı</p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {selectedPromocode.usages.map((usage) => (
                        <div
                          key={usage.id}
                          className="bg-slate-800 rounded-lg p-3 flex items-center justify-between"
                        >
                          <div>
                            <p className="text-white font-medium">
                              {usage.user?.siteUsername ||
                                usage.user?.telegramUsername ||
                                usage.user?.email ||
                                usage.user?.firstName ||
                                'Bilinmeyen Kullanıcı'}
                            </p>
                            <p className="text-slate-400 text-sm">{formatDate(usage.usedAt)}</p>
                          </div>
                          <div className="flex items-center gap-1 text-yellow-400">
                            <Star className="w-4 h-4 fill-yellow-400" />
                            <span className="font-semibold">+{usage.pointsEarned}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
  )
}

export default function PromocodesPage() {
  return (
    <AdminPermissionGuard permission="canAccessPromocodes">
      <PromocodesContent />
    </AdminPermissionGuard>
  )
}
