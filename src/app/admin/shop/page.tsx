'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Plus, Edit, Trash2, ShoppingCart, Package, Clock, CheckCircle, XCircle, AlertCircle, Upload, X, History, GripVertical } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { SITE_CONFIG } from '@/lib/site-config'

interface ShopItem {
  id: string
  name: string
  description?: string
  price: number
  imageUrl?: string
  category: string
  stock?: number
  purchaseLimit?: number
  isActive: boolean
  order: number
  sponsorId?: string
  sponsor?: {
    id: string
    name: string
    identifierType: string
  }
  _count?: {
    purchases: number
  }
}

interface Order {
  id: string
  userId: string
  itemId: string
  pointsSpent: number
  status: string
  deliveryInfo?: string
  processedBy?: string
  processedAt?: string
  purchasedAt: string
  walletAddress?: string
  sponsorInfo?: string
  user: {
    id: string
    telegramId: string
    username?: string
    firstName?: string
    lastName?: string
  }
  item: {
    id: string
    name: string
    description?: string
    price: number
    imageUrl?: string
    category: string
  }
}

export default function AdminShopPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [items, setItems] = useState<ShopItem[]>([])
  const [draggedItem, setDraggedItem] = useState<number | null>(null)
  const [pendingOrders, setPendingOrders] = useState<Order[]>([])
  const [historyOrders, setHistoryOrders] = useState<Order[]>([])
  const [sponsors, setSponsors] = useState<{ id: string; name: string; identifierType: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [orderDialogOpen, setOrderDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ShopItem | null>(null)
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)
  const [activeTab, setActiveTab] = useState('products')
  const [orderSubTab, setOrderSubTab] = useState('pending')

  // URL parametresinden tab değerini oku
  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam === 'orders') {
      setActiveTab('orders')
    }
  }, [searchParams])
  const [confirmItemOpen, setConfirmItemOpen] = useState(false)
  const [confirmOrderOpen, setConfirmOrderOpen] = useState(false)
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null)
  const [deleteOrderId, setDeleteOrderId] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    imageUrl: '',
    category: 'Genel',
    stock: null as number | null,
    purchaseLimit: null as number | null,
    sponsorId: null as string | null,
    order: 0,
    requireApprovedSponsor: false
  })

  const [orderFormData, setOrderFormData] = useState({
    status: '',
    deliveryInfo: ''
  })

  const [uploadingImage, setUploadingImage] = useState(false)
  const [imagePublicId, setImagePublicId] = useState<string | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (!token) {
      router.push('/admin')
      return
    }
    loadItems()
    loadOrders()
    loadSponsors()
  }, [])

  // Auto-refresh orders when on orders tab
  useEffect(() => {
    if (activeTab !== 'orders') return

    // Initial load
    loadOrders()

    // Set up polling - refresh every 10 seconds (silent mode)
    const interval = setInterval(() => {
      loadOrders(true)
    }, 10000)

    return () => clearInterval(interval)
  }, [activeTab])

  async function loadItems() {
    try {
      const response = await fetch('/api/admin/shop')
      const data = await response.json()
      setItems(data.items || [])
    } catch (error) {
      console.error('Error loading items:', error)
      toast.error('Ürünler yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  // Sürükle-bırak sıralama - promosyonlarla aynı desen.
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
      const res = await fetch('/api/admin/shop/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: updates }),
      })
      if (!res.ok) throw new Error()
      toast.success('Sıralama kaydedildi')
    } catch {
      toast.error('Sıralama kaydedilemedi')
      loadItems()
    }
  }

  async function loadOrders(silent = false) {
    if (!silent) {
      setOrdersLoading(true)
    }
    try {
      const response = await fetch('/api/admin/shop/orders')
      const data = await response.json()
      const allOrders = data.orders || []

      // Bekliyor: sadece pending
      setPendingOrders(allOrders.filter((o: Order) => o.status === 'pending'))

      // Geçmiş: completed ve cancelled
      setHistoryOrders(allOrders.filter((o: Order) =>
        o.status === 'completed' || o.status === 'cancelled'
      ))
    } catch (error) {
      console.error('Error loading orders:', error)
      if (!silent) {
        toast.error('Siparişler yüklenemedi')
      }
    } finally {
      if (!silent) {
        setOrdersLoading(false)
      }
    }
  }

  async function loadSponsors() {
    try {
      const response = await fetch('/api/admin/sponsors')
      const data = await response.json()
      setSponsors(data.sponsors || [])
    } catch (error) {
      console.error('Error loading sponsors:', error)
    }
  }

  function openDialog(item?: ShopItem) {
    if (item) {
      setEditingItem(item)
      setFormData({
        name: item.name,
        description: item.description || '',
        price: item.price,
        imageUrl: item.imageUrl || '',
        category: item.category,
        stock: item.stock ?? null,
        purchaseLimit: item.purchaseLimit ?? null,
        sponsorId: item.sponsorId ?? null,
        order: item.order,
        requireApprovedSponsor: (item as any).requireApprovedSponsor ?? false
      })

      // Mevcut resmin public_id'sini extract et
      if (item.imageUrl && item.imageUrl.includes('cloudinary')) {
        try {
          const urlParts = item.imageUrl.split('/')
          const publicIdWithExt = urlParts.slice(-2).join('/')
          const publicId = publicIdWithExt.replace(/\.[^/.]+$/, '')
          setImagePublicId(publicId)
        } catch (err) {
          console.error('Public ID extraction error:', err)
          setImagePublicId(null)
        }
      } else {
        setImagePublicId(null)
      }
    } else {
      setEditingItem(null)
      setFormData({
        name: '',
        description: '',
        price: 0,
        imageUrl: '',
        category: 'Genel',
        stock: null,
        purchaseLimit: null,
        sponsorId: null,
        order: items.length,
        requireApprovedSponsor: false
      })
      setImagePublicId(null)
    }
    setDialogOpen(true)
  }

  function openOrderDialog(order: Order) {
    setEditingOrder(order)
    setOrderFormData({
      status: order.status,
      deliveryInfo: order.deliveryInfo || ''
    })
    setOrderDialogOpen(true)
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
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', `${SITE_CONFIG.cloudinary.folder}/shop`)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (data.success) {
        setFormData(prev => ({ ...prev, imageUrl: data.url }))
        setImagePublicId(data.publicId)
        toast.success('Resim yüklendi')
      } else {
        toast.error(data.error || 'Resim yüklenemedi')
      }
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('Resim yüklenirken hata oluştu')
    } finally {
      setUploadingImage(false)
    }
  }

  async function handleRemoveImage() {
    if (!imagePublicId) {
      setFormData(prev => ({ ...prev, imageUrl: '' }))
      return
    }

    try {
      await fetch('/api/upload', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicId: imagePublicId })
      })

      setFormData(prev => ({ ...prev, imageUrl: '' }))
      setImagePublicId(null)
      toast.success('Resim silindi')
    } catch (error) {
      console.error('Image remove error:', error)
      toast.error('Resim silinirken hata oluştu')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    try {
      const url = editingItem
        ? `/api/admin/shop/${editingItem.id}`
        : '/api/admin/shop'

      const method = editingItem ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          imagePublicId: imagePublicId
        })
      })

      const data = await response.json()

      if (data.item) {
        toast.success(editingItem ? 'Ürün güncellendi' : 'Ürün eklendi')
        setDialogOpen(false)
        setImagePublicId(null)
        loadItems()
      } else {
        toast.error(data.error || 'İşlem başarısız')
      }
    } catch (error) {
      console.error('Submit error:', error)
      toast.error('Bir hata oluştu')
    }
  }

  async function handleOrderUpdate(e: React.FormEvent) {
    e.preventDefault()

    if (!editingOrder) return

    try {
      const response = await fetch(`/api/admin/shop/order/${editingOrder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...orderFormData,
          processedBy: 'Admin'
        })
      })

      const data = await response.json()

      if (data.order) {
        toast.success('Sipariş güncellendi')
        setOrderDialogOpen(false)
        loadOrders()
      } else {
        toast.error(data.error || 'Güncelleme başarısız')
      }
    } catch (error) {
      console.error('Order update error:', error)
      toast.error('Bir hata oluştu')
    }
  }

  async function handleDelete(id: string) {
    setDeleteItemId(id)
    setConfirmItemOpen(true)
  }

  async function confirmDeleteItem() {
    if (!deleteItemId) return

    try {
      // Önce ürünü bul ve resminin public_id'sini al
      const item = items.find(i => i.id === deleteItemId)

      const response = await fetch(`/api/admin/shop/${deleteItemId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        // Cloudinary'den resmi sil (varsa)
        if (item?.imageUrl && item.imageUrl.includes('cloudinary')) {
          try {
            const urlParts = item.imageUrl.split('/')
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

        toast.success('Ürün silindi')
        loadItems()
      } else {
        toast.error(data.error || 'Silme başarısız')
      }
    } catch (error) {
      console.error('Delete error:', error)
      toast.error('Bir hata oluştu')
    } finally {
      setConfirmItemOpen(false)
      setDeleteItemId(null)
    }
  }

  async function handleDeleteOrder(id: string) {
    setDeleteOrderId(id)
    setConfirmOrderOpen(true)
  }

  async function confirmDeleteOrder() {
    if (!deleteOrderId) return

    try {
      const response = await fetch(`/api/admin/shop/order/${deleteOrderId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Sipariş silindi')
        loadOrders()
      } else {
        toast.error(data.error || 'Silme başarısız')
      }
    } catch (error) {
      console.error('Delete order error:', error)
      toast.error('Bir hata oluştu')
    } finally {
      setConfirmOrderOpen(false)
      setDeleteOrderId(null)
    }
  }

  async function toggleActive(id: string, currentActive: boolean) {
    try {
      const response = await fetch(`/api/admin/shop/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentActive })
      })

      const data = await response.json()

      if (data.item) {
        toast.success('Durum güncellendi')
        loadItems()
      } else {
        toast.error(data.error || 'Güncelleme başarısız')
      }
    } catch (error) {
      console.error('Toggle error:', error)
      toast.error('Bir hata oluştu')
    }
  }

  function getStatusBadge(status: string) {
    const badges = {
      pending: { icon: Clock, color: 'bg-yellow-500/20 text-yellow-400', text: 'Bekliyor' },
      completed: { icon: CheckCircle, color: 'bg-green-500/20 text-green-400', text: 'Tamamlandı' },
      cancelled: { icon: XCircle, color: 'bg-red-500/20 text-red-400', text: 'İptal' }
    }

    const badge = badges[status as keyof typeof badges] || badges.pending
    const Icon = badge.icon

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${badge.color}`}>
        <Icon className="w-3 h-3" />
        {badge.text}
      </span>
    )
  }

  function getOrderStats() {
    return {
      pending: pendingOrders.length,
      completed: historyOrders.filter(o => o.status === 'completed').length,
      cancelled: historyOrders.filter(o => o.status === 'cancelled').length,
      total: pendingOrders.length + historyOrders.length
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  const stats = getOrderStats()

  return (
    <div className="admin-page-container">
      <div className="admin-page-inner space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="admin-page-title flex items-center gap-2">
              <ShoppingCart className="w-8 h-8" />
              Market Yönetimi
            </h1>
            <p className="admin-page-subtitle">Ürünleri ve siparişleri yönetin</p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="products" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white/5 border border-white/10">
            <TabsTrigger value="products" className="admin-tab-inactive data-[state=active]:admin-tab-active">
              <Package className="w-4 h-4 mr-2" />
              Ürünler
            </TabsTrigger>
            <TabsTrigger value="orders" className="admin-tab-inactive data-[state=active]:admin-tab-active">
              <ShoppingCart className="w-4 h-4 mr-2" />
              Siparişler
              {stats.pending > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-yellow-500 text-white text-xs rounded-full">
                  {stats.pending}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Products Tab */}
          <TabsContent value="products" className="space-y-4">
            <div className="flex justify-end">
              <Button
                onClick={() => openDialog()}
                className="admin-btn-primary"
              >
                <Plus className="w-4 h-4 mr-2" />
                Yeni Ürün Ekle
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {items.length === 0 ? (
                <Card className="col-span-2 admin-card p-12 text-center">
                  <ShoppingCart className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                  <p className="admin-text-muted">Henüz ürün eklenmemiş</p>
                </Card>
              ) : (
                items.map((item, index) => (
                  <Card
                    key={item.id}
                    className="admin-card p-4"
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    style={{ opacity: draggedItem === index ? 0.5 : 1, cursor: 'grab' }}
                  >
                    <div className="flex gap-4">
                      <GripVertical className="w-4 h-4 admin-text-muted flex-shrink-0 mt-2" />
                      {item.imageUrl && (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-20 h-20 object-cover rounded-lg"
                        />
                      )}
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg font-semibold admin-text-primary">{item.name}</h3>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                item.isActive
                                  ? 'bg-green-500/20 text-green-400'
                                  : 'bg-gray-500/20 text-gray-400'
                              }`}>
                                {item.isActive ? 'Aktif' : 'Pasif'}
                              </span>
                            </div>
                            <p className="text-gray-400 text-sm mt-1 whitespace-pre-line">{item.description}</p>
                            <div className="flex gap-3 mt-2">
                              <span className="text-yellow-400 font-semibold">{item.price.toLocaleString('tr-TR')} Puan</span>
                              <span className="text-gray-400 text-sm">{item.category}</span>
                              {item.stock !== null && (
                                <span className="text-blue-400 text-sm">Stok: {item.stock}</span>
                              )}
                              {item.purchaseLimit !== null && (
                                <span className="text-pink-400 text-sm">Limit: {item.purchaseLimit}x/kişi</span>
                              )}
                              {item._count && (
                                <span className="text-green-400 text-sm">{item._count.purchases} satış</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleActive(item.id, item.isActive)}
                            className="admin-btn-outline"
                          >
                            {item.isActive ? 'Devre Dışı' : 'Aktif Et'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openDialog(item)}
                            className="admin-btn-outline"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(item.id)}
                            className="admin-btn-danger"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders" className="space-y-4">
            {/* Order Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="admin-card p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold admin-text-primary">{stats.total}</div>
                  <div className="text-sm admin-text-muted">Toplam</div>
                </div>
              </Card>
              <Card className="bg-yellow-500/10 border-yellow-500/20 p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-400">{stats.pending}</div>
                  <div className="text-sm text-yellow-400">Bekliyor</div>
                </div>
              </Card>
              <Card className="bg-green-500/10 border-green-500/20 p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">{stats.completed}</div>
                  <div className="text-sm text-green-400">Tamamlandı</div>
                </div>
              </Card>
              <Card className="bg-red-500/10 border-red-500/20 p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-400">{stats.cancelled}</div>
                  <div className="text-sm text-red-400">İptal</div>
                </div>
              </Card>
            </div>

            {/* Order Sub Tabs */}
            <Tabs value={orderSubTab} onValueChange={setOrderSubTab} className="space-y-4">
              <TabsList className="bg-white/5 border border-white/10">
                <TabsTrigger value="pending" className="admin-tab-inactive data-[state=active]:admin-tab-active">
                  <Clock className="w-4 h-4 mr-2" />
                  Bekliyor
                  {stats.pending > 0 && (
                    <span className="ml-2 px-2 py-0.5 bg-yellow-500 text-white text-xs rounded-full">
                      {stats.pending}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="history" className="admin-tab-inactive data-[state=active]:admin-tab-active">
                  <History className="w-4 h-4 mr-2" />
                  Geçmiş
                  <span className="ml-2 text-xs admin-text-muted">
                    ({stats.completed + stats.cancelled})
                  </span>
                </TabsTrigger>
              </TabsList>

              {/* Pending Orders */}
              <TabsContent value="pending" className="space-y-3">
                {ordersLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : pendingOrders.length === 0 ? (
                  <Card className="admin-card p-12 text-center">
                    <Clock className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                    <p className="admin-text-muted">Bekleyen sipariş yok</p>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {pendingOrders.map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        onEdit={openOrderDialog}
                        onDelete={handleDeleteOrder}
                        getStatusBadge={getStatusBadge}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* History Orders */}
              <TabsContent value="history" className="space-y-3">
                {ordersLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : historyOrders.length === 0 ? (
                  <Card className="admin-card p-12 text-center">
                    <History className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                    <p className="admin-text-muted">Geçmiş sipariş yok</p>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {historyOrders.map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        onEdit={openOrderDialog}
                        onDelete={handleDeleteOrder}
                        getStatusBadge={getStatusBadge}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add/Edit Product Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="admin-dialog max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="admin-text-primary">
              {editingItem ? 'Ürünü Düzenle' : 'Yeni Ürün Ekle'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name" className="admin-text-primary">Ürün Adı</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="admin-card text-white mt-1"
                placeholder="Ürün adı"
                required
              />
            </div>

            <div>
              <Label htmlFor="description" className="admin-text-primary">Açıklama</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="admin-card text-white mt-1"
                placeholder="Ürün açıklaması"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="price" className="admin-text-primary">Fiyat (Puan)</Label>
              <Input
                id="price"
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: parseInt(e.target.value) })}
                className="admin-card text-white mt-1"
                min="0"
                required
              />
            </div>

            <div>
              <Label className="admin-text-primary">Ürün Resmi</Label>
              <div className="mt-2 space-y-2">
                {formData.imageUrl ? (
                  <div className="relative">
                    <img
                      src={formData.imageUrl}
                      alt="Ürün"
                      className="w-full h-48 object-cover rounded-lg border border-white/10"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={handleRemoveImage}
                      className="absolute top-2 right-2"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-white/10 rounded-lg p-6 text-center">
                    <Upload className="w-8 h-8 mx-auto mb-2 admin-text-muted" />
                    <Input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/gif,image/svg+xml,image/webp,video/webm"
                      onChange={handleImageUpload}
                      disabled={uploadingImage}
                      className="admin-card admin-text-primary"
                    />
                    <p className="text-xs text-gray-400 mt-2">
                      {uploadingImage ? 'Yükleniyor...' : 'PNG, JPG, GIF, SVG, WebP, WebM (Max 5MB)'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="category" className="admin-text-primary">Kategori</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="admin-card text-white mt-1"
                placeholder="Genel"
                required
              />
              <p className="text-xs text-white/40 mt-1">
                Önerilen: Genel, Nakit (TRC20), Sponsor
              </p>
              {formData.category.toLowerCase() === 'nakit' && (
                <div className="mt-2 p-2 bg-green-500/10 border border-green-500/30 rounded text-xs">
                  <span className="text-green-400 font-semibold">TRC20 Bilgisi: </span>
                  <span className="admin-text-primary">Kullanıcılar bu ürünü alırken TRC20 USDT cüzdan adreslerini girecekler</span>
                </div>
              )}
            </div>

            {formData.category.toLowerCase() === 'sponsor' && (
              <div>
                <Label htmlFor="sponsorId" className="admin-text-primary">Sponsor Seç</Label>
                <Select
                  value={formData.sponsorId || 'none'}
                  onValueChange={(value) => setFormData({ ...formData, sponsorId: value === 'none' ? null : value })}
                >
                  <SelectTrigger className="admin-card text-white mt-1">
                    <SelectValue placeholder="Sponsor seçin" />
                  </SelectTrigger>
                  <SelectContent className="admin-dialog">
                    <SelectItem value="none" className="admin-text-primary">Sponsor Yok</SelectItem>
                    {sponsors.map((sponsor) => (
                      <SelectItem key={sponsor.id} value={sponsor.id} className="admin-text-primary">
                        {sponsor.name} ({sponsor.identifierType === 'username' ? 'Kullanıcı Adı' : sponsor.identifierType === 'id' ? 'ID' : 'Email'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-white/40 mt-1">
                  Kullanıcılar bu ürünü alırken seçilen sponsor bilgisini girecekler
                </p>
                <div className="flex items-center justify-between p-3 rounded-lg admin-card mt-2">
                  <div>
                    <p className="text-sm font-semibold admin-text-primary">Sadece onaylılar alabilsin</p>
                    <p className="text-xs text-white/40">Açıksa, sponsor bilgisi onaylanmamış kullanıcılar satın alamaz</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, requireApprovedSponsor: !formData.requireApprovedSponsor })}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex-shrink-0 ${
                      formData.requireApprovedSponsor ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'
                    }`}
                  >
                    {formData.requireApprovedSponsor ? 'Açık' : 'Kapalı'}
                  </button>
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="stock" className="admin-text-primary">Stok (Boş = Sınırsız)</Label>
              <Input
                id="stock"
                type="number"
                value={formData.stock || ''}
                onChange={(e) => setFormData({ ...formData, stock: e.target.value ? parseInt(e.target.value) : null })}
                className="admin-card text-white mt-1"
                min="0"
                placeholder="Sınırsız"
              />
            </div>

            <div>
              <Label htmlFor="purchaseLimit" className="admin-text-primary">Alım Sınırlaması (Boş = Sınırsız)</Label>
              <Input
                id="purchaseLimit"
                type="number"
                value={formData.purchaseLimit || ''}
                onChange={(e) => setFormData({ ...formData, purchaseLimit: e.target.value ? parseInt(e.target.value) : null })}
                className="admin-card text-white mt-1"
                min="0"
                placeholder="Sınırsız"
              />
            </div>

            <div>
              <Label htmlFor="order" className="admin-text-primary">Sıralama</Label>
              <Input
                id="order"
                type="number"
                value={formData.order}
                onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) })}
                className="admin-card text-white mt-1"
                min="0"
                required
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="flex-1 admin-btn-outline"
              >
                İptal
              </Button>
              <Button
                type="submit"
                className="flex-1 admin-btn-primary"
              >
                {editingItem ? 'Güncelle' : 'Ekle'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Order Dialog */}
      <Dialog open={orderDialogOpen} onOpenChange={setOrderDialogOpen}>
        <DialogContent className="admin-dialog">
          <DialogHeader>
            <DialogTitle className="admin-text-primary">Sipariş Düzenle</DialogTitle>
          </DialogHeader>
          {editingOrder && (
            <form onSubmit={handleOrderUpdate} className="space-y-4">
              <div className="bg-white/5 p-3 rounded">
                <div className="text-sm admin-text-muted">Ürün</div>
                <div className="text-white font-semibold">{editingOrder.item.name}</div>
                <div className="text-sm admin-page-subtitle">
                  Müşteri: {editingOrder.user.firstName || editingOrder.user.username}
                </div>
              </div>

              <div>
                <Label htmlFor="status" className="admin-text-primary">Sipariş Durumu</Label>
                <Select value={orderFormData.status} onValueChange={(value) => setOrderFormData({ ...orderFormData, status: value })}>
                  <SelectTrigger className="admin-card text-white mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="admin-dialog">
                    <SelectItem value="pending">Bekliyor</SelectItem>
                    <SelectItem value="completed">Tamamlandı</SelectItem>
                    <SelectItem value="cancelled">İptal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="deliveryInfo" className="admin-text-primary">Teslimat/Not Bilgisi</Label>
                <Textarea
                  id="deliveryInfo"
                  value={orderFormData.deliveryInfo}
                  onChange={(e) => setOrderFormData({ ...orderFormData, deliveryInfo: e.target.value })}
                  className="admin-card text-white mt-1"
                  placeholder="Teslimat bilgileri veya notlar..."
                  rows={3}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOrderDialogOpen(false)}
                  className="flex-1 admin-btn-outline"
                >
                  İptal
                </Button>
                <Button
                  type="submit"
                  className="flex-1 admin-btn-primary"
                >
                  Güncelle
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Item Dialog */}
      <ConfirmDialog
        open={confirmItemOpen}
        onOpenChange={setConfirmItemOpen}
        title="Ürün Silme"
        description="Bu ürünü silmek istediğinize emin misiniz?"
        onConfirm={confirmDeleteItem}
      />

      {/* Confirm Delete Order Dialog */}
      <ConfirmDialog
        open={confirmOrderOpen}
        onOpenChange={setConfirmOrderOpen}
        title="Sipariş Silme"
        description="Bu siparişi silmek istediğinize emin misiniz?"
        onConfirm={confirmDeleteOrder}
      />
    </div>
  )
}

// Order Card Component
function OrderCard({
  order,
  onEdit,
  onDelete,
  getStatusBadge
}: {
  order: Order
  onEdit: (order: Order) => void
  onDelete: (id: string) => void
  getStatusBadge: (status: string) => React.ReactNode
}) {
  return (
    <Card className="admin-card p-4 hover:bg-white/10 transition-colors">
      <div className="flex gap-4">
        {order.item.imageUrl && (
          <img
            src={order.item.imageUrl}
            alt={order.item.name}
            className="w-20 h-20 object-cover rounded-lg"
          />
        )}
        <div className="flex-1">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className="text-lg font-semibold admin-text-primary">{order.item.name}</h3>
              <p className="text-sm admin-text-muted">
                {order.user.firstName || order.user.username || 'Kullanıcı'}
                {' '}(@{order.user.username || order.user.telegramId})
              </p>
            </div>
            {getStatusBadge(order.status)}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="admin-text-muted">Fiyat:</span>
              <span className="text-yellow-400 font-semibold ml-1">{order.pointsSpent.toLocaleString('tr-TR')} Puan</span>
            </div>
            <div>
              <span className="admin-text-muted">Tarih:</span>
              <span className="text-white ml-1">
                {new Date(order.purchasedAt).toLocaleDateString('tr-TR')}
              </span>
            </div>
            <div>
              <span className="admin-text-muted">Saat:</span>
              <span className="text-white ml-1">
                {new Date(order.purchasedAt).toLocaleTimeString('tr-TR')}
              </span>
            </div>
            {order.processedBy && (
              <div>
                <span className="admin-text-muted">İşleyen:</span>
                <span className="text-white ml-1">{order.processedBy}</span>
              </div>
            )}
          </div>

          {order.deliveryInfo && (
            <div className="mt-2 p-2 bg-white/5 rounded text-sm">
              <span className="admin-text-muted">Not: </span>
              <span className="admin-text-primary">{order.deliveryInfo}</span>
            </div>
          )}

          {order.walletAddress && (
            <div className="mt-2 p-2 bg-green-500/10 border border-green-500/30 rounded text-sm">
              <span className="text-green-400 font-semibold">TRC20 Cüzdan: </span>
              <span className="text-white font-mono">{order.walletAddress}</span>
            </div>
          )}

          {order.sponsorInfo && (
            <div className="mt-2 p-2 bg-purple-500/10 border border-purple-500/30 rounded text-sm">
              <span className="text-purple-400 font-semibold">Sponsor Bilgisi: </span>
              <span className="admin-text-primary">{order.sponsorInfo}</span>
            </div>
          )}

          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onEdit(order)}
              className="admin-btn-outline"
            >
              <Edit className="w-4 h-4 mr-1" />
              Düzenle
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onDelete(order.id)}
              className="admin-btn-danger"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Sil
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}
