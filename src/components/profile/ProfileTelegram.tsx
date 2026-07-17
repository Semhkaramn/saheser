'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Link2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import TelegramConnectionModal from '@/components/TelegramConnectionModal'
import { useUserTheme } from '@/components/providers/user-theme-provider'

interface TelegramStatus {
  connected: boolean
  canReconnect: boolean
  daysUntilReconnect?: number
}

interface ProfileTelegramProps {
  telegramUsername?: string
  telegramId?: string
  telegramStatus: TelegramStatus
  onUpdate: () => Promise<void>
}

export default function ProfileTelegram({
  telegramUsername,
  telegramId,
  telegramStatus,
  onUpdate
}: ProfileTelegramProps) {
  const { theme, card, button } = useUserTheme()
  const [showConnectionModal, setShowConnectionModal] = useState(false)

  async function connectTelegram() {
    // ✅ Popup modal'ı aç
    setShowConnectionModal(true)
  }

  // Modal'dan bağlantı tamamlandığında
  async function handleConnectionSuccess() {
    setShowConnectionModal(false)
    await onUpdate() // Verileri yenile
  }

  return (
    <>
      <Card className={`${card('hover')} backdrop-blur-sm`}>
        <div className="p-3 sm:p-4 lg:p-6">
          <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <div
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${theme.colors.primary}10` }}
            >
              <Link2 className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: theme.colors.primary }} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base sm:text-lg font-semibold" style={{ color: theme.colors.text }}>Telegram Bağlantısı</h2>
              <p className="text-xs sm:text-sm hidden sm:block" style={{ color: theme.colors.textMuted }}>Telegram hesabınızla bağlantı durumu</p>
            </div>
            {telegramStatus.connected && (
              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" style={{ color: theme.colors.success }} />
            )}
          </div>

          {telegramStatus.connected ? (
            <>
              <div
                className="rounded-lg p-2.5 sm:p-3 lg:p-4 mb-2 sm:mb-3 border"
                style={{
                  backgroundColor: theme.colors.successBg,
                  borderColor: `${theme.colors.success}30`
                }}
              >
                <div className="space-y-1.5 sm:space-y-2">
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span style={{ color: theme.colors.textMuted }}>Durum:</span>
                    <span className="font-medium" style={{ color: theme.colors.success }}>Bağlı ✓</span>
                  </div>
                  {telegramUsername && (
                    <div className="flex justify-between text-xs sm:text-sm">
                      <span style={{ color: theme.colors.textMuted }}>Kullanıcı:</span>
                      <span className="font-medium" style={{ color: theme.colors.text }}>@{telegramUsername}</span>
                    </div>
                  )}
                  {telegramId && (
                    <div className="flex justify-between text-xs sm:text-sm">
                      <span style={{ color: theme.colors.textMuted }}>ID:</span>
                      <span className="font-mono" style={{ color: theme.colors.text }}>{telegramId}</span>
                    </div>
                  )}
                </div>
              </div>

              <div
                className="rounded-lg p-2.5 flex items-center gap-2 text-xs"
                style={{ background: `${theme.colors.textMuted}10`, color: theme.colors.textMuted }}
              >
                <Link2 className="w-3.5 h-3.5 flex-shrink-0" />
                Bağlantıyı sadece site yöneticileri koparabilir.
              </div>
            </>
          ) : (
            <>
              <div
                className="rounded-lg p-2.5 sm:p-3 lg:p-4 mb-2 sm:mb-3 flex items-start gap-2 sm:gap-3 border"
                style={{
                  backgroundColor: theme.colors.warningBg,
                  borderColor: `${theme.colors.warning}30`
                }}
              >
                <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 mt-0.5" style={{ color: theme.colors.warning }} />
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-medium mb-0.5 sm:mb-1" style={{ color: theme.colors.warning }}>
                    Telegram Bağlı Değil
                  </p>
                  <p className="text-[10px] sm:text-xs" style={{ color: theme.colors.textMuted }}>
                    Telegram hesabınızı bağlayarak tüm özelliklere erişebilirsiniz.
                  </p>
                </div>
              </div>
              <Button
                onClick={connectTelegram}
                size="sm"
                className={`w-full ${button('primary')}`}
              >
                <Link2 className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                Telegram'ı Bağla
              </Button>
            </>
          )}
        </div>
      </Card>

      {/* Disconnect Confirmation Dialog */}
      {/* Telegram Connection Modal */}
      {showConnectionModal && (
        <TelegramConnectionModal
          isOpen={showConnectionModal}
          onClose={() => setShowConnectionModal(false)}
          onSuccess={handleConnectionSuccess}
        />
      )}
    </>
  )
}
