'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthState, useModals } from '@/components/providers/auth-provider'
import { useLeaderboard } from '@/lib/hooks/useLeaderboard'
import { useUserTheme } from '@/components/providers/user-theme-provider'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import {
  ThemedCard,
  ThemedEmptyState,
} from '@/components/ui/themed'
import { Trophy, Crown, Medal, Star } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import { Button } from '@/components/ui/button'

interface LeaderboardUser {
  id: string
  siteUsername?: string
  firstName?: string
  lastName?: string
  points: number
  xp: number
  position: number
  avatar?: string
  rank?: {
    name: string
    icon: string
  }
}

function LeaderboardContent() {
  const router = useRouter()
  const { user } = useAuthState()
  const { setShowLoginModal } = useModals()
  const { theme, card, button } = useUserTheme()
  const [activeTab, setActiveTab] = useState('points')

  // ✅ OPTIMIZASYON: React Query hooks - Her tab için ayrı hook
  const {
    data: pointsData,
    isLoading: loadingPoints
  } = useLeaderboard('points', user?.id)

  const {
    data: xpData,
    isLoading: loadingXp
  } = useLeaderboard('xp', user?.id)

  const loading = loadingPoints || loadingXp

  // ✅ OPTIMIZASYON: Data destructuring
  const pointsLeaderboard = pointsData?.leaderboard || []
  const pointsCurrentUser = pointsData?.currentUser || null
  const xpLeaderboard = xpData?.leaderboard || []
  const xpCurrentUser = xpData?.currentUser || null

  const getPositionIcon = (position: number) => {
    switch (position) {
      case 1:
        return <Crown className="w-6 h-6" style={{ color: theme.colors.warning }} />
      case 2:
        return <Medal className="w-6 h-6" style={{ color: theme.colors.textMuted }} />
      case 3:
        return <Medal className="w-6 h-6" style={{ color: theme.colors.warning }} />
      default:
        return <span className="text-lg font-bold" style={{ color: theme.colors.textMuted }}>#{position}</span>
    }
  }

  const getPositionGradient = (position: number) => {
    switch (position) {
      case 1:
        return {
          background: `linear-gradient(to right, ${theme.colors.warning}20, ${theme.colors.warning}10)`,
          borderColor: `${theme.colors.warning}40`
        }
      case 2:
        return {
          background: `linear-gradient(to right, ${theme.colors.textMuted}20, ${theme.colors.textMuted}10)`,
          borderColor: `${theme.colors.textMuted}40`
        }
      case 3:
        return {
          background: `linear-gradient(to right, ${theme.colors.warning}20, ${theme.colors.error}10)`,
          borderColor: `${theme.colors.warning}40`
        }
      default:
        return {
          background: `linear-gradient(to right, ${theme.colors.backgroundSecondary}20, ${theme.colors.backgroundSecondary}10)`,
          borderColor: theme.colors.border
        }
    }
  }

  if (loading) {
    return <LoadingSpinner />
  }

  const renderLeaderboard = (leaderboard: LeaderboardUser[], currentUser: LeaderboardUser | null, sortBy: 'points' | 'xp') => (
    <>
{/* Senin Sıralaman kaldırıldı */}

      {leaderboard.length >= 3 && (
        <div className="grid grid-cols-3 gap-2 mb-6">
          <div className="flex flex-col items-center order-1">
            <div className="relative mb-2">
              <Avatar className="w-16 h-16 border-2" style={{ borderColor: theme.colors.textMuted }}>
                {leaderboard[1].avatar ? (
                  <AvatarImage src={leaderboard[1].avatar} alt="Avatar" />
                ) : (
                  <AvatarFallback
                    className="font-bold text-lg"
                    style={{
                      background: `linear-gradient(135deg, ${theme.colors.textMuted}, ${theme.colors.textSecondary})`,
                      color: theme.colors.text
                    }}
                  >
                    {leaderboard[1].siteUsername?.[0] || '?'}
                  </AvatarFallback>
                )}
              </Avatar>
              <div
                className="absolute -top-2 -right-2 rounded-full w-7 h-7 flex items-center justify-center border-2"
                style={{
                  background: theme.colors.textMuted,
                  borderColor: theme.colors.background
                }}
              >
                <span className="text-xs font-bold" style={{ color: theme.colors.text }}>2</span>
              </div>
            </div>
            <ThemedCard
              variant="default"
              className="p-2 w-full text-center"
              style={{
                background: `linear-gradient(to bottom, ${theme.colors.textMuted}20, ${theme.colors.textSecondary}20)`,
                borderColor: `${theme.colors.textMuted}40`
              }}
            >
              <p className="text-sm font-bold truncate mb-1" style={{ color: theme.colors.text }}>
                {leaderboard[1].siteUsername || 'Kullanıcı'}
              </p>
              <p className="text-base font-bold" style={{ color: theme.colors.warning }}>
                {sortBy === 'points' ? leaderboard[1].points.toLocaleString('tr-TR') : leaderboard[1].xp.toLocaleString('tr-TR')}
              </p>
              <p className="text-xs" style={{ color: theme.colors.textMuted }}>{sortBy === 'points' ? 'puan' : 'XP'}</p>
            </ThemedCard>
          </div>

          <div className="flex flex-col items-center order-2">
            <Crown className="w-8 h-8 mb-1 animate-pulse" style={{ color: theme.colors.warning }} />
            <div className="relative mb-2">
              <Avatar
                className="w-20 h-20 border-4 shadow-lg"
                style={{
                  borderColor: theme.colors.warning,
                  boxShadow: `0 0 20px ${theme.colors.warning}50`
                }}
              >
                {leaderboard[0].avatar ? (
                  <AvatarImage src={leaderboard[0].avatar} alt="Avatar" />
                ) : (
                  <AvatarFallback
                    className="font-bold text-xl"
                    style={{
                      background: `linear-gradient(135deg, ${theme.colors.warning}, ${theme.colors.primary})`,
                      color: theme.colors.text
                    }}
                  >
                    {leaderboard[0].siteUsername?.[0] || '?'}
                  </AvatarFallback>
                )}
              </Avatar>
              <div
                className="absolute -top-2 -right-2 rounded-full w-8 h-8 flex items-center justify-center border-2"
                style={{
                  background: theme.colors.warning,
                  borderColor: theme.colors.background
                }}
              >
                <span className="text-sm font-bold" style={{ color: theme.colors.background }}>1</span>
              </div>
            </div>
            <ThemedCard
              variant="default"
              className="p-2 w-full text-center"
              style={{
                background: `linear-gradient(to bottom, ${theme.colors.warning}20, ${theme.colors.primary}20)`,
                borderColor: `${theme.colors.warning}40`
              }}
            >
              <p className="text-sm font-bold truncate mb-1" style={{ color: theme.colors.text }}>
                {leaderboard[0].siteUsername || 'Kullanıcı'}
              </p>
              <p className="text-lg font-bold" style={{ color: theme.colors.warning }}>
                {sortBy === 'points' ? leaderboard[0].points.toLocaleString('tr-TR') : leaderboard[0].xp.toLocaleString('tr-TR')}
              </p>
              <p className="text-xs" style={{ color: theme.colors.textMuted }}>{sortBy === 'points' ? 'puan' : 'XP'}</p>
            </ThemedCard>
          </div>

          <div className="flex flex-col items-center order-3">
            <div className="relative mb-2">
              <Avatar className="w-16 h-16 border-2" style={{ borderColor: theme.colors.warning }}>
                {leaderboard[2].avatar ? (
                  <AvatarImage src={leaderboard[2].avatar} alt="Avatar" />
                ) : (
                  <AvatarFallback
                    className="font-bold text-lg"
                    style={{
                      background: `linear-gradient(135deg, ${theme.colors.warning}, ${theme.colors.error})`,
                      color: theme.colors.text
                    }}
                  >
                    {leaderboard[2].siteUsername?.[0] || '?'}
                  </AvatarFallback>
                )}
              </Avatar>
              <div
                className="absolute -top-2 -right-2 rounded-full w-7 h-7 flex items-center justify-center border-2"
                style={{
                  background: theme.colors.warning,
                  borderColor: theme.colors.background
                }}
              >
                <span className="text-xs font-bold" style={{ color: theme.colors.text }}>3</span>
              </div>
            </div>
            <ThemedCard
              variant="default"
              className="p-2 w-full text-center"
              style={{
                background: `linear-gradient(to bottom, ${theme.colors.warning}20, ${theme.colors.error}20)`,
                borderColor: `${theme.colors.warning}40`
              }}
            >
              <p className="text-sm font-bold truncate mb-1" style={{ color: theme.colors.text }}>
                {leaderboard[2].siteUsername || 'Kullanıcı'}
              </p>
              <p className="text-base font-bold" style={{ color: theme.colors.warning }}>
                {sortBy === 'points' ? leaderboard[2].points.toLocaleString('tr-TR') : leaderboard[2].xp.toLocaleString('tr-TR')}
              </p>
              <p className="text-xs" style={{ color: theme.colors.textMuted }}>{sortBy === 'points' ? 'puan' : 'XP'}</p>
            </ThemedCard>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {leaderboard.slice(3).map((user) => {
          const gradientStyle = getPositionGradient(user.position)
          return (
            <ThemedCard
              key={user.id}
              variant="hover"
              className="p-4 hover:scale-[1.02] transition-transform"
              style={{
                background: gradientStyle.background,
                borderColor: gradientStyle.borderColor
              }}
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 flex items-center justify-center">
                  {getPositionIcon(user.position)}
                </div>
                <Avatar className="w-12 h-12 border-2" style={{ borderColor: `${theme.colors.text}20` }}>
                  {user.avatar ? (
                    <AvatarImage src={user.avatar} alt="Avatar" />
                  ) : (
                    <AvatarFallback
                      className="font-bold"
                      style={{
                        background: `linear-gradient(135deg, ${theme.colors.backgroundSecondary}, ${theme.colors.background})`,
                        color: theme.colors.text
                      }}
                    >
                      {user.siteUsername?.[0] || '?'}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="flex-1">
                  <p className="font-bold text-base" style={{ color: theme.colors.text }}>
                    {user.siteUsername || 'Kullanıcı'}
                  </p>
                  <div className="flex items-center gap-2 text-xs" style={{ color: theme.colors.textMuted }}>
                    {user.rank && <span>{user.rank.icon} {user.rank.name}</span>}
                    {user.rank && <span>•</span>}
                    <span>{sortBy === 'points' ? `${user.xp.toLocaleString('tr-TR')} XP` : `${user.points.toLocaleString('tr-TR')} puan`}</span>
                  </div>
                </div>
                {user.rank && (
                  <span className="text-xl">{user.rank.icon}</span>
                )}
                <div className="text-right">
                  <p className="text-xl font-bold" style={{ color: theme.colors.warning }}>
                    {sortBy === 'points' ? user.points.toLocaleString('tr-TR') : user.xp.toLocaleString('tr-TR')}
                  </p>
                  <p className="text-xs" style={{ color: theme.colors.textMuted }}>{sortBy === 'points' ? 'puan' : 'XP'}</p>
                </div>
              </div>
            </ThemedCard>
          )
        })}
      </div>

      {leaderboard.length === 0 && (
        <ThemedEmptyState
          icon={<Trophy className="w-16 h-16" />}
          title="Henüz sıralama oluşturulmamış"
        />
      )}
    </>
  )

  return (
    <div className="user-page-container">
      <div className="user-page-inner space-y-4">

      <PageHeader icon={Trophy} title="Liderlik Tablosu" subtitle="En çok puan ve XP toplayan üyeler" />

      <Tabs defaultValue="points" className="w-full">
        <TabsList
          className="grid w-full grid-cols-2 mb-6"
          style={{
            background: theme.colors.backgroundSecondary,
            borderColor: theme.colors.border
          }}
        >
          <TabsTrigger
            value="points"
            className="flex items-center gap-2 data-[state=active]:shadow-lg"
            style={{ color: theme.colors.text }}
          >
            <Trophy className="w-4 h-4" />
            Puanlar
          </TabsTrigger>
          <TabsTrigger
            value="xp"
            className="flex items-center gap-2 data-[state=active]:shadow-lg"
            style={{ color: theme.colors.text }}
          >
            <Star className="w-4 h-4" />
            XP
          </TabsTrigger>
        </TabsList>

        <TabsContent value="points">
          {renderLeaderboard(pointsLeaderboard, pointsCurrentUser, 'points')}
        </TabsContent>

        <TabsContent value="xp">
          {renderLeaderboard(xpLeaderboard, xpCurrentUser, 'xp')}
        </TabsContent>
      </Tabs>
      </div>
    </div>
  )
}

export default function LeaderboardPage() {
  return (
      <LeaderboardContent />
  )
}
