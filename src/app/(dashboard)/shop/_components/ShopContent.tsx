'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers/auth-provider'
import { useUserTheme } from '@/components/providers/user-theme-provider'
import { useVerification } from '@/lib/hooks/useVerification'
import VerificationRequiredModal from '@/components/VerificationRequiredModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import {
  ThemedCard,
  ThemedBadge,
  ThemedButton,
  ThemedEmptyState,
} from '@/components/ui/themed'
import { ShoppingBag, Coins, Heart, Package, Clock, CheckCircle2, Loader2 } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import { toast } from 'sonner'
import Image from 'next/image'
import { optimizeCloudinaryImage } from '@/lib/utils'

interface ShopItem {
  id: string
  name: string
  slug?: string | null
  description?: string
  price: number
  imageUrl?: string
  sponsor?: { logoUrl: string | null } | null
  category: string
  stock?: number
  purchaseLimit?: number | null
  userPurchaseCount?: number
  remainingPurchases?: number | null
  requireApprovedSponsor?: boolean
}

interface UserData {
  points: number
}

interface Purchase {
  id: string
  item: {
    name: string
    description?: string
    imageUrl?: string
  }
  pointsSpent: number
  status: string
  purchasedAt: string
}

function ShopContent() {
  const router = useRouter()
  const { user, setShowLoginModal, refreshUser } = useAuth()
  const { theme, card, button, badge, tab } = useUserTheme()
  const {
    isFullyVerified,
    showVerificationModal,
    actionName,
    closeVerificationModal,
    requireVerification
  } = useVerification()

  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [selectedCategory, setSelectedCategory] = useState('Tüm Kategoriler')
  const [loadingPurchases, setLoadingPurchases] = useState(false)
  const [purchasing, setPurchasing] = useState(false)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null)
  const [showWalletForm, setShowWalletForm] = useState(false)
  const [showSponsorForm, setShowSponsorForm] = useState(false)
  const [sponsorInfoData, setSponsorInfoData] = useState<{ sponsorId?: string; sponsorName?: string; identifierType?: string } | null>(null)
  const [sponsorInfoInput, setSponsorInfoInput] = useState('')
  const [savingSponsorInfo, setSavingSponsorInfo] = useState(false)
  const [walletAddressInput, setWalletAddressInput] = useState('')
  const [savingWallet, setSavingWallet] = useState(false)

  // ✅ FIX: Eskiden useState+useEffect ile mount olduktan SONRA fetch
  // başlıyordu (route değişti → boş ekran → istek → cevap → resimler YENİ
  // istenmeye başlıyordu). Artık React Query kullanıyoruz ve sunucu
  // (page.tsx) bu veriyi HTML ile birlikte önceden hazırlayıp gönderiyor -
  // resimler sayfa açılır açılmaz istenmeye başlıyor, "market resimleri geç
  // yükleniyor" hissi ortadan kalkıyor.
  const { data: itemsData, isLoading: loading, refetch: refetchItems } = useQuery({
    queryKey: ['shop-items', user?.id],
    queryFn: async () => {
      const url = user ? `/api/shop/items?userId=${user.id}` : '/api/shop/items'
      const res = await fetch(url, { credentials: 'include' })
      return res.json()
    },
    staleTime: 60 * 1000,
  })
  const items: ShopItem[] = itemsData?.items || []

  async function loadPurchases(silent = false) {
    if (!user) return

    if (!silent) {
      setLoadingPurchases(true)
    }

    try {
      const response = await fetch('/api/user/me/purchases', {
        credentials: 'include'
      })
      const data = await response.json()
      setPurchases(data.purchases || [])
    } catch (error) {
      console.error('Error loading purchases:', error)
      if (!silent) {
        toast.error('Siparişler yüklenirken hata oluştu')
      }
    } finally {
      if (!silent) {
        setLoadingPurchases(false)
      }
    }
  }

  function openPurchaseConfirm(item: ShopItem) {
    if (!user) {
      toast.error('Satın almak için giriş yapmalısınız')
      setShowLoginModal(true)
      return
    }

    // Telegram ve email doğrulaması kontrolü
    if (!requireVerification(() => {
      setSelectedItem(item)
      setConfirmDialogOpen(true)
    }, 'ürün satın almak')) {
      setSelectedItem(item) // Modal kapandığında hangi ürün olduğunu bilmek için
      return
    }

    if (!user || user.points < item.price) {
      toast.error('Yetersiz puan!')
      return
    }
    setSelectedItem(item)
    setConfirmDialogOpen(true)
  }

  async function saveWalletAndPurchase() {
    if (!walletAddressInput.trim()) {
      toast.error('Cüzdan adresi gerekli')
      return
    }

    try {
      setSavingWallet(true)
      const res = await fetch('/api/user/wallet', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: walletAddressInput.trim()
        })
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Kaydedilemedi')
      }

      toast.success('Cüzdan bilgisi kaydedildi!')
      setWalletAddressInput('')

      await confirmPurchase()
    } catch (error: any) {
      toast.error(error.message || 'Cüzdan bilgisi kaydedilemedi')
    } finally {
      setSavingWallet(false)
    }
  }

  async function saveSponsorInfoAndPurchase() {
    if (!sponsorInfoInput.trim()) {
      toast.error('Bilgi gerekli')
      return
    }

    if (!sponsorInfoData?.sponsorId) {
      toast.error('Sponsor bilgisi eksik')
      return
    }

    try {
      setSavingSponsorInfo(true)
      const res = await fetch('/api/user/sponsor-info', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sponsorId: sponsorInfoData.sponsorId,
          identifier: sponsorInfoInput.trim()
        })
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Kaydedilemedi')
      }

      toast.success('Sponsor bilgisi kaydedildi!')
      setSponsorInfoInput('')

      await confirmPurchase()
    } catch (error: any) {
      toast.error(error.message || 'Sponsor bilgisi kaydedilemedi')
    } finally {
      setSavingSponsorInfo(false)
    }
  }

  async function confirmPurchase() {
    if (!selectedItem) return

    if (purchasing) {
      toast.error('İşlem devam ediyor, lütfen bekleyin')
      return
    }

    setConfirmDialogOpen(false)
    setPurchasing(true)

    try {
      const response = await fetch('/api/shop/purchase', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: selectedItem.id })
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Satın alma başarılı!')
        setShowWalletForm(false)
        setShowSponsorForm(false)
        setSelectedItem(null)
        refetchItems()
        loadPurchases(true)
      } else {
        if (data.error && (data.error.includes('TRC20') || data.error.includes('cüzdan'))) {
          setShowWalletForm(true)
          toast.info('Lütfen TRC20 cüzdan adresinizi girin')
          return
        }

        if (data.requiresSponsorInfo) {
          setSponsorInfoData({
            sponsorId: data.sponsorId,
            sponsorName: data.sponsorName,
            identifierType: data.identifierType
          })
          setShowSponsorForm(true)
          toast.info(`Lütfen ${data.sponsorName} bilginizi girin`)
          return
        }

        toast.error(data.error || 'Satın alma başarısız')
      }
    } catch (error) {
      console.error('Purchase error:', error)
      toast.error('Bir hata oluştu')
    } finally {
      setPurchasing(false)
    }
  }

  const getStatusText = (status: string) => {
    const statusMap: { [key: string]: string } = {
      'pending': 'Bekliyor',
      'processing': 'Hazırlanıyor',
      'completed': 'Teslim Edildi',
      'cancelled': 'İptal Edildi'
    }
    return statusMap[status] || status
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-400" />
      case 'processing':
        return <Package className="w-4 h-4 text-orange-400" />
      case 'cancelled':
        return <Clock className="w-4 h-4 text-red-400" />
      default:
        return <Clock className="w-4 h-4 text-yellow-400" />
    }
  }

  const getStatusVariant = (status: string): 'success' | 'warning' | 'error' | 'secondary' => {
    switch (status) {
      case 'completed':
        return 'success'
      case 'processing':
        return 'warning'
      case 'cancelled':
        return 'error'
      default:
        return 'warning'
    }
  }

  const categories = ['Tüm Kategoriler', ...new Set(items.map(item => item.category))]
  const filteredItems = selectedCategory === 'Tüm Kategoriler'
    ? items
    : items.filter(item => item.category === selectedCategory)

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <div className="user-page-container">
      <div className="user-page-inner space-y-4">
      <div className="mx-auto px-4 pt-4">
        <PageHeader
          icon={ShoppingBag}
          title="Mağaza"
          subtitle="Puanlarınla ödülleri değiştir"
          action={
            <div
              className="flex items-center gap-2 px-4 py-2 rounded-full"
              style={{ background: `${theme.colors.warning}18`, border: `1px solid ${theme.colors.warning}35` }}
            >
              <Coins className="w-4 h-4" style={{ color: theme.colors.warning }} />
              <span className="font-bold font-data" style={{ color: theme.colors.text }}>
                {(user?.points || 0).toLocaleString('tr-TR')}
              </span>
            </div>
          }
        />
      </div>

      {/* Tabs */}
      <div className="mx-auto px-4">
        <Tabs defaultValue="products" className="w-full" onValueChange={(value) => {
          if (value === 'orders') {
            loadPurchases(true)
          }
        }}>
          <TabsList className={`grid w-full ${user ? 'grid-cols-2' : 'grid-cols-1'} mb-4 ${tab('list')}`}>
            <TabsTrigger
              value="products"
              className={`transition-all data-[state=active]:shadow-lg data-[state=active]:${button('primary')}`}
            >
              <ShoppingBag className="w-4 h-4 mr-2" />
              Ürünler
            </TabsTrigger>
            {user && (
              <TabsTrigger
                value="orders"
                className={`transition-all data-[state=active]:shadow-lg data-[state=active]:${button('primary')}`}
              >
                <Package className="w-4 h-4 mr-2" />
                Siparişlerim
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="products" className="space-y-4">
            {/* Category Filter */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {categories.map(category => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className="px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-colors"
                  style={{
                    background: selectedCategory === category
                      ? theme.colors.text
                      : `${theme.colors.text}20`,
                    color: selectedCategory === category
                      ? theme.colors.background
                      : theme.colors.text
                  }}
                >
                  {category}
                </button>
              ))}
            </div>

            {/* Items Grid */}
            {filteredItems.length === 0 ? (
              <ThemedEmptyState
                icon={<ShoppingBag className="w-16 h-16" />}
                title="Henüz ürün bulunmuyor"
              />
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                {filteredItems.map((item, index) => (
                  <ThemedCard
                    key={item.id}
                    variant="hover"
                    className="overflow-hidden p-0 cursor-pointer h-full flex flex-col"
                    onClick={() => router.push(`/shop/${item.slug || item.id}`)}
                  >
                    {item.imageUrl ? (
                      <div
                        className="aspect-[2/1] relative"
                        style={{
                          background: `linear-gradient(135deg, ${theme.colors.gradientFrom}20, ${theme.colors.gradientTo}20)`
                        }}
                      >
                        <Image
                          src={optimizeCloudinaryImage(item.imageUrl, 500, 250)}
                          unoptimized
                          alt={item.name}
                          fill
                          sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                          priority={index < 4}
                          loading={index < 24 ? undefined : "lazy"}
                          placeholder="blur"
                          blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI0U0RUVGRiIvPjwvc3ZnPg=="
                          className="object-cover transition-opacity duration-300"
                        />
                      </div>
                    ) : item.sponsor?.logoUrl ? (
                      // Ürünün kendi fotoğrafı yok ama sponsoru var - sponsor
                      // logosunu göster, aynı 2:1 oranı korunuyor (tutarlılık).
                      <div
                        className="aspect-[2/1] relative"
                        style={{
                          background: `linear-gradient(135deg, ${theme.colors.gradientFrom}20, ${theme.colors.gradientTo}20)`
                        }}
                      >
                        <Image
                          src={optimizeCloudinaryImage(item.sponsor.logoUrl, 300, 150)}
                          unoptimized
                          alt={item.name}
                          fill
                          sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                          className="object-contain p-4"
                        />
                      </div>
                    ) : null}
                    <div className="p-3 flex-1 flex flex-col">
                      <h3
                        className="font-semibold mb-1 font-display leading-snug"
                        style={{
                          color: theme.colors.text,
                          fontSize: item.name.length > 28 ? '0.75rem' : item.name.length > 18 ? '0.8125rem' : '0.875rem',
                        }}
                      >
                        {item.name}
                      </h3>
                      {item.description && (
                        <p
                          className="text-xs mb-2.5"
                          style={{ color: theme.colors.textMuted, whiteSpace: 'pre-line' }}
                        >
                          {item.description}
                        </p>
                      )}
                      <div className="mt-auto">
                        <div className="flex items-center justify-between mb-2.5">
                          <div
                            className="flex items-center gap-1 px-2.5 py-1 rounded-full"
                            style={{ background: `${theme.colors.warning}18` }}
                          >
                            <Coins className="w-3.5 h-3.5" style={{ color: theme.colors.warning }} />
                            <span className="font-bold text-sm font-data" style={{ color: theme.colors.warning }}>
                              {item.price.toLocaleString('tr-TR')}
                            </span>
                          </div>
                          {item.stock !== null && (
                            <span className="text-[11px]" style={{ color: theme.colors.textMuted }}>
                              Stok: {item.stock}
                            </span>
                          )}
                        </div>
                        {item.purchaseLimit !== null &&
                         item.purchaseLimit !== undefined &&
                         item.userPurchaseCount !== undefined &&
                         item.userPurchaseCount >= item.purchaseLimit ? (
                          <button
                            disabled
                            className="w-full py-2 px-4 rounded-full text-xs font-semibold opacity-70 cursor-not-allowed"
                            style={{
                              background: `${theme.colors.error}18`,
                              color: theme.colors.error,
                              border: `1px solid ${theme.colors.error}30`
                            }}
                          >
                            Limit Doldu
                          </button>
                        ) : (
                          <ThemedButton
                            onClick={(e) => { e.stopPropagation(); router.push(`/shop/${item.slug || item.id}`) }}
                            variant="primary"
                            className="w-full rounded-full"
                            size="sm"
                          >
                            <Heart className="w-4 h-4 mr-1" />
                            İncele
                          </ThemedButton>
                        )}
                      </div>
                    </div>
                  </ThemedCard>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="orders">
            {!user ? (
              <ThemedEmptyState
                icon={<Package className="w-16 h-16" />}
                title="Siparişlerinizi görmek için giriş yapmalısınız"
                action={
                  <ThemedButton
                    onClick={() => setShowLoginModal(true)}
                    variant="primary"
                  >
                    Giriş Yap
                  </ThemedButton>
                }
              />
            ) : loadingPurchases ? (
              <div className="flex items-center justify-center py-12">
                <div
                  className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin"
                  style={{ borderColor: `${theme.colors.primary} transparent ${theme.colors.primary} ${theme.colors.primary}` }}
                />
              </div>
            ) : purchases.length === 0 ? (
              <ThemedEmptyState
                icon={<Package className="w-16 h-16" />}
                title="Henüz siparişiniz yok"
              />
            ) : (
              <div className="space-y-3">
                {purchases.map((purchase, index) => (
                  <ThemedCard key={purchase.id} variant="hover" className="p-4">
                    <div className="flex gap-4">
                      {purchase.item.imageUrl && (
                        <div
                          className="w-20 h-20 rounded-lg overflow-hidden relative flex-shrink-0"
                          style={{
                            background: `linear-gradient(135deg, ${theme.colors.gradientFrom}20, ${theme.colors.gradientTo}20)`
                          }}
                        >
                          <Image
                            src={optimizeCloudinaryImage(purchase.item.imageUrl, 160, 160)}
                            unoptimized
                            alt={purchase.item.name}
                            fill
                            sizes="80px"
                            priority={index < 3}
                            loading={index < 8 ? undefined : "lazy"}
                            placeholder="blur"
                            blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYwIiBoZWlnaHQ9IjE2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTYwIiBoZWlnaHQ9IjE2MCIgZmlsbD0iI0U0RUVGRiIvPjwvc3ZnPg=="
                            className="object-cover transition-opacity duration-300"
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold mb-1" style={{ color: theme.colors.text }}>
                          {purchase.item.name}
                        </h3>
                        {purchase.item.description && (
                          <p className="text-xs mb-2" style={{ color: theme.colors.textMuted, whiteSpace: 'pre-line' }}>
                            {purchase.item.description}
                          </p>
                        )}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <Coins className="w-4 h-4" style={{ color: theme.colors.warning }} />
                            <span className="font-bold" style={{ color: theme.colors.warning }}>
                              {purchase.pointsSpent.toLocaleString('tr-TR')}
                            </span>
                          </div>
                          <ThemedBadge variant={getStatusVariant(purchase.status)} className="text-xs flex items-center gap-1">
                            {getStatusIcon(purchase.status)}
                            {getStatusText(purchase.status)}
                          </ThemedBadge>
                        </div>
                        <p className="text-xs mt-2" style={{ color: theme.colors.textMuted }}>
                          {new Date(purchase.purchasedAt).toLocaleDateString('tr-TR', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  </ThemedCard>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Purchase Confirmation / Info Forms Dialog */}
      <AlertDialog open={confirmDialogOpen || showWalletForm || showSponsorForm} onOpenChange={(open) => {
        if (!open) {
          setConfirmDialogOpen(false)
          setShowWalletForm(false)
          setShowSponsorForm(false)
          setSelectedItem(null)
          setWalletAddressInput('')
          setSponsorInfoInput('')
        }
      }}>
        <AlertDialogContent
          className="border"
          style={{
            background: theme.colors.background,
            borderColor: theme.colors.border
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle style={{ color: theme.colors.text }}>
              {showWalletForm ? 'Cüzdan Bilgisi Gerekli' : showSponsorForm ? 'Sponsor Bilgisi Gerekli' : 'Satın Alma Onayı'}
            </AlertDialogTitle>
            <AlertDialogDescription style={{ color: theme.colors.textSecondary }}>
              {selectedItem && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    {(selectedItem.imageUrl || selectedItem.sponsor?.logoUrl) && (
                      <div
                        className="w-16 h-16 rounded-full overflow-hidden relative flex-shrink-0"
                        style={{
                          background: `linear-gradient(135deg, ${theme.colors.gradientFrom}20, ${theme.colors.gradientTo}20)`
                        }}
                      >
                        <Image
                          src={optimizeCloudinaryImage((selectedItem.imageUrl || selectedItem.sponsor?.logoUrl) as string, 400, 400)}
                          unoptimized
                          alt={selectedItem.name}
                          fill
                          className={selectedItem.imageUrl ? 'object-cover' : 'object-contain p-2'}
                        />
                      </div>
                    )}
                    <div>
                      <p className="font-semibold" style={{ color: theme.colors.text }}>{selectedItem.name}</p>
                      {selectedItem.description && (
                        <p className="text-sm whitespace-pre-line" style={{ color: theme.colors.textMuted }}>{selectedItem.description}</p>
                      )}
                    </div>
                  </div>

                  {showWalletForm ? (
                    <div className="space-y-3 py-2">
                      <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                        Bu ürünü satın alabilmek için TRC20 cüzdan adresinizi eklemeniz gerekmektedir.
                      </p>
                      <div className="space-y-2">
                        <label className="text-sm font-medium" style={{ color: theme.colors.text }}>TRC20 Cüzdan Adresi</label>
                        <Input
                          name="walletAddress"
                          value={walletAddressInput}
                          onChange={(e) => setWalletAddressInput(e.target.value)}
                          placeholder="TRC20 cüzdan adresinizi girin"
                          className="border"
                          style={{
                            background: theme.colors.backgroundSecondary,
                            borderColor: theme.colors.border,
                            color: theme.colors.text
                          }}
                          disabled={savingWallet}
                        />
                      </div>
                    </div>
                  ) : showSponsorForm ? (
                    <div className="space-y-3 py-2">
                      <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                        Bu ürünü satın alabilmek için sponsor bilginizi eklemeniz gerekmektedir.
                      </p>
                      {sponsorInfoData?.sponsorName && (
                        <p className="text-sm">
                          <span className="font-semibold" style={{ color: theme.colors.text }}>Sponsor: </span>
                          {sponsorInfoData.sponsorName}
                        </p>
                      )}
                      <div className="space-y-2">
                        <label className="text-sm font-medium" style={{ color: theme.colors.text }}>
                          {sponsorInfoData?.identifierType === 'username' ? 'Kullanıcı Adı' :
                           sponsorInfoData?.identifierType === 'phone' ? 'Telefon Numarası' :
                           sponsorInfoData?.identifierType === 'email' ? 'E-posta' : 'ID'}
                        </label>
                        <Input
                          name="sponsorInfo"
                          value={sponsorInfoInput}
                          onChange={(e) => setSponsorInfoInput(e.target.value)}
                          placeholder={
                            sponsorInfoData?.identifierType === 'username' ? 'Kullanıcı adınızı girin' :
                            sponsorInfoData?.identifierType === 'phone' ? 'Telefon numaranızı girin' :
                            sponsorInfoData?.identifierType === 'email' ? 'E-posta adresinizi girin' : 'ID girin'
                          }
                          className="border"
                          style={{
                            background: theme.colors.backgroundSecondary,
                            borderColor: theme.colors.border,
                            color: theme.colors.text
                          }}
                          disabled={savingSponsorInfo}
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div
                        className="rounded-lg p-3 space-y-2"
                        style={{ background: `${theme.colors.text}10` }}
                      >
                        <div className="flex justify-between items-center">
                          <span style={{ color: theme.colors.textMuted }}>Ürün Fiyatı:</span>
                          <div className="flex items-center gap-1">
                            <Coins className="w-4 h-4" style={{ color: theme.colors.warning }} />
                            <span className="font-bold" style={{ color: theme.colors.warning }}>
                              {selectedItem.price.toLocaleString('tr-TR')}
                            </span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span style={{ color: theme.colors.textMuted }}>Mevcut Puanınız:</span>
                          <div className="flex items-center gap-1">
                            <Coins className="w-4 h-4" style={{ color: theme.colors.warning }} />
                            <span className="font-bold" style={{ color: theme.colors.warning }}>
                              {(user?.points || 0).toLocaleString('tr-TR')}
                            </span>
                          </div>
                        </div>
                        <div className="pt-2" style={{ borderTop: `1px solid ${theme.colors.border}` }}>
                          <div className="flex justify-between items-center">
                            <span style={{ color: theme.colors.textMuted }}>Kalan Puan:</span>
                            <div className="flex items-center gap-1">
                              <Coins className="w-4 h-4" style={{ color: theme.colors.warning }} />
                              <span className="font-bold" style={{ color: theme.colors.warning }}>
                                {((user?.points || 0) - selectedItem.price).toLocaleString('tr-TR')}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-center" style={{ color: theme.colors.textMuted }}>
                        Bu ürünü satın almak istediğinizden emin misiniz?
                      </p>
                    </>
                  )}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <ThemedButton
              onClick={() => {
                setConfirmDialogOpen(false)
                setShowWalletForm(false)
                setShowSponsorForm(false)
                setSelectedItem(null)
                setWalletAddressInput('')
                setSponsorInfoInput('')
              }}
              disabled={purchasing || savingWallet || savingSponsorInfo}
              variant="secondary"
              size="md"
            >
              İptal
            </ThemedButton>
            <ThemedButton
              onClick={showWalletForm ? saveWalletAndPurchase : showSponsorForm ? saveSponsorInfoAndPurchase : confirmPurchase}
              disabled={
                purchasing ||
                savingWallet ||
                savingSponsorInfo ||
                (showWalletForm && !walletAddressInput.trim()) ||
                (showSponsorForm && !sponsorInfoInput.trim())
              }
              variant="primary"
              size="md"
            >
              {purchasing || savingWallet || savingSponsorInfo ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {savingWallet ? 'Kaydediliyor...' : savingSponsorInfo ? 'Kaydediliyor...' : 'İşleniyor...'}
                </>
              ) : showWalletForm ? (
                'Kaydet ve Satın Al'
              ) : showSponsorForm ? (
                'Kaydet ve Satın Al'
              ) : (
                'Satın Al'
              )}
            </ThemedButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Verification Required Modal */}
      <VerificationRequiredModal
        isOpen={showVerificationModal}
        onClose={closeVerificationModal}
        onSuccess={() => {
          closeVerificationModal()
          refreshUser()
          // Doğrulama tamamlandıktan sonra seçili ürün varsa satın alma dialogunu aç
          if (selectedItem && user && user.points >= selectedItem.price) {
            setConfirmDialogOpen(true)
          }
        }}
        actionName={actionName}
      />
      </div>
    </div>
  )
}

export default function ShopPageClient() {
  return (
      <ShopContent />
  )
}
