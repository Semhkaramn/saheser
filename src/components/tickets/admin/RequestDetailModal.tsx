'use client'

import { Button } from '@/components/ui/button'
import { X, User, Building2, Calendar, Banknote, Hash, MessageSquare, Ticket } from 'lucide-react'

interface Sponsor {
  id: string
  name: string
  category: string
}

interface TicketRequest {
  id: string
  userId: string
  sponsorInfo: string
  investmentAmount: number
  investmentDate: string
  note?: string
  status: string
  createdAt: string
  event: {
    title: string
    sponsor: Sponsor
    ticketPrice: number
  }
  user?: {
    siteUsername: string
    email: string
  }
  ticketNumbers: any[]
}

interface RequestDetailModalProps {
  request: TicketRequest
  onClose: () => void
  formatAmount: (amount: number) => string
  formatDateTR: (date: string | Date) => string
}

export function RequestDetailModal({
  request,
  onClose,
  formatAmount,
  formatDateTR
}: RequestDetailModalProps) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3">
      <div className="w-full max-w-md max-h-[80vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-lg shadow-xl">
        <div className="p-3 space-y-3">
          {/* Header */}
          <div className="flex justify-between items-center pb-2 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-medium text-white">Talep Detayı</h3>
              <p className="text-[10px] text-slate-500">{request.event.title}</p>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* User */}
          <div className="flex items-center gap-2 p-2 rounded bg-slate-800/50 border border-slate-700/50">
            <User className="w-3.5 h-3.5 text-slate-500" />
            <div className="flex-1">
              <div className="text-[9px] text-slate-600 uppercase">Kullanıcı</div>
              <div className="text-xs text-white font-medium">{request.user?.siteUsername || request.user?.email}</div>
            </div>
          </div>

          {/* Sponsor Info */}
          <div className="flex items-center gap-2 p-2 rounded bg-cyan-500/5 border border-cyan-500/20">
            <Building2 className="w-3.5 h-3.5 text-cyan-400" />
            <div className="flex-1">
              <div className="text-[9px] text-cyan-400/60 uppercase">Sponsor ({request.event.sponsor.name})</div>
              <div className="text-xs text-cyan-400 font-medium">{request.sponsorInfo}</div>
            </div>
          </div>

          {/* Amount & Date Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2 p-2 rounded bg-emerald-500/5 border border-emerald-500/20">
              <Banknote className="w-3.5 h-3.5 text-emerald-400" />
              <div>
                <div className="text-[9px] text-emerald-400/60 uppercase">Tutar</div>
                <div className="text-xs text-emerald-400 font-bold">{formatAmount(request.investmentAmount)} TL</div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded bg-slate-800/50 border border-slate-700/50">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <div>
                <div className="text-[9px] text-slate-600 uppercase">Yatırım Tarihi</div>
                <div className="text-xs text-white">{formatDateTR(request.investmentDate)}</div>
              </div>
            </div>
          </div>

          {/* Request Date */}
          <div className="flex items-center gap-2 p-2 rounded bg-slate-800/50 border border-slate-700/50">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <div>
              <div className="text-[9px] text-slate-600 uppercase">Talep Tarihi</div>
              <div className="text-xs text-white">{formatDateTR(request.createdAt)}</div>
            </div>
          </div>

          {/* Note */}
          {request.note && (
            <div className="flex items-start gap-2 p-2 rounded bg-slate-800/50 border border-slate-700/50">
              <MessageSquare className="w-3.5 h-3.5 text-slate-500 mt-0.5" />
              <div>
                <div className="text-[9px] text-slate-600 uppercase">Not</div>
                <div className="text-xs text-white whitespace-pre-line">{request.note}</div>
              </div>
            </div>
          )}

          {/* Tickets */}
          {request.ticketNumbers.length > 0 && (
            <div className="p-2 rounded bg-slate-800/50 border border-slate-700/50">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Ticket className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-[10px] text-white font-medium">
                  Biletler ({request.ticketNumbers.length})
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {request.ticketNumbers.map(t => (
                  <span
                    key={t.ticketNumber}
                    className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-mono text-[10px] border border-blue-500/20"
                  >
                    #{t.ticketNumber}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Close Button */}
          <Button
            onClick={onClose}
            className="w-full h-7 text-xs rounded bg-slate-800 hover:bg-slate-700 text-white border border-slate-700"
          >
            Kapat
          </Button>
        </div>
      </div>
    </div>
  )
}
