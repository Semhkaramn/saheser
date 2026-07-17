'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import ProtectedRoute from '@/components/ProtectedRoute'
import ProfilePayment from '@/components/profile/ProfilePayment'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { ArrowLeft, Building2 } from 'lucide-react'
import { useUserTheme } from '@/components/providers/user-theme-provider'
import PageHeader from '@/components/PageHeader'

interface Sponsor {
  id: string
  name: string
  identifierType: string
  logoUrl?: string
}

interface UserSponsorInfo {
  id: string
  identifier: string
  status?: string
  sponsor: Sponsor
}

interface UserData {
  trc20WalletAddress?: string
}

function SponsorsContent() {
  const router = useRouter()
  const { theme, card, button } = useUserTheme()
  const [userData, setUserData] = useState<UserData | null>(null)
  const [sponsorInfos, setSponsorInfos] = useState<UserSponsorInfo[]>([])
  const [allSponsors, setAllSponsors] = useState<Sponsor[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      // Cache bypass için timestamp ekle
      const ts = Date.now()
      const [userRes, sponsorInfoRes, sponsorsRes] = await Promise.all([
        fetch(`/api/user/me?_t=${ts}`, { credentials: 'include', cache: 'no-store' }),
        fetch(`/api/user/sponsor-info?_t=${ts}`, { credentials: 'include', cache: 'no-store' }),
        fetch('/api/sponsors?minimal=true', { credentials: 'include' })
      ])

      const userDataRes = await userRes.json()
      const sponsorData = await sponsorInfoRes.json()
      const sponsorsData = await sponsorsRes.json()

      setUserData(userDataRes)
      setSponsorInfos(sponsorData.sponsorInfos || [])
      setAllSponsors(sponsorsData.sponsors || [])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
      loading || !userData ? (
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner fullscreen={false} />
        </div>
      ) : (
      <div className="user-page-container">
        <div className="user-page-inner space-y-4">
          {/* Header with Back Button */}
          <button
            onClick={() => router.push('/profile')}
            className="flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-70"
            style={{ color: theme.colors.textMuted }}
          >
            <ArrowLeft className="w-4 h-4" />
            Profile Dön
          </button>

          <PageHeader icon={Building2} title="Aff Geçiş" subtitle="Cüzdan ve sponsor bilgilerini yönet" />

          {/* Payment Methods (TRC20 + Sponsors) */}
          <div className="user-card p-4 sm:p-5 lg:p-6">
            <ProfilePayment
              walletAddress={userData.trc20WalletAddress}
              sponsorInfos={sponsorInfos}
              allSponsors={allSponsors}
              onUpdate={loadData}
            />
          </div>
        </div>
      </div>
      )
  )
}

export default function SponsorsPage() {
  return (
    <ProtectedRoute requireAuth={true}>
      <SponsorsContent />
    </ProtectedRoute>
  )
}
