'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import ProtectedRoute from '@/components/ProtectedRoute'
import ProfileTelegram from '@/components/profile/ProfileTelegram'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { ArrowLeft, Share2 } from 'lucide-react'
import { useUserTheme } from '@/components/providers/user-theme-provider'
import PageHeader from '@/components/PageHeader'

interface TelegramStatus {
  connected: boolean
  canReconnect: boolean
  daysUntilReconnect?: number
}

interface UserData {
  telegramId?: string
  telegramUsername?: string
}

function SocialMediaContent() {
  const router = useRouter()
  const { theme, button } = useUserTheme()
  const [userData, setUserData] = useState<UserData | null>(null)
  const [telegramStatus, setTelegramStatus] = useState<TelegramStatus>({ connected: false, canReconnect: true })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [userRes, telegramRes] = await Promise.all([
        fetch('/api/user/me'),
        fetch('/api/user/telegram-status')
      ])

      const userDataRes = await userRes.json()
      const telegramData = await telegramRes.json()

      setUserData(userDataRes)
      setTelegramStatus(telegramData)
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
            onClick={() => router.push('/profil')}
            className="flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-70"
            style={{ color: theme.colors.textMuted }}
          >
            <ArrowLeft className="w-4 h-4" />
            Profile Dön
          </button>

          <PageHeader icon={Share2} title="Sosyal Medya Bağlama" subtitle="Hesaplarını bağlayıp doğrula" />

          {/* Telegram Connection */}
          <ProfileTelegram
            telegramUsername={userData.telegramUsername}
            telegramId={userData.telegramId}
            telegramStatus={telegramStatus}
            onUpdate={loadData}
          />

          {/* Other social media platforms can be added here */}
        </div>
      </div>
      )
  )
}

export default function SocialMediaPage() {
  return (
    <ProtectedRoute requireAuth={true}>
      <SocialMediaContent />
    </ProtectedRoute>
  )
}
