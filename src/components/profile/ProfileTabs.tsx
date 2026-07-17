'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  History, ShoppingBag, Crown, Star, CheckCircle2, Users,
  Clock, Package, Filter
} from 'lucide-react'
import { useUserTheme } from '@/components/providers/user-theme-provider'

interface PointHistory {
  id: string
  amount: number
  type: string
  description: string
  adminUsername?: string
  createdAt: string
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

interface Rank {
  id: string
  name: string
  icon: string
  color: string
  minXp: number
  order: number
}

interface ProfileTabsProps {
  pointHistory?: PointHistory[]
  purchases: Purchase[]
  allRanks?: Rank[]
  currentRank?: Rank
  nextRank?: Rank
  currentXp: number
}

type HistoryLimit = '5' | '10' | 'all'

export default function ProfileTabs({
  pointHistory = [],
  purchases,
  allRanks = [],
  currentRank,
  nextRank,
  currentXp
}: ProfileTabsProps) {
  const { theme, card, badge, tab } = useUserTheme()
  const [historyLimit, setHistoryLimit] = useState<HistoryLimit>('5')

  // Filter history based on selected limit
  const filteredHistory = historyLimit === 'all'
    ? pointHistory
    : pointHistory.slice(0, Number.parseInt(historyLimit))

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'tamamlandı':
      case 'completed':
        return { bg: theme.colors.successBg, color: theme.colors.success, border: `${theme.colors.success}30` }
      case 'beklemede':
      case 'pending':
        return { bg: theme.colors.warningBg, color: theme.colors.warning, border: `${theme.colors.warning}30` }
      case 'iptal':
      case 'cancelled':
        return { bg: theme.colors.errorBg, color: theme.colors.error, border: `${theme.colors.error}30` }
      default:
        return { bg: `${theme.colors.border}20`, color: theme.colors.textMuted, border: `${theme.colors.border}30` }
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'tamamlandı':
      case 'completed':
        return <CheckCircle2 className="w-3 h-3" />
      case 'beklemede':
      case 'pending':
        return <Clock className="w-3 h-3" />
      case 'iptal':
      case 'cancelled':
        return <Package className="w-3 h-3" />
      default:
        return null
    }
  }

  return (
    <div className="user-card overflow-hidden">
      <Tabs defaultValue="history" className="w-full">
        <div className="p-3" style={{ borderBottom: `1px solid ${theme.colors.cardBorder}` }}>
          <TabsList className="w-full grid grid-cols-3 rounded-full p-1" style={{ background: theme.colors.backgroundSecondary }}>
            <TabsTrigger value="history" className="rounded-full">
              <History className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Puan Geçmişi</span>
              <span className="sm:hidden">Geçmiş</span>
            </TabsTrigger>
            <TabsTrigger value="purchases" className="rounded-full">
              <ShoppingBag className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Alışverişler</span>
              <span className="sm:hidden">Alımlar</span>
            </TabsTrigger>
            <TabsTrigger value="ranks" className="rounded-full">
              <Crown className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Rütbeler</span>
              <span className="sm:hidden">Seviye</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="p-6">
          {/* History Tab */}
          <TabsContent value="history" className="mt-0">
            {!pointHistory || pointHistory.length === 0 ? (
              <div className="text-center py-12">
                <History className="w-16 h-16 mx-auto mb-4" style={{ color: theme.colors.border }} />
                <p style={{ color: theme.colors.textMuted }}>Henüz puan geçmişi yok</p>
              </div>
            ) : (
              <>
                {/* Filter Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-sm" style={{ color: theme.colors.textMuted }}>
                    <Filter className="w-4 h-4" />
                    <span>Toplam {pointHistory.length} kayıt</span>
                  </div>
                  <Select value={historyLimit} onValueChange={(val) => setHistoryLimit(val as HistoryLimit)}>
                    <SelectTrigger
                      className="w-[130px] h-8 text-sm border"
                      style={{
                        backgroundColor: theme.colors.card,
                        borderColor: theme.colors.cardBorder,
                        color: theme.colors.text
                      }}
                    >
                      <SelectValue placeholder="Limit seç" />
                    </SelectTrigger>
                    <SelectContent
                      style={{
                        backgroundColor: theme.colors.backgroundSecondary,
                        borderColor: theme.colors.border
                      }}
                    >
                      <SelectItem value="5" style={{ color: theme.colors.text }}>Son 5</SelectItem>
                      <SelectItem value="10" style={{ color: theme.colors.text }}>Son 10</SelectItem>
                      <SelectItem value="all" style={{ color: theme.colors.text }}>Tümü</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="max-h-[500px] overflow-y-auto pr-2 space-y-3">
              {filteredHistory.map(history => {
                const isPositive = history.amount > 0
                let iconBg = `${theme.colors.border}20`
                let Icon = History
                let iconColor = theme.colors.textMuted

                switch(history.type) {
                  case 'wheel_win':
                    Icon = Star
                    iconBg = `${theme.colors.accent}20`
                    iconColor = theme.colors.accent
                    break
                  case 'shop_purchase':
                    Icon = ShoppingBag
                    iconBg = `${theme.colors.error}20`
                    iconColor = theme.colors.error
                    break
                  case 'task_reward':
                    Icon = CheckCircle2
                    iconBg = `${theme.colors.success}20`
                    iconColor = theme.colors.success
                    break
                  case 'referral_reward':
                    Icon = Users
                    iconBg = `${theme.colors.primary}20`
                    iconColor = theme.colors.primary
                    break
                  case 'randy_win':
                    Icon = Crown
                    iconBg = `${theme.colors.warning}20`
                    iconColor = theme.colors.warning
                    break
                  case 'rank_up':
                    Icon = Crown
                    iconBg = `${theme.colors.primary}20`
                    iconColor = theme.colors.primary
                    break
                  case 'promocode_use':
                    Icon = Star
                    iconBg = `${theme.colors.success}20`
                    iconColor = theme.colors.success
                    break
                  case 'admin_add':
                  case 'admin_points_add':
                    Icon = Crown
                    iconBg = `${theme.colors.success}20`
                    iconColor = theme.colors.success
                    break
                  case 'admin_remove':
                  case 'admin_points_remove':
                    Icon = Crown
                    iconBg = `${theme.colors.error}20`
                    iconColor = theme.colors.error
                    break
                }

                return (
                  <Card
                    key={history.id}
                    className="p-4 rounded-2xl border transition-all duration-200 hover:-translate-y-0.5"
                    style={{
                      backgroundColor: theme.colors.card,
                      borderColor: theme.colors.cardBorder,
                      boxShadow: '0 1px 3px rgba(15,30,61,0.06)'
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: iconBg }}
                      >
                        <Icon className="w-6 h-6" style={{ color: iconColor }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm mb-1" style={{ color: theme.colors.text }}>{history.description}</h3>
                        <p className="text-xs" style={{ color: theme.colors.textMuted }}>
                          {new Date(history.createdAt).toLocaleDateString('tr-TR', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p
                          className="text-2xl font-bold"
                          style={{ color: isPositive ? theme.colors.success : theme.colors.error }}
                        >
                          {isPositive ? '+' : ''}{history.amount}
                        </p>
                      </div>
                    </div>
                  </Card>
                )
              })
              }
              </div>
              </>
            )}
          </TabsContent>

          {/* Purchases Tab */}
          <TabsContent value="purchases" className="mt-0">
            {purchases.length === 0 ? (
              <div className="text-center py-12">
                <ShoppingBag className="w-16 h-16 mx-auto mb-4" style={{ color: theme.colors.border }} />
                <p style={{ color: theme.colors.textMuted }}>Henüz satın alım yapılmamış</p>
              </div>
            ) : (
              <div className="max-h-[500px] overflow-y-auto pr-2 space-y-3">
              {purchases.map(purchase => {
                const statusStyle = getStatusColor(purchase.status)
                return (
                <Card
                  key={purchase.id}
                  className="p-4 rounded-2xl border transition-all duration-200 hover:-translate-y-0.5"
                  style={{
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.cardBorder,
                    boxShadow: '0 1px 3px rgba(15,30,61,0.06)'
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${theme.colors.success}20` }}
                    >
                      <ShoppingBag className="w-6 h-6" style={{ color: theme.colors.success }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm mb-1" style={{ color: theme.colors.text }}>{purchase.item.name}</h3>
                      <div className="flex items-center gap-2 text-xs">
                        <span style={{ color: theme.colors.textMuted }}>
                          {new Date(purchase.purchasedAt).toLocaleDateString('tr-TR')}
                        </span>
                        <span style={{ color: theme.colors.warning }}>• {purchase.pointsSpent.toLocaleString('tr-TR')} puan</span>
                      </div>
                    </div>
                    <Badge
                      className="flex items-center gap-1 flex-shrink-0"
                      style={{
                        backgroundColor: statusStyle.bg,
                        color: statusStyle.color,
                        borderColor: statusStyle.border
                      }}
                    >
                      {getStatusIcon(purchase.status)}
                      <span className="hidden sm:inline">{purchase.status}</span>
                    </Badge>
                  </div>
                </Card>
                )
              })
              }
              </div>
            )}
          </TabsContent>

          {/* Ranks Tab */}
          <TabsContent value="ranks" className="mt-0">
            {!allRanks || allRanks.length === 0 ? (
              <div className="text-center py-12">
                <Crown className="w-16 h-16 mx-auto mb-4" style={{ color: theme.colors.border }} />
                <p style={{ color: theme.colors.textMuted }}>Rütbe bilgisi bulunamadı</p>
              </div>
            ) : (
              <div className="max-h-[500px] overflow-y-auto pr-2 space-y-3">
              {allRanks.map(rank => {
                const isCurrentRank = currentRank?.minXp === rank.minXp
                const isCompleted = currentXp >= rank.minXp
                const isNextRank = nextRank?.minXp === rank.minXp

                return (
                  <Card
                    key={rank.id}
                    className="p-4 rounded-2xl border transition-all duration-200"
                    style={{
                      background: isCurrentRank
                        ? `linear-gradient(to right, ${theme.colors.gradientFrom}15, ${theme.colors.gradientTo}15)`
                        : isCompleted
                        ? theme.colors.successBg
                        : theme.colors.card,
                      borderColor: isCurrentRank
                        ? `${theme.colors.primary}50`
                        : isCompleted
                        ? `${theme.colors.success}30`
                        : theme.colors.cardBorder,
                      boxShadow: isCurrentRank ? `0 4px 20px ${theme.colors.primary}20` : undefined
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-14 h-14 rounded-full flex items-center justify-center text-3xl"
                          style={{ backgroundColor: `${rank.color}30` }}
                        >
                          {rank.icon}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-lg" style={{ color: theme.colors.text }}>{rank.name}</h3>
                            {isCurrentRank && (
                              <Badge style={{ backgroundColor: theme.colors.primary }} className="text-white text-xs">Mevcut</Badge>
                            )}
                            {isNextRank && (
                              <Badge style={{ backgroundColor: theme.colors.warning }} className="text-white text-xs">Sonraki</Badge>
                            )}
                          </div>
                          <p className="text-sm" style={{ color: theme.colors.textMuted }}>{rank.minXp.toLocaleString()} XP gerekli</p>
                        </div>
                      </div>

                      {isCompleted ? (
                        <CheckCircle2 className="w-6 h-6" style={{ color: theme.colors.success }} />
                      ) : (
                        <div className="text-right">
                          <p className="text-sm" style={{ color: theme.colors.textMuted }}>
                            {(rank.minXp - currentXp).toLocaleString()} XP kaldı
                          </p>
                        </div>
                      )}
                    </div>
                  </Card>
                )
              })
              }
              </div>
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
