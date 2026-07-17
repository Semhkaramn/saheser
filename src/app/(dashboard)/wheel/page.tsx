'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth, useAuthActions } from '@/components/providers/auth-provider'
import { useWheelData, useSpinWheel, useRefreshWheelData } from '@/lib/hooks/useWheel'
import { useUserTheme } from '@/components/providers/user-theme-provider'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import {
  ThemedCard,
  ThemedButton,
  ThemedEmptyState,
} from '@/components/ui/themed'
import { Ticket, Gift, TrendingUp, Trophy } from 'lucide-react'
import { toast } from 'sonner'
import PageHeader from '@/components/PageHeader'

interface WheelPrize {
  id: string
  name: string
  points: number
  color: string
  order: number
}

interface UserData {
  dailySpinsLeft: number
}

interface RecentWinner {
  id: string
  user: {
    siteUsername?: string
    avatar?: string
  }
  prize: {
    name: string
  }
  pointsWon: number
  spunAt: string
}

function WheelContent() {
  const router = useRouter()
  const { user, setShowLoginModal } = useAuth()
  const { refreshUser } = useAuthActions()
  const { theme, button, card } = useUserTheme()

  const { prizes, winners: recentWinners, isLoading: loading } = useWheelData({ enablePolling: true })
  const spinMutation = useSpinWheel()
  const refreshWheelData = useRefreshWheelData()

  const [spinning, setSpinning] = useState(false)
  const [rotation, setRotation] = useState(0)

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])

  async function spinWheel() {
    if (!user) {
      toast.error('Çark çevirmek için giriş yapmalısınız')
      setShowLoginModal(true)
      return
    }

    if (!user.dailySpinsLeft || user.dailySpinsLeft <= 0) {
      toast.error('Günlük çark hakkınız kalmadı!')
      return
    }

    setSpinning(true)

    try {
      const data = await spinMutation.mutateAsync()

      if (data.success) {
        await refreshUser()

        const prizeIndex = prizes.findIndex(p => p.id === data.prize.id)

        const segmentAngle = 360 / prizes.length
        const prizeStartAngle = -90 + (prizeIndex * segmentAngle)
        const prizeMidAngle = prizeStartAngle + (segmentAngle / 2)

        let targetAngle = -90 - prizeMidAngle

        while (targetAngle < 0) {
          targetAngle += 360
        }
        targetAngle = targetAngle % 360

        const randomSpins = 5 + Math.floor(Math.random() * 5)
        const totalRotation = (randomSpins * 360) + targetAngle

        setRotation(totalRotation)

        setTimeout(() => {
          setSpinning(false)
          toast.success(`Tebrikler! ${data.pointsWon} puan kazandınız!`, {
            duration: 5000,
          })

          setTimeout(() => {
            refreshWheelData()
          }, 500)
        }, 4000)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Çark çevrilemedi'
      toast.error(errorMessage)
      setSpinning(false)
    }
  }

  if (loading) {
    return <LoadingSpinner />
  }

  const segmentAngle = 360 / (prizes.length || 8)

  return (
    <div className="user-page-container">
      <div className="user-page-inner space-y-4 max-w-5xl mx-auto">
        <PageHeader
          icon={Gift}
          title="Şans Çarkı"
          subtitle={user ? `Kalan hakkın: ${user.dailySpinsLeft} çevirme` : 'Günde bir kez ücretsiz çevir'}
        />

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Çark bölümü - 3/5 genişlik */}
          <div className="lg:col-span-3 flex flex-col items-center">
            <div
              className="w-full rounded-3xl p-6 sm:p-8 flex flex-col items-center"
              style={{ background: theme.colors.card, border: `1px solid ${theme.colors.cardBorder}` }}
            >
              <div className="relative w-full max-w-sm aspect-square">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-3 z-10">
                  <div
                    className="w-0 h-0 border-l-[16px] border-l-transparent border-r-[16px] border-r-transparent border-t-[28px] drop-shadow-2xl"
                    style={{ borderTopColor: theme.colors.primary }}
                  />
                </div>

                <div
                  className="w-full h-full rounded-full relative overflow-hidden"
                  style={{
                    padding: 6,
                    background: `linear-gradient(135deg, ${theme.colors.gradientFrom}, ${theme.colors.gradientTo})`,
                  }}
                >
                  <div className="w-full h-full rounded-full overflow-hidden" style={{ background: theme.colors.background }}>
                    <svg
                      viewBox="0 0 200 200"
                      className="w-full h-full"
                      style={{
                        transform: `rotate(${rotation}deg)`,
                        transition: spinning ? 'transform 4s cubic-bezier(0.25, 0.1, 0.25, 1)' : 'none'
                      }}
                    >
                      {prizes.map((prize, index) => {
                        const startAngle = index * segmentAngle - 90
                        const endAngle = (index + 1) * segmentAngle - 90
                        const midAngle = (startAngle + endAngle) / 2

                        const startX = 100 + 100 * Math.cos((startAngle * Math.PI) / 180)
                        const startY = 100 + 100 * Math.sin((startAngle * Math.PI) / 180)
                        const endX = 100 + 100 * Math.cos((endAngle * Math.PI) / 180)
                        const endY = 100 + 100 * Math.sin((endAngle * Math.PI) / 180)

                        const textRadius = 65
                        const textX = 100 + textRadius * Math.cos((midAngle * Math.PI) / 180)
                        const textY = 100 + textRadius * Math.sin((midAngle * Math.PI) / 180)

                        return (
                          <g key={prize.id}>
                            <path
                              d={`M 100 100 L ${startX} ${startY} A 100 100 0 0 1 ${endX} ${endY} Z`}
                              fill={prize.color}
                              stroke={theme.colors.background}
                              strokeWidth="1"
                            />
                            <text
                              x={textX}
                              y={textY}
                              textAnchor="middle"
                              dominantBaseline="middle"
                              fill="white"
                              fontWeight="bold"
                              fontSize="14"
                              style={{
                                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
                                transform: `rotate(${midAngle}deg)`,
                                transformOrigin: `${textX}px ${textY}px`
                              }}
                            >
                              {prize.name}
                            </text>
                          </g>
                        )
                      })}
                    </svg>

                    <div
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full flex items-center justify-center shadow-2xl"
                      style={{
                        background: `linear-gradient(135deg, ${theme.colors.gradientFrom}, ${theme.colors.gradientTo})`,
                        border: `3px solid ${theme.colors.background}`,
                      }}
                    >
                      <Gift className="w-8 h-8" style={{ color: theme.colors.primaryForeground }} />
                    </div>
                  </div>
                </div>
              </div>

              <ThemedButton
                onClick={spinWheel}
                disabled={spinning || !user || (user.dailySpinsLeft ?? 0) <= 0}
                variant="primary"
                className="w-full max-w-sm mt-6 font-bold py-6 text-lg disabled:opacity-50 rounded-full"
                style={{ cursor: 'pointer' }}
              >
                {spinning ? (
                  <>
                    <div
                      className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin mr-2"
                      style={{ borderColor: theme.colors.primaryForeground }}
                    />
                    Çark Dönüyor...
                  </>
                ) : !user ? (
                  <>
                    <TrendingUp className="w-6 h-6 mr-2" />
                    Giriş Yapın
                  </>
                ) : (user.dailySpinsLeft ?? 0) <= 0 ? (
                  <>
                    <TrendingUp className="w-6 h-6 mr-2" />
                    Hakkınız Bitti
                  </>
                ) : (
                  <>
                    <TrendingUp className="w-6 h-6 mr-2" />
                    Çarkı Çevir
                  </>
                )}
              </ThemedButton>
            </div>
          </div>

          {/* Son Kazananlar - sıralı liste, 2/5 genişlik */}
          <div className="lg:col-span-2">
            <div
              className="rounded-3xl overflow-hidden"
              style={{ background: theme.colors.card, border: `1px solid ${theme.colors.cardBorder}` }}
            >
              <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: `1px solid ${theme.colors.cardBorder}` }}>
                <Trophy className="w-4 h-4" style={{ color: theme.colors.primary }} />
                <h3 className="font-display text-sm font-bold" style={{ color: theme.colors.text }}>Son Kazananlar</h3>
              </div>

              {recentWinners.length === 0 ? (
                <div className="p-6">
                  <ThemedEmptyState icon={<Trophy className="w-10 h-10" />} title="Henüz kazanan yok" />
                </div>
              ) : (
                <div className="divide-y max-h-[520px] overflow-y-auto" style={{ borderColor: theme.colors.cardBorder }}>
                  {recentWinners.map((winner, i) => (
                    <div key={winner.id} className="flex items-center gap-3 px-4 py-3" style={{ borderColor: theme.colors.cardBorder }}>
                      <span className="text-xs font-data w-4 flex-shrink-0" style={{ color: theme.colors.textMuted }}>
                        {i + 1}
                      </span>
                      <Avatar className="w-8 h-8 flex-shrink-0" style={{ boxShadow: `0 0 0 2px ${theme.colors.background}, 0 0 0 3px ${theme.colors.primary}55` }}>
                        {winner.user.avatar ? (
                          <AvatarImage src={winner.user.avatar} alt="Avatar" />
                        ) : (
                          <AvatarFallback
                            className="font-bold text-xs"
                            style={{
                              background: `linear-gradient(135deg, ${theme.colors.gradientFrom}, ${theme.colors.gradientTo})`,
                              color: theme.colors.primaryForeground
                            }}
                          >
                            {winner.user.siteUsername?.[0] || '?'}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-xs truncate" style={{ color: theme.colors.text }}>
                          {winner.user.siteUsername || 'Kullanıcı'}
                        </p>
                        <p className="text-[11px] truncate" style={{ color: theme.colors.textMuted }}>{winner.prize.name}</p>
                      </div>
                      <span className="text-sm font-bold font-data flex-shrink-0" style={{ color: theme.colors.primary }}>
                        +{winner.pointsWon}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function WheelPage() {
  return (
      <WheelContent />
  )
}
