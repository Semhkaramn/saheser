'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'
import { CheckCircle2, ExternalLink, Copy } from 'lucide-react'
import { SITE_CONFIG } from '@/lib/site-config'
import { useUserTheme } from '@/components/providers/user-theme-provider'
import { ThemedButton } from '@/components/ui/themed'

interface TelegramConnectionModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export default function TelegramConnectionModal({ isOpen, onClose, onSuccess }: TelegramConnectionModalProps) {
  const { theme } = useUserTheme()
  const [loading, setLoading] = useState(true)
  const [telegramConnected, setTelegramConnected] = useState(false)
  const [botUsername, setBotUsername] = useState('')
  const [connectionToken, setConnectionToken] = useState('')
  const [tokenExpiry, setTokenExpiry] = useState<Date | null>(null)
  const [telegramWindow, setTelegramWindow] = useState<Window | null>(null)

  useEffect(() => {
    if (isOpen) {
      loadTelegramStatus()
      loadBotUsername()
      loadConnectionToken()
    }
  }, [isOpen])

  // Telegram durumu için otomatik polling
  useEffect(() => {
    if (!isOpen || telegramConnected) {
      return
    }

    const interval = setInterval(() => {
      loadTelegramStatus()
    }, 1000)

    return () => clearInterval(interval)
  }, [isOpen, telegramConnected])

  async function loadTelegramStatus() {
    try {
      const response = await fetch('/api/user/telegram-status')
      if (response.ok) {
        const data = await response.json()
        const connected = data.connected || false
        setTelegramConnected(connected)

        // If connected, close modal and refresh user
        if (connected) {
          // ✅ Açılan Telegram penceresini kapat (eğer hala açıksa)
          if (telegramWindow && !telegramWindow.closed) {
            telegramWindow.close()
          }

          toast.success('Telegram başarıyla bağlandı!')
          onClose()
          onSuccess?.()
        }
      }
    } catch (error) {
      console.error('Error loading telegram status:', error)
    }
  }

  async function loadBotUsername() {
    try {
      const botRes = await fetch('/api/settings/telegram-bot-username')

      if (botRes.ok) {
        const botData = await botRes.json()
        const username = botData.username || botData.botUsername || ''
        setBotUsername(username.replace('@', ''))
      }
    } catch (error) {
      console.error('Error loading bot username:', error)
      toast.error('Bot bilgileri yüklenirken hata oluştu')
    }
  }

  async function loadConnectionToken() {
    try {
      const tokenRes = await fetch('/api/user/telegram-connection-token')

      if (tokenRes.ok) {
        const tokenData = await tokenRes.json()
        setConnectionToken(tokenData.token)
        setTokenExpiry(tokenData.expiresAt ? new Date(tokenData.expiresAt) : null)
      } else {
        const errorData = await tokenRes.json()
        if (errorData.connected) {
          setTelegramConnected(true)
        } else {
          toast.error(errorData.error || 'Token alınamadı')
        }
      }
    } catch (error) {
      console.error('Error loading connection token:', error)
      toast.error('Bağlantı kodu alınamadı')
    } finally {
      setLoading(false)
    }
  }

  function copyToken() {
    if (connectionToken) {
      navigator.clipboard.writeText(connectionToken)
      toast.success('Bağlantı kodu kopyalandı!')
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="sm:max-w-2xl max-h-[90vh] overflow-y-auto"
        style={{
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.cardBorder,
          color: theme.colors.text
        }}
      >
        <DialogHeader>
          <DialogTitle
            className="text-2xl font-bold text-center text-transparent bg-clip-text"
            style={{
              backgroundImage: `linear-gradient(to right, ${theme.colors.gradientFrom}, ${theme.colors.gradientVia || theme.colors.primary}, ${theme.colors.gradientTo})`
            }}
          >
            Telegram Bağlantısı
          </DialogTitle>
          <DialogDescription style={{ color: theme.colors.textMuted }} className="text-center">
            Devam etmek için Telegram botunu başlatın
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Telegram Bot Başlatma */}
          {!telegramConnected && connectionToken && (
            <Card
              className="p-6"
              style={{
                background: `linear-gradient(to bottom right, ${theme.colors.primary}20, ${theme.colors.accent}20)`,
                borderColor: `${theme.colors.primary}50`
              }}
            >
              <div className="text-center space-y-4">
                <div
                  className="w-16 h-16 mx-auto rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${theme.colors.primary}30` }}
                >
                  <svg className="w-8 h-8" style={{ color: theme.colors.primary }} viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-lg mb-2" style={{ color: theme.colors.text }}>Telegram Botunu Başlat</h3>
                  <p className="text-sm mb-4" style={{ color: theme.colors.textSecondary }}>
                    Aşağıdaki butona tıklayın ve bota /start komutunu gönderin
                  </p>

                  {/* Bağlantı Kodu */}
                  <div
                    className="rounded-lg p-4 mb-4"
                    style={{ backgroundColor: `${theme.colors.backgroundSecondary}80` }}
                  >
                    <p className="text-xs mb-2" style={{ color: theme.colors.textMuted }}>Bağlantı Kodunuz:</p>
                    <div className="flex items-center justify-center gap-2">
                      <code className="text-2xl font-mono font-bold tracking-wider" style={{ color: theme.colors.text }}>
                        {connectionToken}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={copyToken}
                        className="h-8 w-8 p-0"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                    {tokenExpiry && (
                      <p className="text-xs mt-2" style={{ color: theme.colors.textMuted }}>
                        10 dakika içinde geçerli
                      </p>
                    )}
                  </div>
                </div>
                <ThemedButton
                  onClick={() => {
                    const username = botUsername || SITE_CONFIG.telegramBotUsername
                    // ✅ ÖNEMLİ: t.me alan adı Türkiye'deki bazı operatörlerde
                    // DNS seviyesinde engelleniyor (DNS_PROBE_FINISHED_NXDOMAIN
                    // hatası) - bu bizim kodumuzdaki bir hata değil, ağ/DNS
                    // engeli. "tg://" özel bağlantı şeması ise doğrudan telefonda
                    // kurulu Telegram uygulamasına yönlendiriyor, hiçbir DNS
                    // sorgusu yapmıyor - bu yüzden DNS engeli olsa bile çalışır.
                    window.location.href = `tg://resolve?domain=${username}&start=${connectionToken}`
                    toast.info('Telegram botunda /start komutunu gönderdikten sonra bu sayfa otomatik kapanacak')
                  }}
                  variant="primary"
                  size="lg"
                  disabled={!botUsername || !connectionToken}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  {botUsername && connectionToken ? 'Botu Başlat' : 'Yükleniyor...'}
                </ThemedButton>
                {botUsername && (
                  <>
                    <p className="text-xs" style={{ color: theme.colors.textMuted }}>@{botUsername}</p>
                    <button
                      onClick={() => {
                        const username = botUsername || SITE_CONFIG.telegramBotUsername
                        const newWindow = window.open(`https://t.me/${username}?start=${connectionToken}`, '_blank')
                        setTelegramWindow(newWindow)
                      }}
                      className="text-[11px] underline mt-1"
                      style={{ color: theme.colors.textMuted }}
                    >
                      Açılmadı mı? Web'de dene (t.me)
                    </button>
                    <p className="text-[11px] mt-1 text-center" style={{ color: theme.colors.textMuted }}>
                      Hâlâ olmuyorsa: Telegram uygulamasında <b>@{botUsername}</b> yazıp arayın, sonra <b>/start</b> gönderin.
                    </p>
                  </>
                )}
              </div>
            </Card>
          )}

          {/* Başarılı Bağlantı */}
          {telegramConnected && (
            <Card
              className="p-6 text-center"
              style={{
                backgroundColor: theme.colors.successBg,
                borderColor: `${theme.colors.success}50`
              }}
            >
              <CheckCircle2 className="w-12 h-12 mx-auto mb-3" style={{ color: theme.colors.success }} />
              <p className="font-semibold text-lg" style={{ color: theme.colors.success }}>Telegram başarıyla bağlandı!</p>
              <p className="text-sm mt-2" style={{ color: theme.colors.textMuted }}>Artık sistemi kullanabilirsiniz.</p>
            </Card>
          )}

          {loading && (
            <div className="text-center py-8">
              <div
                className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-3"
                style={{ borderColor: `${theme.colors.primary}40`, borderTopColor: 'transparent' }}
              ></div>
              <p style={{ color: theme.colors.textMuted }}>Yükleniyor...</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
