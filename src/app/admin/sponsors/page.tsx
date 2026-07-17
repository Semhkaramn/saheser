'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Edit, Trash2, Heart, Crown, Upload, X, Search, Users, Copy, GripVertical, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { formatDateTR, ensureAbsoluteUrl } from '@/lib/utils'
import { SITE_CONFIG } from '@/lib/site-config'

interface Sponsor {
  id: string
  name: string
  description?: string
  logoUrl?: string
  websiteUrl?: string
  category: string
  identifierType: string
  approvalGroupId?: string
  isActive: boolean
  order: number
  clicks: number
}

interface UserSponsorInfo {
  id: string
  identifier: string
  status: string
  createdAt: string
  user: {
    id: string
    telegramId: string
    siteUsername?: string
    telegramUsername?: string
    firstName?: string
    lastName?: string
    trc20WalletAddress?: string
  }
  sponsor: {
    id: string
    name: string
    identifierType: string
    category: string
  }
}

// Bot admin'in gruptaki onay kartından verdiği kararı burada da gösteriyoruz -
// ProfilePayment.tsx'teki kullanıcıya gösterilen aynı durum sözlüğü.
function getSponsorStatusInfo(status?: string): { label: string; className: string } {
  switch (status) {
    case 'approved':
      return { label: 'Onaylı ✅', className: 'bg-emerald-500/15 text-emerald-400' }
    case 'rejected':
      return { label: 'Red ❌', className: 'bg-rose-500/15 text-rose-400' }
    case 'post_deposit':
      return { label: 'Yatırım Sonrası 💰', className: 'bg-amber-500/15 text-amber-400' }
    case 'incorrect':
      return { label: 'Hatalı ⚠️', className: 'bg-rose-500/15 text-rose-400' }
    case 'pending':
    default:
      return { label: 'Bekliyor ⏳', className: 'bg-white/10 admin-text-muted' }
  }
}

interface GroupedUserData {
  userId: string
  telegramId: string
  telegramUsername?: string
  firstName?: string
  lastName?: string
  trc20WalletAddress?: string
  siteUsername?: string
  sponsors: {
    infoId: string
    sponsorId: string
    sponsorName: string
    sponsorCategory: string
    identifierType: string
    status: string
    identifier: string
    createdAt: string
  }[]
}

export default function AdminSponsorsPage() {
  const router = useRouter()
  const [sponsors, setSponsors] = useState<Sponsor[]>([])
  const [userSponsorInfos, setUserSponsorInfos] = useState<UserSponsorInfo[]>([])
  const [allUsers, setAllUsers] = useState<{
    id: string
    telegramId: string
    siteUsername?: string
    telegramUsername?: string
    firstName?: string
    lastName?: string
    trc20WalletAddress?: string
  }[]>([])
  const [loading, setLoading] = useState(true)
  const [userDataLoading, setUserDataLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingSponsor, setEditingSponsor] = useState<Sponsor | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('sponsors')
  // Toplu onay/red için: kaydet'e basana kadar hiçbir şey backend'e gitmez,
  // seçimler burada tutulur (infoId -> yeni status)
  const [pendingChanges, setPendingChanges] = useState<Record<string, string>>({})
  const [savingBulk, setSavingBulk] = useState(false)
  const [draggedSponsorIndex, setDraggedSponsorIndex] = useState<number | null>(null)

  // Search and filter states for sponsors
  const [searchTerm, setSearchTerm] = useState('')

  // Search and filter states for user data
  const [userSearchTerm, setUserSearchTerm] = useState('')
  const [sponsorFilter, setSponsorFilter] = useState<string>('all')
  const [trc20Filter, setTrc20Filter] = useState<'all' | 'with-trc20' | 'without-trc20'>('all')

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    logoUrl: '',
    websiteUrl: '',
    category: 'normal',
    identifierType: 'username',
    approvalGroupId: '',
    order: 0
  })

  const [uploadingImage, setUploadingImage] = useState(false)
  const [imagePublicId, setImagePublicId] = useState<string | null>(null)
  const [botGroups, setBotGroups] = useState<{ groupId: string; title: string | null; chatType?: string }[]>([])
  const [shortLinks, setShortLinks] = useState<{ id: string; slug: string; targetUrl: string; title: string | null }[]>([])
  const [useCustomUrl, setUseCustomUrl] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (!token) {
      router.push('/admin')
      return
    }
    // ✅ OPTIMIZASYON: Tek request yeterli (includeUserData=true hem sponsors hem userSponsorInfos döner)
    loadSponsors()
    // Sponsor formundaki "Website URL" (kısa link seç) ve "Onay Grubu" (bot
    // gruplarından seç) alanları için gerekli listeler
    fetch('/api/admin/groups').then((r) => r.json()).then((d) => setBotGroups((d.groups || []).filter((g: any) => g.isActive))).catch(() => {})
    fetch('/api/admin/short-links').then((r) => r.json()).then((d) => setShortLinks(d.links || [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (activeTab === 'userdata' && allUsers.length === 0) {
      loadUserSponsorData()
    }
  }, [activeTab])

  async function loadSponsors() {
    try {
      const response = await fetch('/api/admin/sponsors', { cache: 'no-store' })
      const data = await response.json()
      setSponsors(data.sponsors || [])
    } catch (error) {
      console.error('Error loading sponsors:', error)
      toast.error('Sponsorlar yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  async function loadUserSponsorData() {
    setUserDataLoading(true)
    try {
      // ✅ OPTIMIZASYON: Tek request hem sponsors hem userSponsorInfos hem de allUsers döner
      // cache: 'no-store' - Kaydet ve Bitir sonrası burası eski (stale) veri
      // dönmesin diye, tarayıcı/ara katman önbelleğini tamamen devre dışı bırakıyoruz.
      const response = await fetch('/api/admin/sponsors?includeUserData=true', { cache: 'no-store' })
      const data = await response.json()
      setSponsors(data.sponsors || [])
      setUserSponsorInfos(data.userSponsorInfos || [])
      setAllUsers(data.allUsers || [])
    } catch (error) {
      console.error('Error loading user sponsor data:', error)
      toast.error('Kullanıcı verileri yüklenemedi')
    } finally {
      setUserDataLoading(false)
      setLoading(false)
    }
  }

  async function saveBulkStatusChanges() {
    const updates = Object.entries(pendingChanges).map(([id, status]) => ({ id, status }))
    if (updates.length === 0) return

    setSavingBulk(true)
    try {
      const res = await fetch('/api/admin/sponsor-info/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || `Sunucu hatası (${res.status})`)
      }
      if (data.failed && data.failed.length > 0) {
        toast.warning(`${data.updated} kayıt güncellendi, ${data.failed.length} kayıt başarısız oldu`)
      } else {
        toast.success(`${data.updated ?? updates.length} kayıt güncellendi, bildirimler gönderildi`)
      }
      // ✅ Önce ekranı ANINDA güncelle (fetch'i beklemeden) - herhangi bir
      // önbellek ihtimaline karşı da kullanıcı değişikliği hemen görsün.
      const updateMap = new Map(updates.map((u) => [u.id, u.status]))
      setUserSponsorInfos((prev) =>
        prev.map((info) => (updateMap.has(info.id) ? { ...info, status: updateMap.get(info.id)! } : info))
      )
      setPendingChanges({})
      // Arka planda gerçek veriyle senkronize et
      await loadUserSponsorData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Toplu kaydetme başarısız oldu')
    } finally {
      setSavingBulk(false)
    }
  }

  // Sürükle-bırak sıralama - sadece tek bir kategori filtrelenmişken anlamlı,
  // çünkü Ana Sponsor / VIP / Normal ana sayfada ayrı gruplarda gösteriliyor
  // ve her biri kendi 0..n aralığında sıralanıyor.
  function handleSponsorDragStart(index: number) {
    setDraggedSponsorIndex(index)
  }

  function handleSponsorDragOver(e: React.DragEvent, index: number, categoryItems: Sponsor[]) {
    e.preventDefault()
    if (draggedSponsorIndex === null || draggedSponsorIndex === index) return

    const reordered = [...categoryItems]
    const draggedItemData = reordered[draggedSponsorIndex]
    reordered.splice(draggedSponsorIndex, 1)
    reordered.splice(index, 0, draggedItemData)

    // Sadece bu kategoriye ait sponsorların sırasını, genel sponsors listesi
    // içinde güncelle - diğer kategoriler yerinde kalır.
    const reorderedIds = reordered.map((s) => s.id)
    setSponsors((prev) => {
      const otherCategory = prev.filter((s) => !reorderedIds.includes(s.id))
      const inNewOrder = reorderedIds.map((id) => prev.find((s) => s.id === id)!).filter(Boolean)
      return [...otherCategory, ...inNewOrder]
    })
    setDraggedSponsorIndex(index)
  }

  async function handleSponsorDragEnd(categoryItems: Sponsor[]) {
    if (draggedSponsorIndex === null) return
    setDraggedSponsorIndex(null)

    try {
      const updates = categoryItems.map((s, index) => ({ id: s.id, order: index }))
      const res = await fetch('/api/admin/sponsors/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sponsors: updates }),
      })
      if (!res.ok) throw new Error()
      toast.success('Sıralama kaydedildi')
    } catch {
      toast.error('Sıralama kaydedilemedi')
      loadSponsors()
    }
  }

  function openDialog(sponsor?: Sponsor) {
    if (sponsor) {
      setEditingSponsor(sponsor)
      setFormData({
        name: sponsor.name,
        description: sponsor.description || '',
        logoUrl: sponsor.logoUrl || '',
        websiteUrl: sponsor.websiteUrl || '',
        category: sponsor.category,
        identifierType: sponsor.identifierType || 'username',
        approvalGroupId: sponsor.approvalGroupId || '',
        order: sponsor.order
      })
    } else {
      setEditingSponsor(null)
      setFormData({
        name: '',
        description: '',
        logoUrl: '',
        websiteUrl: '',
        category: 'normal',
        identifierType: 'username',
        approvalGroupId: '',
        order: sponsors.length
      })
    }
    setDialogOpen(true)
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Dosya boyutu kontrolü (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Dosya boyutu 5MB\'dan küçük olmalıdır')
      return
    }

    setUploadingImage(true)

    try {
      const formDataUpload = new FormData()
      formDataUpload.append('file', file)
      formDataUpload.append('folder', `${SITE_CONFIG.cloudinary.folder}/sponsors`)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formDataUpload
      })

      const data = await response.json()

      if (data.success) {
        setFormData(prev => ({ ...prev, logoUrl: data.url }))
        setImagePublicId(data.publicId)
        toast.success('Logo yüklendi')
      } else {
        toast.error(data.error || 'Logo yüklenemedi')
      }
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('Logo yüklenirken hata oluştu')
    } finally {
      setUploadingImage(false)
    }
  }

  async function handleRemoveImage() {
    if (!imagePublicId) {
      setFormData(prev => ({ ...prev, logoUrl: '' }))
      return
    }

    try {
      await fetch('/api/upload', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicId: imagePublicId })
      })

      setFormData(prev => ({ ...prev, logoUrl: '' }))
      setImagePublicId(null)
      toast.success('Logo silindi')
    } catch (error) {
      console.error('Image remove error:', error)
      toast.error('Logo silinirken hata oluştu')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    try {
      const url = editingSponsor
        ? `/api/admin/sponsors/${editingSponsor.id}`
        : '/api/admin/sponsors'

      const method = editingSponsor ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          logoPublicId: imagePublicId
        })
      })

      const data = await response.json()

      if (data.sponsor) {
        toast.success(editingSponsor ? 'Sponsor güncellendi' : 'Sponsor eklendi')
        setDialogOpen(false)
        setImagePublicId(null)
        loadSponsors()
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
      // Önce sponsoru bul ve logosunun public_id'sini al
      const sponsor = sponsors.find(s => s.id === deleteId)

      const response = await fetch(`/api/admin/sponsors/${deleteId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        // Cloudinary'den logoyu sil (varsa)
        if (sponsor?.logoUrl && sponsor.logoUrl.includes('cloudinary')) {
          try {
            const urlParts = sponsor.logoUrl.split('/')
            const publicIdWithExt = urlParts.slice(-2).join('/')
            const publicId = publicIdWithExt.replace(/\.[^/.]+$/, '')

            await fetch('/api/upload', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ publicId })
            })
          } catch (err) {
            console.error('Cloudinary silme hatası:', err)
          }
        }

        toast.success('Sponsor silindi')
        loadSponsors()
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
      const response = await fetch(`/api/admin/sponsors/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentActive })
      })

      const data = await response.json()

      if (data.sponsor) {
        toast.success('Durum güncellendi')
        loadSponsors()
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
      <div className="flex items-center justify-center min-h-screen admin-layout-bg">
        <div className="admin-spinner"></div>
      </div>
    )
  }

  // Filter sponsors based on search, then split into the three fixed groups -
  // Ana Sponsor / VIP / Normal - each keeps the current `sponsors` state order
  // (which already reflects backend `order`, or a just-dragged local order).
  const searchFilteredSponsors = sponsors.filter(sponsor => {
    const matchesSearch = sponsor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (sponsor.description && sponsor.description.toLowerCase().includes(searchTerm.toLowerCase()))
    return matchesSearch
  })
  const mainSponsorsList = searchFilteredSponsors.filter(s => s.category === 'main')
  const vipSponsorsList = searchFilteredSponsors.filter(s => s.category === 'vip')
  const normalSponsorsList = searchFilteredSponsors.filter(s => s.category !== 'main' && s.category !== 'vip')

  // Group user sponsor info by user - UPDATED to include all users
  const groupedUserData: GroupedUserData[] = []
  const userMap = new Map<string, GroupedUserData>()

  // İlk olarak tüm kullanıcıları ekle
  allUsers.forEach(user => {
    userMap.set(user.id, {
      userId: user.id,
      telegramId: user.telegramId,
      siteUsername: user.siteUsername,
      telegramUsername: user.telegramUsername,
      firstName: user.firstName,
      lastName: user.lastName,
      trc20WalletAddress: user.trc20WalletAddress,
      sponsors: []
    })
  })

  // Sonra sponsor bilgilerini ekle
  userSponsorInfos.forEach(info => {
    const userId = info.user.id

    // Eğer kullanıcı zaten userMap'te yoksa (allUsers'ta olmayanlar için)
    if (!userMap.has(userId)) {
      userMap.set(userId, {
        userId: info.user.id,
        telegramId: info.user.telegramId,
        siteUsername: info.user.siteUsername,
        telegramUsername: info.user.telegramUsername,
        firstName: info.user.firstName,
        lastName: info.user.lastName,
        trc20WalletAddress: info.user.trc20WalletAddress,
        sponsors: []
      })
    }

    const userData = userMap.get(userId)!
    userData.sponsors.push({
      infoId: info.id,
      sponsorId: info.sponsor.id,
      sponsorName: info.sponsor.name,
      sponsorCategory: info.sponsor.category,
      identifierType: info.sponsor.identifierType,
      status: info.status,
      identifier: info.identifier,
      createdAt: info.createdAt
    })
  })

  groupedUserData.push(...userMap.values())

  // Filter grouped user data based on search, sponsor, and TRC20
  const filteredGroupedUserData = groupedUserData.filter(userData => {
    const userName = userData.firstName || userData.telegramUsername || userData.telegramId || ''
    const searchLower = userSearchTerm.toLowerCase()

    const matchesSearch = userName.toLowerCase().includes(searchLower) ||
      (userData.siteUsername && userData.siteUsername.toLowerCase().includes(searchLower)) ||
      (userData.trc20WalletAddress && userData.trc20WalletAddress.toLowerCase().includes(searchLower)) ||
      userData.sponsors.some(s =>
        (s.sponsorName && s.sponsorName.toLowerCase().includes(searchLower)) ||
        (s.identifier && s.identifier.toLowerCase().includes(searchLower))
      )
    const matchesSponsor = sponsorFilter === 'all' || userData.sponsors.some(s => s.sponsorId === sponsorFilter)
    const matchesTrc20 = trc20Filter === 'all' ||
      (trc20Filter === 'with-trc20' && userData.trc20WalletAddress) ||
      (trc20Filter === 'without-trc20' && !userData.trc20WalletAddress)

    return matchesSearch && matchesSponsor && matchesTrc20
  })

  // Bir kategori (Ana Sponsor/VIP/Normal) için sürükle-bırak sıralanabilir
  // tablo - üçü de her zaman görünür ve birbirinden bağımsız sıralanır.
  function renderSponsorGroup(title: string, icon: React.ReactNode, items: Sponsor[]) {
    if (items.length === 0) return null

    return (
      <div key={title} className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          {icon}
          <h3 className="admin-text-primary font-semibold text-sm">{title}</h3>
          <span className="text-xs admin-text-muted">({items.length})</span>
          {items.length > 1 && (
            <span className="text-xs admin-text-muted flex items-center gap-1 ml-auto">
              <GripVertical className="w-3.5 h-3.5" />
              Sürükleyerek sıralayın
            </span>
          )}
        </div>
        <div className="admin-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="admin-table-header">
                <tr>
                  <th className="admin-table-head w-8"></th>
                  <th className="admin-table-head">Logo</th>
                  <th className="admin-table-head">Sponsor</th>
                  <th className="admin-table-head">Bilgi Tipi</th>
                  <th className="admin-table-head">Tıklama</th>
                  <th className="admin-table-head">Durum</th>
                  <th className="admin-table-head text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {items.map((sponsor, index) => (
                  <tr
                    key={sponsor.id}
                    className={`admin-table-row cursor-move ${draggedSponsorIndex === index ? 'opacity-50' : ''}`}
                    draggable
                    onDragStart={() => handleSponsorDragStart(index)}
                    onDragOver={(e) => handleSponsorDragOver(e, index, items)}
                    onDragEnd={() => handleSponsorDragEnd(items)}
                  >
                    <td className="px-2 py-4">
                      <GripVertical className="w-4 h-4 admin-text-muted" />
                    </td>
                    <td className="px-6 py-4">
                      {sponsor.logoUrl && (
                        <img
                          src={sponsor.logoUrl}
                          alt={sponsor.name}
                          className="w-24 h-12 object-contain rounded-lg bg-white/5 p-1"
                        />
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="admin-text-primary font-semibold">{sponsor.name}</span>
                          {sponsor.category === 'vip' && (
                            <Crown className="w-4 h-4 text-yellow-500" />
                          )}
                        </div>
                        {sponsor.description && (
                          <p className="text-sm admin-text-muted mt-1 whitespace-pre-line">{sponsor.description}</p>
                        )}
                        {sponsor.websiteUrl && (
                          <a
                            href={ensureAbsoluteUrl(sponsor.websiteUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 text-sm hover:underline inline-block mt-1"
                          >
                            {sponsor.websiteUrl}
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="admin-text-primary text-sm">
                        {sponsor.identifierType === 'username' ? 'Kullanıcı Adı' :
                         sponsor.identifierType === 'id' ? 'ID' : 'Email'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-green-400 text-sm font-medium">{sponsor.clicks}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`admin-badge ${
                        sponsor.isActive
                          ? 'admin-badge-success'
                          : 'admin-badge-secondary'
                      }`}>
                        {sponsor.isActive ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          onClick={() => toggleActive(sponsor.id, sponsor.isActive)}
                          className={`${sponsor.isActive ? 'admin-btn-secondary' : 'admin-btn-success'}`}
                        >
                          {sponsor.isActive ? 'Devre Dışı' : 'Aktif Et'}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => openDialog(sponsor)}
                          className="admin-btn-primary"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleDelete(sponsor.id)}
                          className="admin-btn-danger"
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
        </div>
      </div>
    )
  }

  return (
    <div className="admin-page-container">
      <div className="admin-page-inner space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="admin-page-title flex items-center gap-2">
              <Heart className="w-8 h-8" />
              Sponsor Yönetimi
            </h1>
            <p className="admin-page-subtitle">Sponsorları yönetin</p>
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="admin-tabs-list">
            <TabsTrigger value="sponsors" className="admin-tabs-trigger">
              <Heart className="w-4 h-4 mr-2" />
              Sponsorlar
            </TabsTrigger>
            <TabsTrigger value="userdata" className="admin-tabs-trigger">
              <Users className="w-4 h-4 mr-2" />
              Kullanıcı Verileri
            </TabsTrigger>
          </TabsList>

          {/* Sponsors Tab */}
          <TabsContent value="sponsors" className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 admin-text-muted" />
                <Input
                  type="text"
                  placeholder="Sponsor ara (isim, açıklama)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="admin-input pl-10"
                />
              </div>
              <Button
                onClick={() => openDialog()}
                className="admin-btn-primary"
              >
                <Plus className="w-4 h-4 mr-2" />
                Yeni Sponsor Ekle
              </Button>
            </div>

            {sponsors.length === 0 ? (
              <div className="admin-card p-12 text-center">
                <Heart className="w-16 h-16 admin-text-muted mx-auto mb-4" />
                <p className="admin-text-primary font-medium">Henüz sponsor eklenmemiş</p>
              </div>
            ) : (
              <div className="space-y-8">
                {renderSponsorGroup('Ana Sponsor', <Sparkles className="w-4 h-4 text-rose-400" />, mainSponsorsList)}
                {renderSponsorGroup('VIP Sponsorlar', <Crown className="w-4 h-4 text-yellow-500" />, vipSponsorsList)}
                {renderSponsorGroup('Normal Sponsorlar', <Heart className="w-4 h-4 text-blue-400" />, normalSponsorsList)}
              </div>
            )}
          </TabsContent>

          {/* User Data Tab */}
          <TabsContent value="userdata" className="space-y-6">
            {/* Search and Filter for User Data */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 admin-text-muted" />
                <Input
                  type="text"
                  placeholder="Kullanıcı veya sponsor bilgisi ara..."
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  className="admin-input pl-10"
                />
              </div>
              <Select value={sponsorFilter} onValueChange={setSponsorFilter}>
                <SelectTrigger className="admin-input w-full md:w-[250px]">
                  <SelectValue placeholder="Sponsor Filtrele" />
                </SelectTrigger>
                <SelectContent className="admin-dialog">
                  <SelectItem value="all">Tüm Sponsorlar</SelectItem>
                  {sponsors.map((sponsor) => (
                    <SelectItem key={sponsor.id} value={sponsor.id}>
                      {sponsor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={trc20Filter} onValueChange={(value) => setTrc20Filter(value as 'all' | 'with-trc20' | 'without-trc20')}>
                <SelectTrigger className="admin-input w-full md:w-[200px]">
                  <SelectValue placeholder="TRC20 Filtrele" />
                </SelectTrigger>
                <SelectContent className="admin-dialog">
                  <SelectItem value="all">Tümü</SelectItem>
                  <SelectItem value="with-trc20">TRC20 Olan</SelectItem>
                  <SelectItem value="without-trc20">TRC20 Olmayan</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Toplu kaydet çubuğu - durum değişiklikleri kaydet'e basana kadar bekler */}
            {Object.keys(pendingChanges).length > 0 && (
              <div
                className="flex items-center justify-between gap-3 p-3 rounded-lg"
                style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)' }}
              >
                <span className="text-sm admin-text-primary font-medium">
                  {Object.keys(pendingChanges).length} kayıtta bekleyen değişiklik var
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setPendingChanges({})}
                    disabled={savingBulk}
                  >
                    Vazgeç
                  </Button>
                  <Button
                    size="sm"
                    onClick={saveBulkStatusChanges}
                    disabled={savingBulk}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {savingBulk ? 'Kaydediliyor...' : 'Kaydet ve Bildir'}
                  </Button>
                </div>
              </div>
            )}

            {/* User Data Table - New Format */}
            {userDataLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="admin-spinner"></div>
              </div>
            ) : filteredGroupedUserData.length === 0 ? (
              <div className="admin-card p-16 text-center">
                <Users className="w-20 h-20 admin-text-muted mx-auto mb-4" />
                <p className="admin-text-primary text-lg font-medium">
                  {userSponsorInfos.length === 0 ? 'Henüz kullanıcı verisi yok' : 'Arama kriterlerine uygun veri bulunamadı'}
                </p>
              </div>
            ) : (
              <div className="admin-card w-full">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse" style={{ minWidth: '100%' }}>
                    <thead>
                      <tr className="admin-table-header border-b-2 border-white/10">
                        <th className="admin-table-head whitespace-nowrap" style={{ width: '180px' }}>
                          <div className="flex items-center gap-2">
                            <span>Site Username</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                const usernames = filteredGroupedUserData
                                  .map(u => u.siteUsername || u.firstName || u.telegramUsername || 'Kullanıcı')
                                  .join('\n')
                                navigator.clipboard.writeText(usernames)
                                toast.success('Tüm kullanıcı adları kopyalandı!')
                              }}
                              className="h-6 w-6 p-0 hover:bg-white/10"
                              title="Tümünü kopyala"
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                        </th>
                        <th className="admin-table-head whitespace-nowrap" style={{ width: '300px' }}>
                          <div className="flex items-center gap-2">
                            <span>TRC20</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                const wallets = filteredGroupedUserData
                                  .filter(u => u.trc20WalletAddress)
                                  .map(u => u.trc20WalletAddress)
                                  .join('\n')
                                navigator.clipboard.writeText(wallets)
                                toast.success('Tüm TRC20 adresleri kopyalandı!')
                              }}
                              className="h-6 w-6 p-0 hover:bg-white/10"
                              title="Tümünü kopyala"
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                        </th>
                        {sponsors.map((sponsor) => (
                          <th key={sponsor.id} className="admin-table-head text-center whitespace-nowrap" style={{ minWidth: '200px' }}>
                            <div className="flex items-center justify-center gap-2">
                              {sponsor.category === 'vip' && (
                                <Crown className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                              )}
                              <span>{sponsor.name}</span>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  const sponsorData = filteredGroupedUserData
                                    .map(userData => {
                                      const sponsorInfo = userData.sponsors.find(s => s.sponsorId === sponsor.id)
                                      return sponsorInfo?.identifier || ''
                                    })
                                    .filter(id => id !== '')
                                    .join('\n')
                                  navigator.clipboard.writeText(sponsorData)
                                  toast.success(`${sponsor.name} verileri kopyalandı!`)
                                }}
                                className="h-6 w-6 p-0 hover:bg-white/10 flex-shrink-0"
                                title="Bu sponsor bilgilerini kopyala"
                              >
                                <Copy className="w-3 h-3" />
                              </Button>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredGroupedUserData.map((userData) => {
                        // Her sponsor için kullanıcının identifier + onay durumu bilgisini sakla
                        const userSponsorMap = new Map(
                          userData.sponsors.map(s => [s.sponsorId, { infoId: s.infoId, identifier: s.identifier, status: s.status }])
                        )

                        return (
                          <tr
                            key={userData.userId}
                            className="border-b border-white/5 hover:bg-white/5 transition-colors"
                          >
                            {/* Site Username */}
                            <td className="admin-table-cell admin-text-primary font-semibold whitespace-nowrap">
                              {userData.siteUsername || userData.firstName || userData.telegramUsername || 'Kullanıcı'}
                            </td>

                            {/* TRC20 */}
                            <td className="admin-table-cell whitespace-nowrap">
                              {userData.trc20WalletAddress ? (
                                <span className="text-sm font-mono admin-text-primary">
                                  {userData.trc20WalletAddress}
                                </span>
                              ) : (
                                <span className="text-sm admin-text-muted italic">TRC20 yok</span>
                              )}
                            </td>

                            {/* Her sponsor için bir hücre */}
                            {sponsors.map((sponsor) => {
                              const sponsorData = userSponsorMap.get(sponsor.id)
                              const stagedStatus = sponsorData ? pendingChanges[sponsorData.infoId] : undefined
                              const effectiveStatus = stagedStatus ?? sponsorData?.status
                              const statusInfo = getSponsorStatusInfo(effectiveStatus)
                              return (
                                <td key={sponsor.id} className="admin-table-cell text-center whitespace-nowrap">
                                  {sponsorData?.identifier ? (
                                    <div className="flex flex-col items-center gap-1">
                                      <span className="admin-text-primary font-medium text-sm">
                                        {sponsorData.identifier}
                                      </span>
                                      <Select
                                        value={effectiveStatus ?? 'pending'}
                                        onValueChange={(value) => {
                                          setPendingChanges((prev) => {
                                            // Orijinal durumla aynıysa bekleyen listeden çıkar
                                            if (value === sponsorData.status) {
                                              const { [sponsorData.infoId]: _removed, ...rest } = prev
                                              return rest
                                            }
                                            return { ...prev, [sponsorData.infoId]: value }
                                          })
                                        }}
                                      >
                                        <SelectTrigger
                                          className={`h-6 text-[10px] font-semibold px-1.5 py-0 rounded-full border-0 w-auto min-w-0 gap-1 ${statusInfo.className} ${stagedStatus ? 'ring-1 ring-emerald-400' : ''}`}
                                        >
                                          <SelectValue placeholder={statusInfo.label} />
                                        </SelectTrigger>
                                        <SelectContent className="admin-dialog">
                                          <SelectItem value="pending">Bekliyor ⏳</SelectItem>
                                          <SelectItem value="approved">Onaylı ✅</SelectItem>
                                          <SelectItem value="rejected">Red ❌</SelectItem>
                                          <SelectItem value="post_deposit">Yatırım Sonrası 💰</SelectItem>
                                          <SelectItem value="incorrect">Hatalı ⚠️</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  ) : (
                                    <span className="text-sm admin-text-muted">-</span>
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="admin-dialog max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="admin-text-primary">
              {editingSponsor ? 'Sponsoru Düzenle' : 'Yeni Sponsor Ekle'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name" className="admin-text-primary">Sponsor Adı</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="admin-input mt-1"
                placeholder="Sponsor adı"
                required
              />
            </div>

            <div>
              <Label htmlFor="description" className="admin-text-primary">Açıklama</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="admin-input mt-1"
                placeholder="Sponsor açıklaması"
                rows={3}
              />
            </div>

            <div>
              <Label className="admin-text-primary">Sponsor Logosu</Label>
              <div className="mt-2 space-y-2">
                {formData.logoUrl ? (
                  <div className="relative">
                    <img
                      src={formData.logoUrl}
                      alt="Logo"
                      className="w-full h-48 object-contain rounded-lg border border-white/10 bg-white/5 p-4"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={handleRemoveImage}
                      className="absolute top-2 right-2 admin-btn-danger"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-white/20 rounded-lg p-6 text-center">
                    <Upload className="w-8 h-8 mx-auto mb-2 admin-text-muted" />
                    <Input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/gif,image/svg+xml,image/webp,video/webm"
                      onChange={handleImageUpload}
                      disabled={uploadingImage}
                      className="admin-input"
                    />
                    <p className="text-xs admin-text-muted mt-2">
                      {uploadingImage ? 'Yükleniyor...' : 'PNG, JPG, GIF, SVG, WebP, WebM (Max 5MB)'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="websiteUrl" className="admin-text-primary">Website URL</Label>
                <button
                  type="button"
                  onClick={() => setUseCustomUrl((v) => !v)}
                  className="text-xs underline admin-text-muted hover:admin-text-primary"
                >
                  {useCustomUrl ? 'Kısa linklerden seç' : 'Elle adres yaz'}
                </button>
              </div>
              {useCustomUrl || shortLinks.length === 0 ? (
                <Input
                  id="websiteUrl"
                  value={formData.websiteUrl}
                  onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                  className="admin-input mt-1"
                  placeholder="https://..."
                />
              ) : (
                <select
                  value={formData.websiteUrl}
                  onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                  className="admin-input mt-1 w-full rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">— Kısa link seç —</option>
                  {shortLinks.map((l) => (
                    <option key={l.id} value={l.targetUrl}>
                      /{l.slug} {l.title ? `— ${l.title}` : ''} ({l.targetUrl})
                    </option>
                  ))}
                </select>
              )}
              <p className="text-xs admin-text-muted mt-1">
                Kısa linkler listesi boşsa ya da aradığın orada yoksa "Elle adres yaz"a geç.
                Yeni kısa link eklemek için <a href="/admin/short-links" className="underline">Kısa Linkler</a> sayfasına bakabilirsin.
              </p>
            </div>

            <div>
              <Label htmlFor="category" className="admin-text-primary">Kategori</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger className="admin-input mt-1">
                  <SelectValue placeholder="Kategori seçin" />
                </SelectTrigger>
                <SelectContent className="admin-dialog">
                  <SelectItem value="main">MAIN (Ana Sponsor)</SelectItem>
                  <SelectItem value="vip">VIP</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="identifierType" className="admin-text-primary">Kullanıcıdan İstenecek Bilgi</Label>
              <Select
                value={formData.identifierType}
                onValueChange={(value) => setFormData({ ...formData, identifierType: value })}
              >
                <SelectTrigger className="admin-input mt-1">
                  <SelectValue placeholder="Bilgi tipi seçin" />
                </SelectTrigger>
                <SelectContent className="admin-dialog">
                  <SelectItem value="username">Kullanıcı Adı</SelectItem>
                  <SelectItem value="id">ID</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs admin-text-muted mt-1">
                Kullanıcılar bu sponsora ait ürünleri alırken hangi bilgiyi girecekler
              </p>
            </div>

            <div>
              <Label htmlFor="approvalGroupId" className="admin-text-primary">Telegram Onay Grubu (opsiyonel)</Label>
              <select
                id="approvalGroupId"
                value={formData.approvalGroupId}
                onChange={(e) => setFormData({ ...formData, approvalGroupId: e.target.value })}
                className="admin-input mt-1 w-full rounded-lg px-3 py-2 text-sm"
              >
                <option value="">— Bota bağlı grup/kanal seç —</option>
                {formData.approvalGroupId && !botGroups.some((g) => g.groupId === formData.approvalGroupId) && (
                  <option value={formData.approvalGroupId}>⚠️ {formData.approvalGroupId} (listede bulunamadı, mevcut değer)</option>
                )}
                {botGroups.map((g) => (
                  <option key={g.groupId} value={g.groupId}>
                    {g.chatType === 'channel' ? '📢' : '👥'} {g.title || g.groupId}
                  </option>
                ))}
              </select>
              <p className="text-xs admin-text-muted mt-1">
                Kullanıcı bu sponsor için bilgi girdiğinde veya bu sponsora bağlı bir ürün satın aldığında,
                onay kartı bota admin olarak eklendiğin bu Telegram grubuna gönderilir. Boş bırakırsan bot
                üzerinden otomatik onay gönderilmez. Listede aradığın grup yoksa botu o gruba/kanala admin
                olarak ekleyip birinin mesaj/gönderi atmasını bekle — <a href="/admin/groups" className="underline">Bot Yönetimi</a> sayfasında da görebilirsin.
              </p>
            </div>

            <div>
              <Label htmlFor="order" className="admin-text-primary">Sıralama</Label>
              <Input
                id="order"
                type="number"
                value={formData.order}
                onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) })}
                className="admin-input mt-1"
                min="0"
                required
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                onClick={() => setDialogOpen(false)}
                className="flex-1 admin-btn-secondary"
              >
                İptal
              </Button>
              <Button
                type="submit"
                className="flex-1 admin-btn-primary"
              >
                {editingSponsor ? 'Güncelle' : 'Ekle'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Sponsor Silme"
        description={`Bu sponsoru silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`}
        onConfirm={confirmDelete}
      />
    </div>
  )
}

// Sponsor Card Component
function SponsorCard({
  sponsor,
  onEdit,
  onDelete,
  onToggleActive
}: {
  sponsor: Sponsor
  onEdit: () => void
  onDelete: () => void
  onToggleActive: () => void
}) {
  return (
    <Card className="admin-card p-4">
      <div className="flex gap-4">
        {sponsor.logoUrl && (
          <img
            src={sponsor.logoUrl}
            alt={sponsor.name}
            className="w-32 h-16 object-contain rounded-lg bg-white/5 p-2"
          />
        )}
        <div className="flex-1">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold admin-text-primary">{sponsor.name}</h3>
                {sponsor.category === 'main' && (
                  <Crown className="w-4 h-4 text-red-400" />
                )}
                {sponsor.category === 'vip' && (
                  <Crown className="w-4 h-4 text-yellow-400" />
                )}
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  sponsor.isActive
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-gray-500/20 text-gray-400'
                }`}>
                  {sponsor.isActive ? 'Aktif' : 'Pasif'}
                </span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  sponsor.category === 'main'
                    ? 'bg-red-500/20 text-red-400'
                    : sponsor.category === 'vip'
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : 'bg-blue-500/20 text-blue-400'
                }`}>
                  {sponsor.category === 'main' ? 'MAIN' : sponsor.category === 'vip' ? 'VIP' : 'Normal'}
                </span>
              </div>
              <p className="text-gray-400 text-sm mt-1 whitespace-pre-line">{sponsor.description}</p>
              {sponsor.websiteUrl && (
                <a
                  href={ensureAbsoluteUrl(sponsor.websiteUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 text-sm hover:underline block mt-1"
                >
                  {sponsor.websiteUrl}
                </a>
              )}
              <div className="flex gap-3 mt-2">
                <span className="text-green-400 text-sm">{sponsor.clicks} tıklama</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              variant="outline"
              onClick={onToggleActive}
              className="admin-btn-outline"
            >
              {sponsor.isActive ? 'Devre Dışı' : 'Aktif Et'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onEdit}
              className="admin-btn-outline"
            >
              <Edit className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onDelete}
              className="admin-btn-danger"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}
