'use client'

import { useState } from 'react'
import { User, Banknote, Hash, Check, X, Eye } from 'lucide-react'

// Mavi tema renkleri
const theme = {
  primary: '#3b82f6',
  primaryLight: '#60a5fa',
  primaryDark: '#2563eb',
  gradientFrom: '#3b82f6',
  gradientTo: '#1d4ed8',
  success: '#22c55e',
  successDark: '#16a34a',
  danger: '#ef4444',
  dangerDark: '#dc2626',
  card: 'rgba(15, 23, 42, 0.8)',
  border: 'rgba(71, 85, 105, 0.5)',
  text: '#f1f5f9',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  background: '#0f172a',
  backgroundSecondary: '#1e293b',
}

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

interface RequestsTableProps {
  requests: TicketRequest[]
  onApprove: (requestId: string) => void
  onReject: (requestId: string) => void
  onViewDetails: (request: TicketRequest) => void
  formatAmount: (amount: number) => string
  formatDateTR: (date: string | Date) => string
}

function ActionButton({
  type,
  onClick,
  children
}: {
  type: 'approve' | 'reject' | 'view'
  onClick: () => void
  children: React.ReactNode
}) {
  const [isHovered, setIsHovered] = useState(false)

  const getStyles = () => {
    switch (type) {
      case 'approve':
        return {
          background: isHovered ? `${theme.successDark}25` : `${theme.success}10`,
          color: theme.success,
          border: `1px solid ${theme.success}30`
        }
      case 'reject':
        return {
          background: isHovered ? `${theme.dangerDark}25` : `${theme.danger}10`,
          color: theme.danger,
          border: `1px solid ${theme.danger}30`
        }
      case 'view':
        return {
          background: isHovered ? theme.backgroundSecondary : `${theme.backgroundSecondary}80`,
          color: isHovered ? theme.text : theme.textSecondary,
          border: `1px solid ${theme.border}`
        }
    }
  }

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="w-7 h-7 rounded-md flex items-center justify-center transition-colors duration-200"
      style={getStyles()}
    >
      {children}
    </button>
  )
}

export function RequestsTable({
  requests,
  onApprove,
  onReject,
  onViewDetails,
  formatAmount,
  formatDateTR
}: RequestsTableProps) {
  return (
    <div className="space-y-1">
      {requests.map((request) => (
        <div
          key={request.id}
          onClick={() => onViewDetails(request)}
          className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors duration-200"
          style={{
            background: theme.card,
            border: `1px solid ${theme.border}`
          }}
        >
          {/* User */}
          <div className="flex items-center gap-1.5 min-w-0 w-32">
            <User className="w-3 h-3 flex-shrink-0" style={{ color: theme.textMuted }} />
            <span className="text-xs font-medium truncate" style={{ color: theme.text }}>
              {request.user?.siteUsername || request.user?.email?.split('@')[0] || '-'}
            </span>
          </div>

          {/* Sponsor Info */}
          <div className="flex-1 min-w-0">
            <span
              className="text-[10px] truncate block"
              style={{ color: theme.primaryLight }}
            >
              {request.sponsorInfo}
            </span>
          </div>

          {/* Amount */}
          <div
            className="flex items-center gap-1 px-2 py-1 rounded flex-shrink-0"
            style={{
              background: `${theme.primary}10`,
              border: `1px solid ${theme.primary}20`
            }}
          >
            <Banknote className="w-3 h-3" style={{ color: theme.primaryLight }} />
            <span className="font-bold text-xs" style={{ color: theme.primaryLight }}>{formatAmount(request.investmentAmount)}</span>
          </div>

          {/* Tickets */}
          {request.ticketNumbers.length > 0 && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <Hash className="w-3 h-3" style={{ color: theme.textMuted }} />
              <span
                className="text-[10px] font-mono"
                style={{ color: theme.textSecondary }}
              >
                {request.ticketNumbers.length}
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            {request.status === 'pending' && (
              <>
                <ActionButton type="approve" onClick={() => onApprove(request.id)}>
                  <Check className="w-3.5 h-3.5" />
                </ActionButton>
                <ActionButton type="reject" onClick={() => onReject(request.id)}>
                  <X className="w-3.5 h-3.5" />
                </ActionButton>
              </>
            )}
            {request.status === 'approved' && (
              <span
                className="px-2 py-1 text-[10px] rounded font-medium"
                style={{
                  background: `${theme.success}10`,
                  color: theme.success,
                  border: `1px solid ${theme.success}20`
                }}
              >
                Onaylandı
              </span>
            )}
            {request.status === 'rejected' && (
              <span
                className="px-2 py-1 text-[10px] rounded font-medium"
                style={{
                  background: `${theme.danger}10`,
                  color: theme.danger,
                  border: `1px solid ${theme.danger}20`
                }}
              >
                Reddedildi
              </span>
            )}
            <ActionButton type="view" onClick={() => onViewDetails(request)}>
              <Eye className="w-3.5 h-3.5" />
            </ActionButton>
          </div>
        </div>
      ))}
    </div>
  )
}
