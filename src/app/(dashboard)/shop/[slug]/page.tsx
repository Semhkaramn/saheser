'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { toast } from 'sonner'
import { useAuth } from '@/components/providers/auth-provider'
import { useUserTheme } from '@/components/providers/user-theme-provider'
import { useVerification } from '@/lib/hooks/useVerification'
import VerificationRequiredModal from '@/components/VerificationRequiredModal'
import { ThemedButton } from '@/components/ui/themed'
import { Input } from '@/components/ui/input'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import PageHeader from '@/components/PageHeader'
import { ArrowLeft, Coins, ShoppingBag, Heart } from 'lucide-react'
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
  stock?: number | null
  purchaseLimit?: number | null
  userPurchaseCount?: number
  remainingPurchases?: number | null
}

// ✅ Market artık listeden direkt satın almıyor - önce bu detay sayfasına
// geliyorsun (ürün görseli, tam açıklama, stok/limit bilgisi), satın alma
// buradan yapılıyor.
export default function ShopItemDetailPage() {
  const params = useParams()
  const router = useRouter()
  const itemSlug = params.slug as string
  const { user, setShowLoginModal, refreshUser } = useAuth()
  const { theme } = useUserTheme()
  const { requireVerification, showVerificationModal, actionName, closeVerificationModal } = useVerification()

  const [item, setItem] = useState<ShopItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState(false)
  const [showWalletForm, setShowWalletForm] = useState(false)
  const [walletAddressInput, setWalletAddressInput] = useState('')
  const [showSponsorForm, setShowSponsorForm] = useState(false)
  const [sponsorInfoData, setSponsorInfoData] = useState<{ sponsorId?: string; sponsorName?: string; identifierType?: string } | null>(null)
  const [sponsorInfoInput, setSponsorInfoInput] = useState('')

  useEffect(() => {
    loadItem()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemSlug, user?.id])

  async function loadItem() {
    try {
      const url = user ? `/api/shop/items?userId=${user.id}` : '/api/shop/items'
      const res = await fetch(url, { credentials: 'include' })
      const data = await res.json()
      const found = (data.items || []).find((i: ShopItem) => i.slug === itemSlug || i.id === itemSlug)
      setItem(found || null)
    } catch {
      toast.error('Ürün yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  function handleBuyClick() {
    if (!item) return
    if (!user) {
      toast.error('Satın almak için giriş yapmalısınız')
      setShowLoginModal(true)
      return
    }
    if (!requireVerification(() => attemptPurchase(), 'ürün satın almak')) {
      return
    }
    if (user.points < item.price) {
      toast.error('Yetersiz puan!')
      return
    }
    attemptPurchase()
  }

  async function attemptPurchase(extra?: { walletAddress?: string; sponsorInfo?: { sponsorId: string; identifier: string } }) {
    if (!item || purchasing) return
    setPurchasing(true)
    try {
      const res = await fetch('/api/shop/purchase', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id, ...extra }),
      })
      const data = await res.json()

      if (data.success) {
        toast.success('Satın alma başarılı!')
        setShowWalletForm(false)
        setShowSponsorForm(false)
        await refreshUser()
        await loadItem()
        return
      }

      if (data.error && (data.error.includes('TRC20') || data.error.includes('cüzdan'))) {
        setShowWalletForm(true)
        toast.info('Lütfen TRC20 cüzdan adresinizi girin')
        return
      }

      if (data.requiresSponsorInfo) {
        setSponsorInfoData({ sponsorId: data.sponsorId, sponsorName: data.sponsorName, identifierType: data.identifierType })
        setShowSponsorForm(true)
        return
      }

      toast.error(data.error || 'Satın alma başarısız')
    } catch {
      toast.error('Bir hata oluştu')
    } finally {
      setPurchasing(false)
    }
  }

  async function submitWallet() {
    if (!walletAddressInput.trim()) {
      toast.error('Cüzdan adresi gerekli')
      return
    }
    await attemptPurchase({ walletAddress: walletAddressInput.trim() })
  }

  async function submitSponsorInfo() {
    if (!sponsorInfoInput.trim() || !sponsorInfoData?.sponsorId) {
      toast.error('Bilgi gerekli')
      return
    }
    await attemptPurchase({ sponsorInfo: { sponsorId: sponsorInfoData.sponsorId, identifier: sponsorInfoInput.trim() } })
  }

  if (loading) return <LoadingSpinner fullscreen />

  if (!item) {
    return (
      <div className="user-page-container">
        <div className="user-page-inner space-y-4">
          <button onClick={() => router.push('/shop')} className="flex items-center gap-1.5 text-sm font-medium" style={{ color: theme.colors.textMuted }}>
            <ArrowLeft className="w-4 h-4" /> Markete Dön
          </button>
          <p style={{ color: theme.colors.textMuted }}>Ürün bulunamadı.</p>
        </div>
      </div>
    )
  }

  const limitReached = item.purchaseLimit != null && (item.userPurchaseCount ?? 0) >= item.purchaseLimit
  const outOfStock = item.stock != null && item.stock <= 0

  return (
    <div className="user-page-container">
      <div className="user-page-inner space-y-4 max-w-3xl mx-auto">
        <button onClick={() => router.push('/shop')} className="flex items-center gap-1.5 text-sm font-medium" style={{ color: theme.colors.textMuted }}>
          <ArrowLeft className="w-4 h-4" /> Markete Dön
        </button>

        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: theme.colors.card, border: `1px solid ${theme.colors.cardBorder}`, boxShadow: '0 4px 20px rgba(15,30,61,0.06)' }}
        >
          {item.imageUrl ? (
            <div className="relative w-full aspect-[2/1]" style={{ background: theme.colors.backgroundSecondary }}>
              <Image
                src={optimizeCloudinaryImage(item.imageUrl, 1000, 500)}
                unoptimized
                alt={item.name}
                fill
                sizes="(max-width: 768px) 100vw, 600px"
                priority
                className="object-cover"
              />
            </div>
          ) : item.sponsor?.logoUrl ? (
            // Ürünün kendi fotoğrafı yok - sponsor logosunu göster, aynı 2:1
            // oranı korunuyor (tüm resim yerleri tutarlı olsun diye).
            <div className="relative w-full aspect-[2/1]" style={{ background: theme.colors.backgroundSecondary }}>
              <Image
                src={optimizeCloudinaryImage(item.sponsor.logoUrl, 600, 300)}
                unoptimized
                alt={item.name}
                fill
                sizes="(max-width: 768px) 100vw, 600px"
                priority
                className="object-contain p-6"
              />
            </div>
          ) : null}

          <div className="p-5 sm:p-6 space-y-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.colors.primary }}>{item.category}</span>
              <h1 className="font-display text-xl sm:text-2xl font-bold mt-1" style={{ color: theme.colors.text }}>{item.name}</h1>
            </div>

            {item.description && (
              <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: theme.colors.textSecondary }}>{item.description}</p>
            )}

            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ background: `${theme.colors.warning}15` }}>
                <Coins className="w-4 h-4" style={{ color: theme.colors.warning }} />
                <span className="font-bold font-data" style={{ color: theme.colors.warning }}>{item.price.toLocaleString('tr-TR')} puan</span>
              </div>
              {item.stock != null && (
                <span className="text-xs" style={{ color: theme.colors.textMuted }}>Stok: {item.stock}</span>
              )}
              {item.purchaseLimit != null && (
                <span className="text-xs" style={{ color: theme.colors.textMuted }}>
                  Limit: {item.userPurchaseCount ?? 0}/{item.purchaseLimit}
                </span>
              )}
            </div>

            {showWalletForm ? (
              <div className="space-y-2 pt-2" style={{ borderTop: `1px solid ${theme.colors.border}` }}>
                <p className="text-sm font-medium" style={{ color: theme.colors.text }}>TRC20 Cüzdan Adresi</p>
                <Input value={walletAddressInput} onChange={(e) => setWalletAddressInput(e.target.value)} placeholder="T..." />
                <ThemedButton onClick={submitWallet} disabled={purchasing} variant="primary" className="w-full">
                  {purchasing ? 'Gönderiliyor...' : 'Kaydet ve Satın Al'}
                </ThemedButton>
              </div>
            ) : showSponsorForm ? (
              <div className="space-y-2 pt-2" style={{ borderTop: `1px solid ${theme.colors.border}` }}>
                <p className="text-sm font-medium" style={{ color: theme.colors.text }}>
                  {sponsorInfoData?.sponsorName} - {sponsorInfoData?.identifierType === 'username' ? 'Kullanıcı Adı' : sponsorInfoData?.identifierType === 'id' ? 'ID' : 'Email'}
                </p>
                <Input value={sponsorInfoInput} onChange={(e) => setSponsorInfoInput(e.target.value)} placeholder="Bilgini gir" />
                <ThemedButton onClick={submitSponsorInfo} disabled={purchasing} variant="primary" className="w-full">
                  {purchasing ? 'Gönderiliyor...' : 'Kaydet ve Satın Al'}
                </ThemedButton>
              </div>
            ) : (
              <ThemedButton
                onClick={handleBuyClick}
                disabled={purchasing || limitReached || outOfStock}
                variant="primary"
                className="w-full py-3"
              >
                <Heart className="w-4 h-4 mr-1.5" />
                {outOfStock ? 'Stokta Yok' : limitReached ? 'Limit Doldu' : purchasing ? 'İşleniyor...' : 'Satın Al'}
              </ThemedButton>
            )}
          </div>
        </div>
      </div>

      <VerificationRequiredModal
        isOpen={showVerificationModal}
        onClose={closeVerificationModal}
        onSuccess={() => {
          closeVerificationModal()
          refreshUser()
        }}
        actionName={actionName}
      />
    </div>
  )
}
