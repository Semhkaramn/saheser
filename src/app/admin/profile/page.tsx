'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Lock, Shield, User } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

interface AdminInfo {
  id: string
  username: string
  isSuperAdmin: boolean
  permissions: Record<string, boolean>
  createdAt: string
  updatedAt: string
}

export default function AdminProfilePage() {
  const router = useRouter()
  const [adminInfo, setAdminInfo] = useState<AdminInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (!token) {
      router.push('/admin')
      return
    }
    loadAdminInfo()
  }, [])

  async function loadAdminInfo() {
    try {
      const token = localStorage.getItem('admin_token')
      const response = await fetch('/api/admin/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setAdminInfo(data)
      } else {
        toast.error('Admin bilgileri yüklenemedi')
        router.push('/admin')
      }
    } catch (error) {
      console.error('Error loading admin info:', error)
      toast.error('Bir hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  async function handleChangePassword() {
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      toast.error('Tüm alanları doldurun')
      return
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('Yeni şifreler eşleşmiyor')
      return
    }

    if (passwordData.newPassword.length < 6) {
      toast.error('Yeni şifre en az 6 karakter olmalı')
      return
    }

    setChangingPassword(true)
    try {
      const token = localStorage.getItem('admin_token')
      const response = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        })
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Şifre başarıyla değiştirildi')
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
      } else {
        toast.error(data.error || 'Şifre değiştirilemedi')
      }
    } catch (error) {
      console.error('Error changing password:', error)
      toast.error('Bir hata oluştu')
    } finally {
      setChangingPassword(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  const permissionCount = adminInfo ? Object.values(adminInfo.permissions).filter(Boolean).length : 0

  return (
    <div className="admin-page-container">
      <div className="admin-page-inner space-y-4">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Profil Ayarları</h1>
          <p className="admin-text-muted">Hesap bilgilerinizi ve şifrenizi yönetin</p>
        </div>

        <div className="grid gap-6">
          {/* Admin Bilgileri */}
          <Card className="admin-card p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <User className="w-8 h-8 admin-text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold admin-text-primary">{adminInfo?.username}</h2>
                {adminInfo?.isSuperAdmin && (
                  <div className="flex items-center gap-2 mt-1">
                    <Shield className="w-4 h-4 text-yellow-500" />
                    <span className="text-yellow-500 font-semibold">Ana Admin</span>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-white/5 rounded-lg">
                <p className="text-gray-400 text-sm mb-1">Rol</p>
                <p className="text-white font-semibold">
                  {adminInfo?.isSuperAdmin ? 'Ana Admin' : 'Admin'}
                </p>
              </div>
              <div className="p-4 bg-white/5 rounded-lg">
                <p className="text-gray-400 text-sm mb-1">Yetkili Sayfa Sayısı</p>
                <p className="text-white font-semibold">{permissionCount} / 12</p>
              </div>
              <div className="p-4 bg-white/5 rounded-lg">
                <p className="text-gray-400 text-sm mb-1">Hesap Oluşturma</p>
                <p className="text-white font-semibold">
                  {adminInfo && new Date(adminInfo.createdAt).toLocaleDateString('tr-TR')}
                </p>
              </div>
              <div className="p-4 bg-white/5 rounded-lg">
                <p className="text-gray-400 text-sm mb-1">Son Güncelleme</p>
                <p className="text-white font-semibold">
                  {adminInfo && new Date(adminInfo.updatedAt).toLocaleDateString('tr-TR')}
                </p>
              </div>
            </div>
          </Card>

          {/* Şifre Değiştir */}
          <Card className="admin-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <Lock className="w-6 h-6 admin-text-primary" />
              <h2 className="text-2xl font-bold admin-text-primary">Şifre Değiştir</h2>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Mevcut Şifre</Label>
                <Input
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  className="bg-white/10 border-white/20 admin-text-primary"
                  placeholder="Mevcut şifrenizi girin"
                  disabled={changingPassword}
                />
              </div>

              <div className="space-y-2">
                <Label>Yeni Şifre</Label>
                <Input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  className="bg-white/10 border-white/20 admin-text-primary"
                  placeholder="Yeni şifrenizi girin"
                  disabled={changingPassword}
                />
              </div>

              <div className="space-y-2">
                <Label>Yeni Şifre (Tekrar)</Label>
                <Input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  className="bg-white/10 border-white/20 admin-text-primary"
                  placeholder="Yeni şifrenizi tekrar girin"
                  disabled={changingPassword}
                />
              </div>

              <Button
                onClick={handleChangePassword}
                disabled={changingPassword}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
              >
                {changingPassword ? 'Değiştiriliyor...' : 'Şifreyi Değiştir'}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
