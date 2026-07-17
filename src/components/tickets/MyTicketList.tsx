'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Trophy, Award } from 'lucide-react'
import { useUserTheme } from '@/components/providers/user-theme-provider'

interface UserTicketGroup {
  event: {
    id: string
    title: string
    status: string
  }
  tickets: Array<{
    ticketNumber: number
    prizeWins: Array<{
      prize: {
        prizeAmount: number
      }
    }>
  }>
  totalTickets: number
  wonPrizes: Array<{
    ticketNumber: number
    prize: {
      prizeAmount: number
    }
  }>
}

interface MyTicketListProps {
  tickets: UserTicketGroup[]
  formatAmount: (amount: number) => string
}

export function MyTicketList({ tickets, formatAmount }: MyTicketListProps) {
  const { theme } = useUserTheme()

  if (tickets.length === 0) {
    return null
  }

  return (
    <div className="space-y-3">
      {tickets.map(group => (
        <Card
          key={group.event.id}
          className="p-3 transition-all duration-300 rounded-lg"
          style={{
            background: group.wonPrizes.length > 0
              ? `linear-gradient(to bottom right, ${theme.colors.warning}10, ${theme.colors.card}30, ${theme.colors.warning}10)`
              : `${theme.colors.card}30`,
            borderColor: group.wonPrizes.length > 0
              ? `${theme.colors.warning}50`
              : theme.colors.cardBorder,
            boxShadow: group.wonPrizes.length > 0
              ? `0 10px 15px -3px ${theme.colors.warning}10`
              : 'none'
          }}
        >
          <div className="space-y-3">
            <div>
              <h3 className="text-base font-bold mb-1" style={{ color: theme.colors.text }}>{group.event.title}</h3>
              <div className="flex flex-wrap gap-1">
                <Badge
                  className="px-2 py-1 rounded-lg text-xs"
                  style={{
                    backgroundColor: `${theme.colors.primary}10`,
                    color: theme.colors.primary,
                    borderColor: `${theme.colors.primary}50`,
                    borderWidth: 1
                  }}
                >
                  {group.totalTickets} Bilet
                </Badge>
                {group.event.status === 'completed' ? (
                  <Badge
                    className="px-2 py-1 rounded-lg text-xs"
                    style={{
                      backgroundColor: `${theme.colors.textMuted}10`,
                      color: theme.colors.textMuted,
                      borderColor: `${theme.colors.textMuted}50`,
                      borderWidth: 1
                    }}
                  >
                    Tamamlandı
                  </Badge>
                ) : group.event.status === 'waiting_draw' ? (
                  <Badge
                    className="px-2 py-1 rounded-lg flex items-center gap-1 text-xs"
                    style={{
                      backgroundColor: `${theme.colors.warning}10`,
                      color: theme.colors.warning,
                      borderColor: `${theme.colors.warning}50`,
                      borderWidth: 1
                    }}
                  >
                    <Award className="w-3 h-3" />
                    Çekiliş Bekliyor
                  </Badge>
                ) : (
                  <Badge
                    className="px-2 py-1 rounded-lg text-xs"
                    style={{
                      backgroundColor: `${theme.colors.success}10`,
                      color: theme.colors.success,
                      borderColor: `${theme.colors.success}50`,
                      borderWidth: 1
                    }}
                  >
                    Aktif
                  </Badge>
                )}
                {group.wonPrizes.length > 0 && (
                  <Badge
                    className="px-3 py-1 rounded-lg flex items-center gap-1 text-xs text-white"
                    style={{
                      background: `linear-gradient(to right, ${theme.colors.warning}, ${theme.colors.warning}CC)`,
                      borderColor: theme.colors.warning,
                      boxShadow: `0 10px 15px -3px ${theme.colors.warning}30`
                    }}
                  >
                    <Trophy className="w-3 h-3" />
                    KAZANDINIZ!
                  </Badge>
                )}
              </div>
            </div>

            {/* Win Prizes Section */}
            {group.wonPrizes.length > 0 && (
              <div
                className="p-3 rounded-lg"
                style={{
                  background: `linear-gradient(to right, ${theme.colors.warning}20, ${theme.colors.warning}15)`,
                  borderColor: `${theme.colors.warning}80`,
                  borderWidth: 2
                }}
              >
                <h4
                  className="font-bold flex items-center gap-1.5 mb-2 text-base"
                  style={{ color: theme.colors.warning }}
                >
                  <Trophy className="w-4 h-4" />
                  TEBRİKLER! KAZANDINIZ!
                </h4>
                <div className="space-y-2">
                  {group.wonPrizes.map((win, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-lg backdrop-blur-sm"
                      style={{ backgroundColor: `${theme.colors.text}10` }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <span className="font-bold text-base" style={{ color: theme.colors.text }}>Bilet #{win.ticketNumber}</span>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-base" style={{ color: theme.colors.warning }}>
                            {formatAmount(win.prize.prizeAmount)} TL
                          </div>
                          <div className="text-xs" style={{ color: theme.colors.textSecondary }}>Kazanılan Ödül</div>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div
                    className="p-2 rounded-lg"
                    style={{
                      backgroundColor: `${theme.colors.success}20`,
                      borderColor: `${theme.colors.success}60`,
                      borderWidth: 1
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-base" style={{ color: theme.colors.text }}>Toplam Kazancınız:</span>
                      <span className="font-bold text-lg" style={{ color: theme.colors.success }}>
                        {formatAmount(group.wonPrizes.reduce((sum, win) => sum + win.prize.prizeAmount, 0))} TL
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Ticket Numbers */}
            <div>
              <Label className="font-semibold mb-2 block text-xs" style={{ color: theme.colors.text }}>Bilet Numaralarınız</Label>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1">
                {group.tickets.map(ticket => {
                  const hasWon = ticket.prizeWins.length > 0
                  return (
                    <div
                      key={ticket.ticketNumber}
                      className="p-1.5 rounded-lg font-bold text-center transition-all duration-200 text-xs"
                      style={{
                        background: hasWon
                          ? `linear-gradient(to bottom right, ${theme.colors.warning}, ${theme.colors.warning}CC)`
                          : `${theme.colors.backgroundSecondary}80`,
                        color: hasWon ? '#fff' : theme.colors.textSecondary,
                        borderColor: hasWon ? `${theme.colors.warning}80` : theme.colors.border,
                        borderWidth: hasWon ? 2 : 1,
                        boxShadow: hasWon ? `0 20px 25px -5px ${theme.colors.warning}50` : 'none',
                        animation: hasWon ? 'pulse 2s infinite' : 'none'
                      }}
                    >
                      <div
                        className="text-xs mb-0.5"
                        style={{ color: hasWon ? `${theme.colors.warning}40` : theme.colors.textMuted }}
                      >
                        #
                      </div>
                      <div className="text-sm font-bold">{ticket.ticketNumber}</div>
                      {hasWon && (
                        <div className="mt-1">
                          <Trophy className="w-3 h-3 inline" style={{ color: `${theme.colors.warning}40` }} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
