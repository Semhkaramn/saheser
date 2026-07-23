'use client'

import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import ProtectedRoute from '@/components/ProtectedRoute'
import ProfileHeader from '@/components/profile/ProfileHeader'
import ProfileTabs from '@/components/profile/ProfileTabs'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { useUserTheme } from '@/components/providers/user-theme-provider'
import {
  ThemedCard,
  ThemedButton,
} from '@/components/ui/themed'
import { Building2, Share2, ArrowRight, Gift, Loader2, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useAuth } from '@/components/providers/auth-provider'

interface PointHistory {
  id: string
  amount: number
  type: string
  description: string
  adminUsername?: string
  createdAt: string
}

interface Rank {
  id: string
  name: string
  icon: string
  color: string
  minXp: number
  order: number
}

interface Sponsor {
  id: string
  name: string
  identifierType: string
  logoUrl?: string
}

interface UserSponsorInfo {
  id: string
  identifier: string
  sponsor: Sponsor
}

interface UserData {
  id: string
  telegramId?: string
  telegramUsername?: string
  email?: string
  emailVerified?: boolean
  siteUsername?: string
  username?: string
  firstName?: string
  lastName?: string
  points: number
  xp: number
  totalMessages: number
  totalReferrals: number
  referralPoints: number
  pointHistory?: PointHistory[]
  messageStats?: {
    daily: number
    weekly: number
    monthly: number
    total: number
  }
  rank?: Rank
  nextRank?: Rank
  allRanks?: Rank[]
  dailySpinsLeft: number
  leaderboardRank?: number
  createdAt: string
  walletAddress?: string
  trc20WalletAddress?: string
}

interface Purchase {
  id: string
  item: {
    name: string
    imageUrl?: string
  }
  pointsSpent: number
  status: string
  purchasedAt: string
}

function ProfileContent() {
  const { refreshUser } = useAuth()
  const { theme } = useUserTheme()
  const [userData, setUserData] = useState<UserData | null>(null)
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)

  // Promocode state
  const [promocode, setPromocode] = useState('')
  const [promocodeLoading, setPromocodeLoading] = useState(false)
  const [promocodeSuccess, setPromocodeSuccess] = useState<{ points: number } | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      // Cache bypass için timestamp ekle
      const ts = Date.now()
      const [userRes, purchasesRes] = await Promise.all([
        fetch(`/api/user/me?_t=${ts}`, { credentials: 'include', cache: 'no-store' }),
        fetch(`/api/user/me/purchases?_t=${ts}`, { credentials: 'include', cache: 'no-store' })
      ])

      if (!userRes.ok || !purchasesRes.ok) {
        throw new Error('API request failed')
      }

      const userDataRes = await userRes.json()
      const purchasesData = await purchasesRes.json()

      setUserData(userDataRes)
      setPurchases(purchasesData.purchases || [])
    } catch (error) {
      console.error('Error loading profile data:', error)
      // Set empty data to stop loading spinner
      setUserData({
        id: '',
        points: 0,
        xp: 0,
        totalMessages: 0,
        totalReferrals: 0,
        referralPoints: 0,
        dailySpinsLeft: 0,
        createdAt: new Date().toISOString()
      } as UserData)
    } finally {
      setLoading(false)
    }
  }

  async function handlePromocodeSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!promocode.trim() || promocodeLoading) return

    setPromocodeLoading(true)
    setPromocodeSuccess(null)

    try {
      const res = await fetch('/api/promocode/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: promocode.trim() })
      })

      const data = await res.json()

      if (res.ok) {
        setPromocodeSuccess({ points: data.pointsEarned })
        toast.success(data.message || 'Promocode başarıyla kullanıldı!')
        refreshUser()
        loadData() // Profil verilerini yenile
        setPromocode('')

        // 3 saniye sonra success mesajını kaldır
        setTimeout(() => setPromocodeSuccess(null), 3000)
      } else {
        toast.error(data.error || 'Promocode kullanılamadı')
      }
    } catch (error) {
      console.error('Promocode hatası:', error)
      toast.error('Bir hata oluştu')
    } finally {
      setPromocodeLoading(false)
    }
  }

  if (loading || !userData) {
    return <LoadingSpinner fullscreen={true} />
  }

  return (
      <div className="user-page-container">
        <div className="user-page-inner space-y-4">
          {/* Profile Header */}
          <ProfileHeader userData={userData} onUpdate={loadData} />

          {/* Promocode - kompakt tek satır (eskiden büyük, etiketli, dolgulu bir karttı) */}
          <ThemedCard variant="default" className="p-3">
            {promocodeSuccess ? (
              <div className="flex items-center justify-center gap-2 py-1">
                <CheckCircle className="w-5 h-5" style={{ color: theme.colors.success }} />
                <span className="font-semibold" style={{ color: theme.colors.text }}>Tebrikler!</span>
                <span className="font-bold font-data" style={{ color: theme.colors.warning }}>+{promocodeSuccess.points} Puan</span>
              </div>
            ) : (
              <form onSubmit={handlePromocodeSubmit} className="flex gap-2">
                <div className="relative flex-1">
                  <Gift className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: theme.colors.textMuted }} />
                  <Input
                    value={promocode}
                    onChange={(e) => setPromocode(e.target.value.toUpperCase())}
                    className="w-full pl-9 font-mono tracking-wider"
                    placeholder="PROMOSYON KODU"
                    disabled={promocodeLoading}
                    autoComplete="off"
                  />
                </div>
                <ThemedButton
                  type="submit"
                  disabled={!promocode.trim() || promocodeLoading}
                  variant="primary"
                  className="px-5 whitespace-nowrap"
                >
                  {promocodeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Kullan'}
                </ThemedButton>
              </form>
            )}
          </ThemedCard>

          {/* Hızlı Bağlantılar - sıkı, tek satırlık iki kart */}
          <div className="grid grid-cols-2 gap-3">
            <Link href="/profil/sosyal-medya">
              <ThemedCard variant="hover" className="p-3.5 cursor-pointer group flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${theme.colors.primary}15` }}>
                  <Share2 className="w-[18px] h-[18px]" style={{ color: theme.colors.primary }} />
                </div>
                <span className="font-semibold text-sm truncate" style={{ color: theme.colors.text }}>Sosyal Medya</span>
                <ArrowRight className="w-4 h-4 ml-auto flex-shrink-0 group-hover:translate-x-0.5 transition-transform" style={{ color: theme.colors.textMuted }} />
              </ThemedCard>
            </Link>

            <Link href="/profil/sponsorlar">
              <ThemedCard variant="hover" className="p-3.5 cursor-pointer group flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${theme.colors.accent}15` }}>
                  <Building2 className="w-[18px] h-[18px]" style={{ color: theme.colors.accent }} />
                </div>
                <span className="font-semibold text-sm truncate" style={{ color: theme.colors.text }}>Aff Geçiş</span>
                <ArrowRight className="w-4 h-4 ml-auto flex-shrink-0 group-hover:translate-x-0.5 transition-transform" style={{ color: theme.colors.textMuted }} />
              </ThemedCard>
            </Link>
          </div>

          {/* History, Purchases, Ranks Tabs - Full Width */}
          <ProfileTabs
            pointHistory={userData.pointHistory}
            purchases={purchases}
            allRanks={userData.allRanks}
            currentRank={userData.rank}
            nextRank={userData.nextRank}
            currentXp={userData.xp}
          />
        </div>
      </div>
  )
}

export default function ProfilePage() {
  return (
    <ProtectedRoute requireAuth={true}>
      <ProfileContent />
    </ProtectedRoute>
  )
}
