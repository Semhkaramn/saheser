'use client'

import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Trash2, Edit2, Plus, Gift, Sparkles, ImagePlus, Loader2, X, GripVertical, FolderPlus, Tag } from 'lucide-react'

interface PromotionGroup {
  id: string
  name: string
  _count?: { promotions: number }
}

interface PromotionItem {
  id: string
  type: string
  name: string
  sponsorId: string | null
  sponsor: { id: string; name: string; logoUrl: string | null } | null
  photoUrl: string | null
  photoPublicId: string | null
  description: string | null
  isActive: boolean
  order: number
  groups: { id: string; name: string }[]
}

interface SponsorOption {
  id: string
  name: string
  logoUrl: string | null
}

const EMPTY_FORM = {
  name: '', sponsorId: '', photoUrl: '', photoPublicId: '',
  description: '', order: 0, groupIds: [] as string[],
}

// Yeniden kullanılabilir dosya yükleme kutusu - logo ve fotoğraf için aynı
// bileşen, sadece klasör/boyut/etiket farklı.
function ImageUploadBox({
  label, value, onUploaded, onRemove, folder, heightClass = 'h-32',
}: {
  label: string
  value: string
  onUploaded: (url: string, publicId: string) => void
  onRemove: () => void
  folder: string
  heightClass?: string
}) {
  const [uploading, setUploading] = useState(false)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Dosya boyutu en fazla 5MB olabilir')
      return
    }
    setUploading(true)
    try {
      const uploadFormData = new FormData()
      uploadFormData.append('file', file)
      uploadFormData.append('folder', folder)
      const res = await fetch('/api/upload', { method: 'POST', body: uploadFormData })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Yükleme başarısız')
      }
      const data = await res.json()
      onUploaded(data.url, data.publicId)
      toast.success('Görsel yüklendi')
    } catch (error: any) {
      toast.error(error.message || 'Yükleme başarısız')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <p className="text-xs admin-text-muted mb-1.5">{label}</p>
      {value ? (
        <div className="relative max-w-[180px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt={label} className={`w-full ${heightClass} object-contain rounded-xl bg-slate-800/50`} />
          <button
            type="button"
            onClick={onRemove}
            className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <label className={`flex flex-col items-center justify-center w-full max-w-[180px] ${heightClass} rounded-xl cursor-pointer border-2 border-dashed border-slate-700 bg-slate-800/30 hover:opacity-80 transition-all px-2`}>
          {uploading ? (
            <Loader2 className="w-5 h-5 mb-1 animate-spin text-slate-400" />
          ) : (
            <ImagePlus className="w-5 h-5 mb-1 text-slate-500" />
          )}
          <p className="text-[10px] font-medium text-center leading-tight text-slate-400">{uploading ? 'Yükleniyor...' : 'Görsel yükle'}</p>
          <input type="file" className="hidden" accept="image/*" onChange={handleUpload} disabled={uploading} />
        </label>
      )}
    </div>
  )
}

export default function AdminPromotionsPage() {
  const [activeType, setActiveType] = useState<'trial_bonus' | 'promotion'>('trial_bonus')
  const [items, setItems] = useState<PromotionItem[]>([])
  const [sponsors, setSponsors] = useState<SponsorOption[]>([])
  const [groups, setGroups] = useState<PromotionGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [showForm, setShowForm] = useState(false)
  const [draggedItem, setDraggedItem] = useState<number | null>(null)
  const [activeGroupFilter, setActiveGroupFilter] = useState<string | null>(null)
  const [showGroupManager, setShowGroupManager] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [savingGroup, setSavingGroup] = useState(false)

  useEffect(() => {
    setActiveGroupFilter(null)
    loadItems(activeType)
    loadGroups(activeType)
  }, [activeType])

  useEffect(() => {
    fetch('/api/admin/sponsors').then((r) => r.json()).then((data) => {
      setSponsors((data.sponsors || []).map((s: any) => ({ id: s.id, name: s.name, logoUrl: s.logoUrl })))
    }).catch(() => {})
  }, [])

  async function loadItems(type: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/promotions?type=${type}`)
      const data = await res.json()
      setItems(data.items || [])
    } catch {
      toast.error('Yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  async function loadGroups(type: string) {
    try {
      const res = await fetch(`/api/admin/promotion-groups?type=${type}`)
      const data = await res.json()
      setGroups(data.groups || [])
    } catch {
      toast.error('Gruplar yüklenemedi')
    }
  }

  async function createGroup() {
    if (!newGroupName.trim()) return
    setSavingGroup(true)
    try {
      const res = await fetch('/api/admin/promotion-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: activeType, name: newGroupName.trim() }),
      })
      if (!res.ok) throw new Error()
      toast.success('Grup oluşturuldu')
      setNewGroupName('')
      loadGroups(activeType)
    } catch {
      toast.error('Grup oluşturulamadı')
    } finally {
      setSavingGroup(false)
    }
  }

  async function deleteGroup(id: string) {
    if (!confirm('Bu grubu silmek istediğine emin misin? (Promosyonlar silinmez, sadece bu gruptan çıkar)')) return
    try {
      const res = await fetch(`/api/admin/promotion-groups/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Grup silindi')
      if (activeGroupFilter === id) setActiveGroupFilter(null)
      loadGroups(activeType)
      loadItems(activeType)
    } catch {
      toast.error('Grup silinemedi')
    }
  }

  function toggleFormGroup(groupId: string) {
    setForm((prev) => ({
      ...prev,
      groupIds: prev.groupIds.includes(groupId)
        ? prev.groupIds.filter((id) => id !== groupId)
        : [...prev.groupIds, groupId],
    }))
  }

  function startEdit(item: PromotionItem) {
    setEditingId(item.id)
    setForm({
      name: item.name,
      sponsorId: item.sponsorId || '',
      photoUrl: item.photoUrl || '',
      photoPublicId: item.photoPublicId || '',
      description: item.description || '',
      order: item.order,
      groupIds: (item.groups || []).map((g) => g.id),
    })
    setShowForm(true)
  }

  function startNew() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  async function save() {
    if (!form.name) {
      toast.error('İsim gerekli')
      return
    }
    if (!form.sponsorId) {
      toast.error('Sponsor seçilmeli (giriş linki oradan gelir)')
      return
    }
    try {
      const url = editingId ? `/api/admin/promotions/${editingId}` : '/api/admin/promotions'
      const method = editingId ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, type: activeType }),
      })
      if (!res.ok) throw new Error()
      toast.success(editingId ? 'Güncellendi' : 'Eklendi')
      setShowForm(false)
      loadItems(activeType)
      loadGroups(activeType)
    } catch {
      toast.error('Kaydedilemedi')
    }
  }

  async function remove(id: string) {
    if (!confirm('Silmek istediğine emin misin?')) return
    try {
      const res = await fetch(`/api/admin/promotions/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Silindi')
      loadItems(activeType)
    } catch {
      toast.error('Silinemedi')
    }
  }

  async function toggleActive(item: PromotionItem) {
    try {
      const res = await fetch(`/api/admin/promotions/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !item.isActive }),
      })
      if (!res.ok) throw new Error()
      loadItems(activeType)
    } catch {
      toast.error('Güncellenemedi')
    }
  }

  // Grup filtresi seçiliyse sadece o gruba ait olanları göster (bir promosyon
  // birden fazla grupta olabileceği için birden fazla filtrede çıkabilir)
  const visibleItems = activeGroupFilter
    ? items.filter((item) => item.groups?.some((g) => g.id === activeGroupFilter))
    : items

  // Sürükle-bırak sıralama - deneme bonusu ve promosyon listeleri, aktif
  // sekmeye göre zaten ayrı yüklendiği için birbirinden bağımsız sıralanır.
  // Not: bir grup filtrelenmişken sıralama tüm listeyi (visibleItems'ı) değil
  // filtrelenmiş alt kümeyi baz alır, bu yüzden filtre varken sıralama kapalı.
  function handleDragStart(index: number) {
    setDraggedItem(index)
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    if (draggedItem === null || draggedItem === index) return

    const newItems = [...items]
    const draggedItemData = newItems[draggedItem]
    newItems.splice(draggedItem, 1)
    newItems.splice(index, 0, draggedItemData)

    setItems(newItems)
    setDraggedItem(index)
  }

  async function handleDragEnd() {
    if (draggedItem === null) return
    setDraggedItem(null)

    try {
      const updates = items.map((item, index) => ({ id: item.id, order: index }))
      const res = await fetch('/api/admin/promotions/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: updates }),
      })
      if (!res.ok) throw new Error()
      toast.success('Sıralama kaydedildi')
    } catch {
      toast.error('Sıralama kaydedilemedi')
      loadItems(activeType)
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold mb-1 text-white">Deneme Bonusları & Promosyonlar</h1>
        <p className="text-sm admin-text-muted">
          Üye sayfasındaki listeler — logo, isim, detay sayfasında fotoğraf + açıklama + giriş linki.
        </p>
      </div>

      <Tabs value={activeType} onValueChange={(v) => { setActiveType(v as 'trial_bonus' | 'promotion'); setShowForm(false) }}>
        <TabsList className="grid grid-cols-2 w-full sm:w-auto">
          <TabsTrigger value="trial_bonus">
            <Gift className="w-4 h-4 mr-2 flex-shrink-0" />
            Deneme Bonusları
          </TabsTrigger>
          <TabsTrigger value="promotion">
            <Sparkles className="w-4 h-4 mr-2 flex-shrink-0" />
            Promosyonlar
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeType} className="space-y-4 mt-4">
          <div className="flex flex-wrap gap-2">
            <Button onClick={startNew}>
              <Plus className="w-4 h-4 mr-1.5" />
              Yeni Ekle
            </Button>
            <Button variant="outline" onClick={() => setShowGroupManager((v) => !v)}>
              <FolderPlus className="w-4 h-4 mr-1.5" />
              Grupları Yönet
            </Button>
          </div>

          {showGroupManager && (
            <div className="admin-card p-4 space-y-3">
              <p className="text-xs admin-text-muted">
                Örn. "Kayıp Bonusu" gibi bir grup oluştur, sonra istediğin promosyonları o gruba (birden fazlasına da) ekleyebilirsin. Üye sayfasında filtre olarak görünür.
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="Yeni grup adı (örn. Kayıp Bonusu)"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') createGroup() }}
                />
                <Button onClick={createGroup} disabled={savingGroup || !newGroupName.trim()}>
                  {savingGroup ? 'Ekleniyor...' : 'Ekle'}
                </Button>
              </div>
              {groups.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {groups.map((g) => (
                    <span
                      key={g.id}
                      className="inline-flex items-center gap-1.5 text-xs font-medium pl-2.5 pr-1.5 py-1 rounded-full bg-white/10 text-slate-300"
                    >
                      <Tag className="w-3 h-3" />
                      {g.name}
                      {typeof g._count?.promotions === 'number' && (
                        <span className="text-slate-500">({g._count.promotions})</span>
                      )}
                      <button onClick={() => deleteGroup(g.id)} className="p-0.5 hover:bg-rose-500/20 rounded-full">
                        <X className="w-3 h-3 text-rose-400" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {groups.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActiveGroupFilter(null)}
                className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                  activeGroupFilter === null ? 'bg-blue-600 text-white' : 'bg-white/10 text-slate-300 hover:bg-white/20'
                }`}
              >
                Tümü
              </button>
              {groups.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setActiveGroupFilter(g.id)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                    activeGroupFilter === g.id ? 'bg-blue-600 text-white' : 'bg-white/10 text-slate-300 hover:bg-white/20'
                  }`}
                >
                  {g.name}
                </button>
              ))}
            </div>
          )}

          {showForm && (
            <div className="admin-card p-5 space-y-2.5">
              <Input placeholder="İsim" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />

              <div>
                <p className="text-xs admin-text-muted mb-1.5">Sponsor (logo otomatik oradan gelir)</p>
                <select
                  value={form.sponsorId}
                  onChange={(e) => setForm({ ...form, sponsorId: e.target.value })}
                  className="admin-input rounded-lg px-3 py-2 text-sm w-full"
                >
                  <option value="">— Sponsor seçilmedi —</option>
                  {sponsors.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {groups.length > 0 && (
                <div>
                  <p className="text-xs admin-text-muted mb-1.5">Gruplar (isteğe bağlı, birden fazla seçebilirsin)</p>
                  <div className="flex flex-wrap gap-2">
                    {groups.map((g) => {
                      const selected = form.groupIds.includes(g.id)
                      return (
                        <button
                          type="button"
                          key={g.id}
                          onClick={() => toggleFormGroup(g.id)}
                          className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                            selected
                              ? 'bg-blue-600 border-blue-600 text-white'
                              : 'bg-transparent border-slate-700 text-slate-400 hover:border-slate-500'
                          }`}
                        >
                          {g.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <ImageUploadBox
                label="Fotoğraf (detay sayfasında büyük görünür)"
                value={form.photoUrl}
                folder="promotions"
                heightClass="aspect-[2/1]"
                onUploaded={(url, publicId) => setForm({ ...form, photoUrl: url, photoPublicId: publicId })}
                onRemove={() => setForm({ ...form, photoUrl: '', photoPublicId: '' })}
              />
              <Textarea placeholder="Açıklama" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
              <Input type="number" placeholder="Sıra (küçük sayı önce gösterilir)" value={form.order} onChange={(e) => setForm({ ...form, order: Number(e.target.value) })} className="w-40" />
              <div className="flex gap-2">
                <Button onClick={save}>{editingId ? 'Güncelle' : 'Ekle'}</Button>
                <Button variant="outline" onClick={() => setShowForm(false)}>İptal</Button>
              </div>
            </div>
          )}

          {loading ? (
            <p className="admin-text-muted text-sm">Yükleniyor...</p>
          ) : visibleItems.length === 0 ? (
            <p className="admin-text-muted text-sm">
              {activeGroupFilter ? 'Bu grupta henüz promosyon yok.' : 'Henüz eklenmedi.'}
            </p>
          ) : (
            <div className="space-y-2">
              {!activeGroupFilter && items.length > 1 && (
                <p className="text-xs admin-text-muted flex items-center gap-1.5">
                  <GripVertical className="w-3.5 h-3.5" />
                  Sürükleyerek sıralayın
                </p>
              )}
              {activeGroupFilter && (
                <p className="text-xs admin-text-muted">
                  Bir grup filtrelenmişken sıralama kapalı — sıralamak için "Tümü"ne dön.
                </p>
              )}
              {visibleItems.map((item, index) => (
                <div
                  key={item.id}
                  draggable={!activeGroupFilter}
                  onDragStart={() => !activeGroupFilter && handleDragStart(index)}
                  onDragOver={(e) => !activeGroupFilter && handleDragOver(e, index)}
                  onDragEnd={() => !activeGroupFilter && handleDragEnd()}
                  className={`admin-card p-3 flex items-center gap-3 transition-opacity ${!activeGroupFilter ? 'cursor-move' : ''} ${draggedItem === index ? 'opacity-50' : ''}`}
                >
                  {!activeGroupFilter && <GripVertical className="w-4 h-4 admin-text-muted flex-shrink-0" />}
                  {item.sponsor?.logoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.sponsor.logoUrl} alt={item.name} className="w-14 h-9 object-contain flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{item.name}</p>
                    <p className="text-xs admin-text-muted truncate">{item.sponsor?.name || 'Sponsor seçilmedi'}</p>
                    {item.groups && item.groups.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {item.groups.map((g) => (
                          <span key={g.id} className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400">
                            {g.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => toggleActive(item)}
                    className={`text-xs px-2.5 py-1 rounded-lg font-medium flex-shrink-0 ${item.isActive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/10 text-slate-400'}`}
                  >
                    {item.isActive ? 'Açık' : 'Kapalı'}
                  </button>
                  <button onClick={() => startEdit(item)} className="p-1.5 hover:bg-slate-700 rounded flex-shrink-0">
                    <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                  <button onClick={() => remove(item.id)} className="p-1.5 hover:bg-rose-500/20 rounded flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
