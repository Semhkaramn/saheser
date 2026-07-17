'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Trophy, X, Check, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface Prize {
  id?: string
  prizeAmount: number
  winnerCount: number
}

interface TicketNumber {
  id: string
  ticketNumber: number
  username: string
  sponsorInfo: string
}

interface WinnerSelectorProps {
  event: {
    id: string
    title: string
  }
  prize: Prize
  ticketNumbers: TicketNumber[]
  selectedWinners: number[]
  allSelectedWinners: { [prizeId: string]: number[] }
  onToggleWinner: (ticketNumber: number) => void
  onClearSelection: () => void
  onClose: () => void
  formatAmount: (amount: number) => string
}

export function WinnerSelector({
  event,
  prize,
  ticketNumbers,
  selectedWinners,
  allSelectedWinners,
  onToggleWinner,
  onClearSelection,
  onClose,
  formatAmount
}: WinnerSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const isComplete = selectedWinners.length === prize.winnerCount

  // Filter out tickets selected in other prizes
  const availableTickets = ticketNumbers.filter(ticket => {
    const isSelectedInOtherPrizes = Object.entries(allSelectedWinners)
      .filter(([pid]) => pid !== (prize.id || ''))
      .some(([, tickets]) => tickets.includes(ticket.ticketNumber))

    if (isSelectedInOtherPrizes) return false

    if (searchTerm.trim() === '') return true

    return ticket.ticketNumber.toString().includes(searchTerm.replace('#', '').trim()) ||
           ticket.username?.toLowerCase().includes(searchTerm.toLowerCase())
  })

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <Card className="w-full md:max-w-2xl max-h-[90vh] md:max-h-[85vh] overflow-hidden border border-slate-700/50 bg-slate-900 backdrop-blur-xl shadow-2xl rounded-t-2xl md:rounded-2xl flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 p-4 md:p-5 border-b border-slate-700/50">
          <div className="flex justify-between items-start gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-1">
                <Trophy className="w-5 h-5 text-amber-400 flex-shrink-0" />
                <span className="truncate">{formatAmount(prize.prizeAmount)} TL Ödülü</span>
              </h3>
              <p className="text-slate-400 text-sm">
                {event.title} - {prize.winnerCount} kazanan seçilecek
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-10 w-10 p-0 hover:bg-slate-800 rounded-lg flex-shrink-0"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {ticketNumbers.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <Trophy className="w-12 h-12 text-slate-700 mb-4" />
            <p className="text-slate-400 text-base">Hiç bilet satılmamış.</p>
            <p className="text-slate-500 text-sm mt-1">Kazanan seçilemez.</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Selection Progress */}
            <div className="flex-shrink-0 p-4 md:p-5 border-b border-slate-700/30">
              <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/20">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-white">Seçim Durumu</span>
                  <Badge className={`text-sm px-3 py-1 ${
                    isComplete
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                  }`}>
                    {selectedWinners.length} / {prize.winnerCount}
                  </Badge>
                </div>
                <Progress
                  value={(selectedWinners.length / prize.winnerCount) * 100}
                  className="h-2.5"
                />
              </div>

              {/* Search */}
              <div className="mt-4">
                <Label className="text-white text-sm font-medium mb-2 block">
                  Bilet Arama
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Bilet no veya kullanıcı ara..."
                    className="pl-10 h-11 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* Ticket List */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <ScrollArea className="h-full max-h-[300px] md:max-h-[350px]">
                <div className="p-4 md:p-5 space-y-2">
                  {availableTickets.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-sm">
                      {searchTerm === '' ? 'Tüm biletler başka ödüllerde seçilmiş' : 'Sonuç bulunamadı'}
                    </div>
                  ) : (
                    availableTickets.map(ticket => {
                      const isSelected = selectedWinners.includes(ticket.ticketNumber)

                      return (
                        <button
                          key={ticket.id}
                          onClick={() => onToggleWinner(ticket.ticketNumber)}
                          className={`w-full p-4 flex items-center gap-4 transition-all text-left rounded-xl border ${
                            isSelected
                              ? 'bg-emerald-500/15 hover:bg-emerald-500/20 border-emerald-500/30'
                              : 'bg-slate-800/50 hover:bg-slate-800 border-slate-700/50'
                          }`}
                        >
                          <div className={`flex-shrink-0 w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'bg-emerald-500 border-emerald-500'
                              : 'border-slate-500 bg-transparent'
                          }`}>
                            {isSelected && <Check className="w-4 h-4 text-white" />}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3">
                              <span className={`font-bold text-base ${isSelected ? 'text-emerald-400' : 'text-white'}`}>
                                #{ticket.ticketNumber}
                              </span>
                              <span className="text-slate-400 text-sm truncate">
                                {ticket.username || 'Bilinmeyen'}
                              </span>
                            </div>
                            {ticket.sponsorInfo && (
                              <div className="text-xs text-slate-500 truncate mt-1">
                                {ticket.sponsorInfo}
                              </div>
                            )}
                          </div>

                          {isSelected && (
                            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs flex-shrink-0 px-2.5 py-1">
                              Seçildi
                            </Badge>
                          )}
                        </button>
                      )
                    })
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Action Buttons */}
            <div className="flex-shrink-0 p-4 md:p-5 border-t border-slate-700/50 bg-slate-900/50">
              <div className="flex flex-col md:flex-row gap-3">
                <Button
                  onClick={onClose}
                  className={`flex-1 h-12 rounded-xl text-sm font-medium ${
                    isComplete
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-slate-700 hover:bg-slate-600 text-white'
                  }`}
                >
                  <Check className="w-5 h-5 mr-2" />
                  {isComplete ? 'Seçim Tamamlandı' : 'Tamam'}
                </Button>
                <Button
                  variant="outline"
                  onClick={onClearSelection}
                  disabled={selectedWinners.length === 0}
                  className="h-12 px-5 rounded-xl bg-slate-800/50 hover:bg-slate-800 text-slate-300 border-slate-700 disabled:opacity-40"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Temizle
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
