'use client'

import { useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { MessageSquare, Mail, Key, CheckCircle2, LogOut, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/components/providers/auth-provider'
import { useUserTheme } from '@/components/providers/user-theme-provider'
import { useRouter } from 'next/navigation'

interface Rank {
  id: string
  name: string
  icon: string
  color: string
  minXp: number
  order: number
}

interface UserData {
  id: string
  siteUsername?: string
  firstName?: string
  email?: string
  emailVerified?: boolean
  points: number
  xp: number
  totalMessages?: number
  totalReferrals?: number
  rank?: Rank
  nextRank?: Rank
  leaderboardRank?: number
  createdAt: string
  avatar?: string
  messageStats?: {
    total: number
    daily?: number
    weekly?: number
    monthly?: number
  }
}

interface ProfileHeaderProps {
  userData: UserData
  onUpdate: () => Promise<void>
}

// Available avatars
const AVATARS = Array.from({ length: 10 }, (_, i) => `/avatar/${i + 1}.svg`)

export default function ProfileHeader({ userData, onUpdate }: ProfileHeaderProps) {
  const router = useRouter()
  const { logout } = useAuth()
  const { theme, card, button, badge } = useUserTheme()
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [showAvatarDialog, setShowAvatarDialog] = useState(false)
  const [changingAvatar, setChangingAvatar] = useState(false)

  const [showEmailVerification, setShowEmailVerification] = useState(false)
  const [verificationCode, setVerificationCode] = useState('')
  const [sendingCode, setSendingCode] = useState(false)
  const [verifying, setVerifying] = useState(false)

  async function handleLogout() {
    await logout()
    toast.success('Çıkış yapıldı')
    router.push('/')
  }

  async function changePassword() {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Tüm alanları doldurun')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Yeni şifreler eşleşmiyor')
      return
    }
    if (newPassword.length < 6) {
      toast.error('Yeni şifre en az 6 karakter olmalıdır')
      return
    }

    setChangingPassword(true)
    try {
      const response = await fetch('/api/user/change-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      })
      const data = await response.json()
      if (response.ok) {
        toast.success('Şifre başarıyla değiştirildi')
        setShowPasswordDialog(false)
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        toast.error(data.error || 'Şifre değiştirilemedi')
      }
    } catch (error) {
      toast.error('Bir hata oluştu')
    } finally {
      setChangingPassword(false)
    }
  }

  async function sendVerificationCode() {
    setSendingCode(true)
    try {
      const response = await fetch('/api/user/send-verification-email', {
        method: 'POST',
        credentials: 'include'
      })
      const data = await response.json()
      if (response.ok) {
        toast.success(data.message)
        setShowEmailVerification(true)
      } else {
        toast.error(data.error || 'Kod gönderilemedi')
      }
    } catch (error) {
      toast.error('Bir hata oluştu')
    } finally {
      setSendingCode(false)
    }
  }

  async function verifyEmail() {
    if (!verificationCode || verificationCode.length !== 6) {
      toast.error('Geçerli bir 6 haneli kod girin')
      return
    }
    setVerifying(true)
    try {
      const response = await fetch('/api/user/verify-email', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: verificationCode })
      })
      const data = await response.json()
      if (response.ok) {
        toast.success('Email başarıyla doğrulandı!')
        setShowEmailVerification(false)
        setVerificationCode('')
        await onUpdate()
      } else {
        toast.error(data.error || 'Doğrulama başarısız')
      }
    } catch (error) {
      toast.error('Bir hata oluştu')
    } finally {
      setVerifying(false)
    }
  }

  async function changeAvatar(avatarPath: string) {
    setChangingAvatar(true)
    try {
      const response = await fetch('/api/user/avatar', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar: avatarPath })
      })
      const data = await response.json()
      if (response.ok) {
        toast.success('Avatar başarıyla değiştirildi')
        setShowAvatarDialog(false)
        await onUpdate()
      } else {
        toast.error(data.error || 'Avatar değiştirilemedi')
      }
    } catch (error) {
      toast.error('Bir hata oluştu')
    } finally {
      setChangingAvatar(false)
    }
  }

  return (
    <>
      <div
        className="overflow-hidden rounded-3xl"
        style={{ background: `linear-gradient(135deg, ${theme.colors.primary}12, ${theme.colors.accent}10 60%, ${theme.colors.card})`, border: `1px solid ${theme.colors.cardBorder}` }}
      >
        <div className="p-4 sm:p-6">
          {/* Top Section: Madalyon avatar + isim + rütbe */}
          <div className="flex items-start gap-4 mb-5">
            {/* Avatar - altın halka madalyon çerçevesi */}
            <div className="relative group flex-shrink-0 cursor-pointer" onClick={() => setShowAvatarDialog(true)}>
              <div
                className="rounded-full p-[3px]"
                style={{ background: `linear-gradient(135deg, ${theme.colors.gradientFrom}, ${theme.colors.gradientTo})` }}
              >
                <Avatar className="relative w-16 h-16 sm:w-20 sm:h-20" style={{ background: theme.colors.background }}>
                  {userData.avatar ? (
                    <AvatarImage src={userData.avatar} alt="Avatar" className="rounded-full" />
                  ) : (
                    <AvatarFallback
                      className="text-2xl sm:text-3xl font-bold font-display"
                      style={{ background: theme.colors.background, color: theme.colors.text }}
                    >
                      {userData.siteUsername?.[0] || userData.firstName?.[0] || '?'}
                    </AvatarFallback>
                  )}
                </Avatar>
              </div>
              <div
                className="absolute bottom-0 right-0 rounded-full p-1.5 shadow-lg"
                style={{ backgroundColor: theme.colors.primary, border: `2px solid ${theme.colors.background}` }}
              >
                <Pencil className="w-3 h-3" style={{ color: theme.colors.primaryForeground }} />
              </div>
              {/* Rütbe rozeti - madalyonun üstüne bindirilmiş */}
              {userData.rank && (
                <div
                  className="absolute -top-1.5 -left-1.5 w-7 h-7 rounded-full flex items-center justify-center text-sm shadow-lg"
                  style={{ background: userData.rank.color, border: `2px solid ${theme.colors.background}` }}
                  title={userData.rank.name}
                >
                  {userData.rank.icon}
                </div>
              )}
            </div>

            {/* User Info */}
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-xl sm:text-2xl font-bold mb-0.5 truncate" style={{ color: theme.colors.text }}>
                {userData.siteUsername || userData.firstName || 'Kullanıcı'}
              </h1>
              <p className="text-xs sm:text-sm mb-2" style={{ color: theme.colors.textMuted }}>
                {userData.rank?.name || 'Üye'}
                {userData.createdAt && ` · ${new Date(userData.createdAt).toLocaleDateString('tr-TR', { month: 'short', year: 'numeric' })}'den beri`}
              </p>
              {/* Puan / XP rozetleri */}
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold font-data"
                  style={{ background: `${theme.colors.primary}18`, color: theme.colors.primary }}
                >
                  {userData.points?.toLocaleString('tr-TR') || 0} puan
                </span>
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold font-data"
                  style={{ background: `${theme.colors.accent}18`, color: theme.colors.accent }}
                >
                  {userData.xp?.toLocaleString('tr-TR') || 0} XP
                </span>
              </div>
            </div>

            {/* Logout Button - Sağda */}
            <button
              onClick={handleLogout}
              className="flex-shrink-0 flex items-center gap-1.5 transition-colors text-xs sm:text-sm font-medium px-2 py-1.5 rounded-lg"
              style={{ color: theme.colors.error }}
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Çıkış</span>
            </button>
          </div>

          {/* Mesaj özeti - tek satır, kompakt (eskiden 4 ayrı büyük kutuydu, kalabalıktı) */}
          {userData.messageStats && (
            <div
              className="flex items-center justify-between gap-2 mb-4 px-3 py-2 rounded-xl text-xs"
              style={{ background: theme.colors.backgroundSecondary, color: theme.colors.textMuted }}
            >
              <span className="flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" />
                Mesajlar
              </span>
              <span className="font-data" style={{ color: theme.colors.text }}>
                Bugün <b>{userData.messageStats.daily || 0}</b> · Hafta <b>{userData.messageStats.weekly || 0}</b> · Toplam <b>{userData.messageStats.total || 0}</b>
              </span>
            </div>
          )}

          {/* Hesap - email durumu ve şifre değiştirme tek kompakt satırda */}
          {userData.email && (
            <div className="flex items-center justify-between gap-2 pt-3" style={{ borderTop: `1px solid ${theme.colors.border}50` }}>
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <Mail className="w-3.5 h-3.5 flex-shrink-0" style={{ color: theme.colors.textMuted }} />
                <span className="text-xs truncate" style={{ color: theme.colors.textMuted }}>{userData.email}</span>
                {userData.emailVerified ? (
                  <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: theme.colors.success }} />
                ) : (
                  <button
                    onClick={sendVerificationCode}
                    disabled={sendingCode}
                    className="text-[11px] font-semibold underline flex-shrink-0"
                    style={{ color: theme.colors.warning }}
                  >
                    Doğrula
                  </button>
                )}
              </div>
              <button
                onClick={() => setShowPasswordDialog(true)}
                className="flex items-center gap-1 text-xs font-medium flex-shrink-0"
                style={{ color: theme.colors.textMuted }}
              >
                <Key className="w-3.5 h-3.5" />
                Şifre
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Avatar Selection Dialog */}
      <Dialog open={showAvatarDialog} onOpenChange={setShowAvatarDialog}>
        <DialogContent
          className="border"
          style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: theme.colors.text }}>Avatar Seç</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-5 gap-3 py-4">
            {AVATARS.map((avatar, index) => (
              <button
                key={avatar}
                onClick={() => changeAvatar(avatar)}
                disabled={changingAvatar}
                className="relative group aspect-square rounded-lg overflow-hidden border-2 transition-all"
                style={{ borderColor: theme.colors.border }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatar}
                  alt={`Avatar ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                {userData.avatar === avatar && (
                  <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{ backgroundColor: `${theme.colors.primary}30` }}
                  >
                    <CheckCircle2 className="w-6 h-6 text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Password Change Dialog */}
      <AlertDialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <AlertDialogContent
          className="border"
          style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle style={{ color: theme.colors.text }}>Şifre Değiştir</AlertDialogTitle>
            <AlertDialogDescription style={{ color: theme.colors.textMuted }}>
              Güvenliğiniz için mevcut şifrenizi girin ve yeni şifrenizi belirleyin
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="current-password" style={{ color: theme.colors.text }}>Mevcut Şifre</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="border"
                style={{ backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }}
                placeholder="Mevcut şifreniz"
              />
            </div>
            <div>
              <Label htmlFor="new-password" style={{ color: theme.colors.text }}>Yeni Şifre</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="border"
                style={{ backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }}
                placeholder="En az 6 karakter"
              />
            </div>
            <div>
              <Label htmlFor="confirm-password" style={{ color: theme.colors.text }}>Yeni Şifre (Tekrar)</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="border"
                style={{ backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }}
                placeholder="Yeni şifrenizi tekrar girin"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              className={button('secondary')}
            >
              İptal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={changePassword}
              disabled={changingPassword}
              style={{ background: `linear-gradient(to right, ${theme.colors.warning}, ${theme.colors.error})` }}
            >
              {changingPassword ? 'Değiştiriliyor...' : 'Şifreyi Değiştir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Email Verification Dialog */}
      <AlertDialog open={showEmailVerification} onOpenChange={setShowEmailVerification}>
        <AlertDialogContent
          className="border"
          style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle style={{ color: theme.colors.text }}>Email Doğrulama</AlertDialogTitle>
            <AlertDialogDescription style={{ color: theme.colors.textMuted }}>
              Email adresinize gönderilen 6 haneli kodu girin
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="verification-code" style={{ color: theme.colors.text }}>Doğrulama Kodu</Label>
            <Input
              id="verification-code"
              type="text"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="text-center text-2xl tracking-widest border"
              style={{ backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }}
              placeholder="000000"
              maxLength={6}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              className={button('secondary')}
            >
              İptal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={verifyEmail}
              disabled={verifying}
              className={button('primary')}
            >
              {verifying ? 'Doğrulanıyor...' : 'Doğrula'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
