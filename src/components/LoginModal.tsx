'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LogIn, Mail, Lock, Loader2, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/components/providers/auth-provider'
import { useUserTheme } from '@/components/providers/user-theme-provider'
import { ThemedButton } from '@/components/ui/themed'

export default function LoginModal() {
  const router = useRouter()
  const { showLoginModal, setShowLoginModal, setShowRegisterModal, setShowChannelModal, refreshUser, returnUrl, setReturnUrl } = useAuth()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [formData, setFormData] = useState({
    emailOrUsername: '',
    password: ''
  })
  const { theme } = useUserTheme()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.emailOrUsername || !formData.password) {
      toast.error('Lütfen tüm alanları doldurun')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      let data
      try {
        data = await response.json()
      } catch (parseError) {
        console.error('JSON parse error:', parseError)
        toast.error('Sunucu yanıtı alınamadı')
        return
      }

      if (response.ok) {
        toast.success(data.message || 'Giriş başarılı!')
        await refreshUser()
        setShowLoginModal(false)

        // Telegram bağlı mı kontrol et
        if (!data.user?.telegramId) {
          // Telegram bağlı değil, kanal modal'ını aç
          setShowChannelModal(true)
        }

        // Return URL varsa oraya yönlendir
        if (returnUrl) {
          router.push(returnUrl)
          setReturnUrl(null)
        }

        // Form'u temizle
        setFormData({ emailOrUsername: '', password: '' })
      } else {
        // Banlı kullanıcı kontrolü
        if (data.banned || response.status === 403) {
          toast.error(
            <div>
              <div className="font-bold mb-1" style={{ color: theme.colors.error }}>Hesabınız Banlandı!</div>
              <div className="text-sm">{data.banReason || 'Sistem kurallarını ihlal ettiniz.'}</div>
              {data.bannedAt && (
                <div className="text-xs mt-1 opacity-70">
                  Ban Tarihi: {new Date(data.bannedAt).toLocaleString('tr-TR')}
                </div>
              )}
            </div>,
            { duration: 6000 }
          )
        } else {
          toast.error(data.error || 'Giriş başarısız')
        }
      }
    } catch (error) {
      console.error('Login error:', error)
      toast.error('Bir hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  const switchToRegister = () => {
    setShowLoginModal(false)
    setShowRegisterModal(true)
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!resetEmail) {
      toast.error('Lütfen email adresinizi girin')
      return
    }

    setResetLoading(true)

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail })
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Şifre sıfırlama linki email adresinize gönderildi')
        setShowForgotPassword(false)
        setResetEmail('')
      } else {
        toast.error(data.error || 'Bir hata oluştu')
      }
    } catch (error) {
      console.error('Forgot password error:', error)
      toast.error('Bir hata oluştu')
    } finally {
      setResetLoading(false)
    }
  }

  const dialogContentStyle = {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.cardBorder,
    color: theme.colors.text
  }

  const inputStyle = {
    backgroundColor: `${theme.colors.backgroundSecondary}80`,
    borderColor: theme.colors.border,
    color: theme.colors.text
  }

  return (
    <Dialog open={showLoginModal} onOpenChange={setShowLoginModal}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto" style={dialogContentStyle}>
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full" style={{ backgroundColor: `${theme.colors.primary}20` }}>
              <LogIn className="w-8 h-8" style={{ color: theme.colors.primary }} />
            </div>
          </div>
          <DialogTitle className="text-2xl font-bold text-center" style={{ color: theme.colors.text }}>
            {showForgotPassword ? 'Şifremi Unuttum' : 'Giriş Yap'}
          </DialogTitle>
          <DialogDescription className="text-center" style={{ color: theme.colors.textMuted }}>
            {showForgotPassword ? 'Email adresinize şifre sıfırlama linki göndereceğiz' : 'Hesabınıza giriş yapın'}
          </DialogDescription>
        </DialogHeader>

        {showForgotPassword ? (
          <form onSubmit={handleForgotPassword}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="resetEmail" style={{ color: theme.colors.textSecondary }}>
                  Email Adresi
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: theme.colors.textMuted }} />
                  <Input
                    id="resetEmail"
                    name="email"
                    type="email"
                    placeholder="email@example.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="w-full pl-10"
                    style={inputStyle}
                    disabled={resetLoading}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4 mt-4 pt-4" style={{ borderTop: `1px solid ${theme.colors.border}` }}>
              <ThemedButton
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                disabled={resetLoading}
              >
                {resetLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Gönderiliyor...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Sıfırlama Linki Gönder
                  </>
                )}
              </ThemedButton>

              <p className="text-center text-sm" style={{ color: theme.colors.textMuted }}>
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(false)}
                  className="font-medium hover:opacity-80"
                  style={{ color: theme.colors.primary }}
                >
                  Giriş Yap'a Dön
                </button>
              </p>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="emailOrUsername" style={{ color: theme.colors.textSecondary }}>
                  Email veya Kullanıcı Adı
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: theme.colors.textMuted }} />
                  <Input
                    id="emailOrUsername"
                    name="username"
                    type="text"
                    autoComplete="username"
                    placeholder="email@example.com veya kullaniciadi"
                    value={formData.emailOrUsername}
                    onChange={(e) => setFormData({ ...formData, emailOrUsername: e.target.value })}
                    className="w-full pl-10"
                    style={inputStyle}
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" style={{ color: theme.colors.textSecondary }}>
                  Şifre
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: theme.colors.textMuted }} />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full pl-10 pr-10"
                    style={inputStyle}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-80"
                    style={{ color: theme.colors.textMuted }}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-xs font-medium hover:opacity-80"
                    style={{ color: theme.colors.primary }}
                  >
                    Şifremi Unuttum
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4 mt-4 pt-4" style={{ borderTop: `1px solid ${theme.colors.border}` }}>
              <ThemedButton
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Giriş yapılıyor...
                  </>
                ) : (
                  <>
                    <LogIn className="mr-2 h-4 w-4" />
                    Giriş Yap
                  </>
                )}
              </ThemedButton>

              <p className="text-center text-sm" style={{ color: theme.colors.textMuted }}>
                Hesabınız yok mu?{' '}
                <button
                  type="button"
                  onClick={switchToRegister}
                  className="font-medium hover:opacity-80"
                  style={{ color: theme.colors.primary }}
                >
                  Kayıt Ol
                </button>
              </p>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
