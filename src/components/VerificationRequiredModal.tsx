'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { CheckCircle2, XCircle, ExternalLink, Mail, MessageCircle, Loader2, AlertTriangle } from 'lucide-react'
import { useUserTheme } from '@/components/providers/user-theme-provider'
import { ThemedButton } from '@/components/ui/themed'
import TelegramConnectionModal from './TelegramConnectionModal'
import { useAuth } from '@/components/providers/auth-provider'

interface VerificationRequiredModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  actionName?: string // Hangi işlem için gerekli (örn: "ürün satın almak", "etkinliğe katılmak")
}

export default function VerificationRequiredModal({
  isOpen,
  onClose,
  onSuccess,
  actionName = "bu işlemi gerçekleştirmek"
}: VerificationRequiredModalProps) {
  const { theme } = useUserTheme()
  const { user, refreshUser } = useAuth()
  const [showTelegramModal, setShowTelegramModal] = useState(false)
  const [sendingVerification, setSendingVerification] = useState(false)
  const [verificationSent, setVerificationSent] = useState(false)
  const [verificationCode, setVerificationCode] = useState('')
  const [verifyingCode, setVerifyingCode] = useState(false)

  const telegramConnected = !!user?.telegramId
  const emailVerified = !!user?.emailVerified

  // Her iki doğrulama da tamamlandıysa modal'ı kapat
  useEffect(() => {
    if (isOpen && telegramConnected && emailVerified) {
      toast.success('Tüm doğrulamalar tamamlandı!')
      onClose()
      onSuccess?.()
    }
  }, [isOpen, telegramConnected, emailVerified, onClose, onSuccess])

  // Modal kapandığında state'leri sıfırla
  useEffect(() => {
    if (!isOpen) {
      setVerificationSent(false)
      setVerificationCode('')
    }
  }, [isOpen])

  async function sendVerificationEmail() {
    if (sendingVerification) return

    setSendingVerification(true)
    try {
      const res = await fetch('/api/user/send-verification-email', {
        method: 'POST',
        credentials: 'include'
      })

      const data = await res.json()

      if (res.ok) {
        setVerificationSent(true)
        toast.success('Doğrulama kodu e-postanıza gönderildi! Lütfen e-postanızı kontrol edin.')
      } else {
        toast.error(data.error || 'E-posta gönderilemedi')
      }
    } catch (error) {
      toast.error('Bir hata oluştu')
    } finally {
      setSendingVerification(false)
    }
  }

  async function verifyEmailCode() {
    if (verifyingCode || !verificationCode.trim()) return

    if (verificationCode.length !== 6) {
      toast.error('Lütfen 6 haneli doğrulama kodunu girin')
      return
    }

    setVerifyingCode(true)
    try {
      const res = await fetch('/api/user/verify-email', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: verificationCode })
      })

      const data = await res.json()

      if (res.ok) {
        toast.success('E-posta adresiniz başarıyla doğrulandı!')
        setVerificationCode('')
        setVerificationSent(false)
        refreshUser()
      } else {
        toast.error(data.error || 'Doğrulama başarısız')
      }
    } catch (error) {
      toast.error('Bir hata oluştu')
    } finally {
      setVerifyingCode(false)
    }
  }

  function handleTelegramSuccess() {
    setShowTelegramModal(false)
    refreshUser()
  }

  const allVerified = telegramConnected && emailVerified
  const needsTelegram = !telegramConnected
  const needsEmail = !emailVerified

  return (
    <>
      <Dialog open={isOpen && !showTelegramModal} onOpenChange={onClose}>
        <DialogContent
          className="sm:max-w-lg max-h-[90vh] overflow-y-auto"
          style={{
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.cardBorder,
            color: theme.colors.text
          }}
        >
          <DialogHeader>
            <DialogTitle
              className="text-xl font-bold text-center flex items-center justify-center gap-2"
              style={{ color: theme.colors.text }}
            >
              <AlertTriangle className="w-6 h-6" style={{ color: theme.colors.warning }} />
              Doğrulama Gerekli
            </DialogTitle>
            <DialogDescription style={{ color: theme.colors.textMuted }} className="text-center">
              {actionName} için aşağıdaki doğrulamaları tamamlamanız gerekmektedir.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Telegram Doğrulama */}
            <Card
              className="p-4"
              style={{
                background: telegramConnected
                  ? `linear-gradient(to bottom right, ${theme.colors.success}10, ${theme.colors.success}05)`
                  : `linear-gradient(to bottom right, ${theme.colors.error}10, ${theme.colors.error}05)`,
                borderColor: telegramConnected ? `${theme.colors.success}40` : `${theme.colors.error}40`
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{
                      backgroundColor: telegramConnected
                        ? `${theme.colors.success}20`
                        : `${theme.colors.error}20`
                    }}
                  >
                    <MessageCircle
                      className="w-5 h-5"
                      style={{ color: telegramConnected ? theme.colors.success : theme.colors.error }}
                    />
                  </div>
                  <div>
                    <h4 className="font-semibold" style={{ color: theme.colors.text }}>
                      Telegram Bağlantısı
                    </h4>
                    <p className="text-sm" style={{ color: theme.colors.textMuted }}>
                      {telegramConnected ? 'Telegram bağlı' : 'Telegram bağlı değil'}
                    </p>
                  </div>
                </div>
                {telegramConnected ? (
                  <CheckCircle2 className="w-6 h-6" style={{ color: theme.colors.success }} />
                ) : (
                  <ThemedButton
                    onClick={() => setShowTelegramModal(true)}
                    variant="primary"
                    size="sm"
                  >
                    <ExternalLink className="w-4 h-4 mr-1" />
                    Bağla
                  </ThemedButton>
                )}
              </div>
            </Card>

            {/* Email Doğrulama */}
            <Card
              className="p-4"
              style={{
                background: emailVerified
                  ? `linear-gradient(to bottom right, ${theme.colors.success}10, ${theme.colors.success}05)`
                  : `linear-gradient(to bottom right, ${theme.colors.error}10, ${theme.colors.error}05)`,
                borderColor: emailVerified ? `${theme.colors.success}40` : `${theme.colors.error}40`
              }}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{
                        backgroundColor: emailVerified
                          ? `${theme.colors.success}20`
                          : `${theme.colors.error}20`
                      }}
                    >
                      <Mail
                        className="w-5 h-5"
                        style={{ color: emailVerified ? theme.colors.success : theme.colors.error }}
                      />
                    </div>
                    <div>
                      <h4 className="font-semibold" style={{ color: theme.colors.text }}>
                        E-posta Doğrulaması
                      </h4>
                      <p className="text-sm" style={{ color: theme.colors.textMuted }}>
                        {emailVerified ? 'E-posta doğrulandı' : 'E-posta doğrulanmadı'}
                      </p>
                    </div>
                  </div>
                  {emailVerified ? (
                    <CheckCircle2 className="w-6 h-6" style={{ color: theme.colors.success }} />
                  ) : !verificationSent ? (
                    <ThemedButton
                      onClick={sendVerificationEmail}
                      variant="primary"
                      size="sm"
                      disabled={sendingVerification}
                    >
                      {sendingVerification ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          Gönderiliyor
                        </>
                      ) : (
                        <>
                          <Mail className="w-4 h-4 mr-1" />
                          Kod Gönder
                        </>
                      )}
                    </ThemedButton>
                  ) : null}
                </div>

                {/* Kod Giriş Alanı - Email gönderildiyse göster */}
                {!emailVerified && verificationSent && (
                  <div
                    className="pt-3 space-y-3"
                    style={{ borderTop: `1px solid ${theme.colors.border}40` }}
                  >
                    <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                      E-postanıza gönderilen 6 haneli kodu girin:
                    </p>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="000000"
                        className="text-center text-lg font-mono tracking-widest"
                        style={{
                          background: theme.colors.backgroundSecondary,
                          borderColor: theme.colors.border,
                          color: theme.colors.text
                        }}
                        disabled={verifyingCode}
                      />
                      <ThemedButton
                        onClick={verifyEmailCode}
                        variant="primary"
                        size="md"
                        disabled={verifyingCode || verificationCode.length !== 6}
                      >
                        {verifyingCode ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                      </ThemedButton>
                    </div>
                    <div className="flex items-center justify-between">
                      <button
                        onClick={sendVerificationEmail}
                        disabled={sendingVerification}
                        className="text-xs underline hover:opacity-80 transition-opacity"
                        style={{ color: theme.colors.primary }}
                      >
                        {sendingVerification ? 'Gönderiliyor...' : 'Tekrar gönder'}
                      </button>
                      <span className="text-xs" style={{ color: theme.colors.textMuted }}>
                        Kod 10 dakika geçerlidir
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Bilgi notu */}
            <div
              className="p-3 rounded-lg text-sm text-center"
              style={{
                backgroundColor: `${theme.colors.primary}10`,
                color: theme.colors.textSecondary
              }}
            >
              {needsTelegram && needsEmail ? (
                'Hem Telegram bağlantısını hem de e-posta doğrulamasını tamamlayın.'
              ) : needsTelegram ? (
                'Telegram hesabınızı bağlayarak devam edebilirsiniz.'
              ) : needsEmail ? (
                'E-posta adresinizi doğrulayarak devam edebilirsiniz.'
              ) : (
                'Tüm doğrulamalar tamamlandı!'
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <ThemedButton
              onClick={onClose}
              variant="secondary"
              size="md"
            >
              Kapat
            </ThemedButton>
          </div>
        </DialogContent>
      </Dialog>

      {/* Telegram Modal */}
      <TelegramConnectionModal
        isOpen={showTelegramModal}
        onClose={() => setShowTelegramModal(false)}
        onSuccess={handleTelegramSuccess}
      />
    </>
  )
}
