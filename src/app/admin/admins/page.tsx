'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { UserPlus, Edit, Trash2, Shield } from 'lucide-react'
import { toast } from 'sonner'

interface Admin {
  id: string
  username: string
  isSuperAdmin: boolean
  canAccessUsers: boolean
  canAccessTasks: boolean
  canAccessShop: boolean
  canAccessWheel: boolean
  canAccessSponsors: boolean
  canAccessAds: boolean
  canAccessRanks: boolean
  canAccessSettings: boolean
  canAccessAdmins: boolean
  canAccessTickets: boolean
  canAccessEvents: boolean
  canAccessPromocodes: boolean
  canAccessActivityLogs: boolean
  createdAt: string
}

const PERMISSION_LABELS = {
  canAccessUsers: 'Kullanıcılar',
  canAccessTasks: 'Görevler',
  canAccessShop: 'Market',
  canAccessWheel: 'Çark',
  canAccessSponsors: 'Sponsorlar',
  canAccessAds: 'Reklam Ayarları',
  canAccessRanks: 'Rütbeler',
  canAccessSettings: 'Ayarlar',
  canAccessAdmins: 'Adminler',
  canAccessTickets: 'Biletler',
  canAccessEvents: 'Etkinlikler',
  canAccessPromocodes: 'Promocodlar',
  canAccessActivityLogs: 'Aktivite Logları',
}

export default function AdminsPage() {
  const router = useRouter()
  const [admins, setAdmins] = useState<Admin[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null)
  const [newAdminData, setNewAdminData] = useState({
    username: '',
    password: '',
    permissions: {} as Record<string, boolean>
  })

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (!token) {
      router.push('/admin')
      return
    }
    loadAdmins()
  }, [])

  async function loadAdmins() {
    try {
      const token = localStorage.getItem('admin_token')
      const response = await fetch('/api/admin/admins', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.status === 403) {
        toast.error('Bu sayfaya erişim yetkiniz yok')
        router.push('/admin/dashboard')
        return
      }

      const data = await response.json()
      setAdmins(data)
    } catch (error) {
      console.error('Error loading admins:', error)
      toast.error('Adminler yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateAdmin() {
    if (!newAdminData.username || !newAdminData.password) {
      toast.error('Kullanıcı adı ve şifre gerekli')
      return
    }

    try {
      const token = localStorage.getItem('admin_token')
      const response = await fetch('/api/admin/admins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newAdminData)
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Admin başarıyla oluşturuldu')
        setShowCreateDialog(false)
        setNewAdminData({ username: '', password: '', permissions: {} })
        loadAdmins()
      } else {
        toast.error(data.error || 'Admin oluşturulamadı')
      }
    } catch (error) {
      console.error('Error creating admin:', error)
      toast.error('Bir hata oluştu')
    }
  }

  async function handleUpdateAdmin() {
    if (!selectedAdmin) return

    try {
      const token = localStorage.getItem('admin_token')
      const response = await fetch(`/api/admin/admins/${selectedAdmin.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          permissions: {
            canAccessUsers: selectedAdmin.canAccessUsers,
            canAccessTasks: selectedAdmin.canAccessTasks,
            canAccessShop: selectedAdmin.canAccessShop,
            canAccessWheel: selectedAdmin.canAccessWheel,
            canAccessSponsors: selectedAdmin.canAccessSponsors,
            canAccessAds: selectedAdmin.canAccessAds,
            canAccessRanks: selectedAdmin.canAccessRanks,
            canAccessSettings: selectedAdmin.canAccessSettings,
            canAccessAdmins: selectedAdmin.canAccessAdmins,
            canAccessTickets: selectedAdmin.canAccessTickets,
            canAccessEvents: selectedAdmin.canAccessEvents,
            canAccessPromocodes: selectedAdmin.canAccessPromocodes,
            canAccessActivityLogs: selectedAdmin.canAccessActivityLogs,
          }
        })
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Admin başarıyla güncellendi')
        setShowEditDialog(false)
        setSelectedAdmin(null)
        loadAdmins()
      } else {
        toast.error(data.error || 'Admin güncellenemedi')
      }
    } catch (error) {
      console.error('Error updating admin:', error)
      toast.error('Bir hata oluştu')
    }
  }

  async function handleDeleteAdmin(admin: Admin) {
    if (!confirm(`${admin.username} adminini silmek istediğinize emin misiniz?`)) {
      return
    }

    try {
      const token = localStorage.getItem('admin_token')
      const response = await fetch(`/api/admin/admins/${admin.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Admin başarıyla silindi')
        loadAdmins()
      } else {
        toast.error(data.error || 'Admin silinemedi')
      }
    } catch (error) {
      console.error('Error deleting admin:', error)
      toast.error('Bir hata oluştu')
    }
  }

  function openEditDialog(admin: Admin) {
    setSelectedAdmin(admin)
    setShowEditDialog(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="admin-spinner"></div>
      </div>
    )
  }

  return (
    <div className="admin-page-container">
      <div className="admin-page-inner space-y-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="admin-page-title">Admin Yönetimi</h1>
            <p className="admin-page-subtitle">Admin kullanıcılarını ve yetkilerini yönetin</p>
          </div>
          <button
            onClick={() => setShowCreateDialog(true)}
            className="admin-btn-primary flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Yeni Admin
          </button>
        </div>

        <div className="admin-container">
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead className="admin-table-header">
                <tr>
                  <th className="admin-table-head">Kullanıcı Adı</th>
                  <th className="admin-table-head">Rol</th>
                  <th className="admin-table-head">Oluşturma Tarihi</th>
                  <th className="admin-table-head text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((admin) => (
                  <tr key={admin.id} className="admin-table-row">
                    <td className="admin-table-cell font-medium admin-text-primary">{admin.username}</td>
                    <td className="admin-table-cell">
                      {admin.isSuperAdmin ? (
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-yellow-500" />
                          <span className="text-yellow-500 font-bold">Ana Admin</span>
                        </div>
                      ) : (
                        <span className="admin-text-muted">Admin</span>
                      )}
                    </td>
                    <td className="admin-table-cell admin-text-muted">
                      {new Date(admin.createdAt).toLocaleDateString('tr-TR')}
                    </td>
                    <td className="admin-table-cell text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditDialog(admin)}
                          className="admin-btn-primary p-2"
                          disabled={admin.isSuperAdmin}
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteAdmin(admin)}
                          className="admin-btn-danger p-2"
                          disabled={admin.isSuperAdmin}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create Admin Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="admin-dialog max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="admin-dialog-header">
              <DialogTitle className="admin-dialog-title">Yeni Admin Oluştur</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <label className="admin-label">Kullanıcı Adı</label>
                <input
                  value={newAdminData.username}
                  onChange={(e) => setNewAdminData({ ...newAdminData, username: e.target.value })}
                  className="admin-input"
                  placeholder="Kullanıcı adı"
                />
              </div>
              <div className="space-y-2">
                <label className="admin-label">Şifre</label>
                <input
                  type="password"
                  value={newAdminData.password}
                  onChange={(e) => setNewAdminData({ ...newAdminData, password: e.target.value })}
                  className="admin-input"
                  placeholder="Şifre"
                />
              </div>
              <div className="space-y-4">
                <label className="text-lg admin-text-primary font-semibold">Yetkiler</label>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between p-3 admin-card rounded-lg">
                      <span className="text-sm admin-text-secondary">{label}</span>
                      <button
                        onClick={() =>
                          setNewAdminData({
                            ...newAdminData,
                            permissions: { ...newAdminData.permissions, [key]: !newAdminData.permissions[key] }
                          })
                        }
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          newAdminData.permissions[key] ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'
                        }`}
                      >
                        {newAdminData.permissions[key] ? 'Açık' : 'Kapalı'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCreateAdmin}
                  className="admin-btn-primary flex-1"
                >
                  Oluştur
                </button>
                <button
                  onClick={() => setShowCreateDialog(false)}
                  className="admin-btn-secondary flex-1"
                >
                  İptal
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Admin Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="admin-dialog max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="admin-dialog-header">
              <DialogTitle className="admin-dialog-title">Admin Yetkilerini Düzenle</DialogTitle>
            </DialogHeader>
            {selectedAdmin && (
              <div className="space-y-6 py-4">
                <div className="space-y-2">
                  <label className="admin-label">Kullanıcı Adı</label>
                  <input
                    value={selectedAdmin.username}
                    disabled
                    className="admin-input opacity-50"
                  />
                </div>
                <div className="space-y-4">
                  <label className="text-lg admin-text-primary font-semibold">Yetkiler</label>
                  <div className="grid grid-cols-2 gap-4">
                    {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                      <div key={key} className="flex items-center justify-between p-3 admin-card rounded-lg">
                        <span className="text-sm admin-text-secondary">{label}</span>
                        <button
                          onClick={() =>
                            setSelectedAdmin({ ...selectedAdmin, [key]: !(selectedAdmin[key as keyof Admin] as boolean) })
                          }
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            selectedAdmin[key as keyof Admin] ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'
                          }`}
                        >
                          {selectedAdmin[key as keyof Admin] ? 'Açık' : 'Kapalı'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleUpdateAdmin}
                    className="admin-btn-primary flex-1"
                  >
                    Güncelle
                  </button>
                  <button
                    onClick={() => setShowEditDialog(false)}
                    className="admin-btn-secondary flex-1"
                  >
                    İptal
                  </button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
