'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { toast } from 'sonner'

const PAGE_PERMISSIONS: Record<string, string | null> = {
  '/admin': null, // Login sayfası
  '/admin/dashboard': null, // Her admin erişebilir
  '/admin/profile': null, // Her admin kendi profiline erişebilir
  '/admin/users': 'canAccessUsers',
  '/admin/multi-detection': 'canAccessUsers',
  '/admin/tasks': 'canAccessTasks',
  '/admin/shop': 'canAccessShop',
  '/admin/wheel': 'canAccessWheel',
  '/admin/tickets': 'canAccessTickets',
  '/admin/events': 'canAccessEvents',
  '/admin/promocodes': 'canAccessPromocodes',
  '/admin/sponsors': 'canAccessSponsors',
  '/admin/ads': 'canAccessAds',
  '/admin/ranks': 'canAccessRanks',
  '/admin/admins': 'canAccessAdmins',
  '/admin/activity-logs': 'canAccessActivityLogs',
  '/admin/groups': 'canAccessSettings',
  '/admin/short-links': 'canAccessSettings',
  '/admin/bot-settings': 'canAccessSettings',
}

interface AdminPermissionGuardProps {
  children: React.ReactNode
  permission?: string // Optional prop for direct permission check
}

export default function AdminPermissionGuard({ children, permission }: AdminPermissionGuardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [hasPermission, setHasPermission] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkPermission()
  }, [pathname, permission])

  async function checkPermission() {
    // Login sayfasında kontrol yapma
    if (pathname === '/admin') {
      setHasPermission(true)
      setLoading(false)
      return
    }

    const token = localStorage.getItem('admin_token')
    if (!token) {
      router.push('/admin')
      return
    }

    try {
      const response = await fetch('/api/admin/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (!response.ok) {
        localStorage.removeItem('admin_token')
        router.push('/admin')
        return
      }

      const adminData = await response.json()

      // If permission prop is provided, use it; otherwise use PAGE_PERMISSIONS
      const requiredPermission = permission || PAGE_PERMISSIONS[pathname]

      // Dashboard, profile veya izin gerekmeyenler
      if (!requiredPermission) {
        setHasPermission(true)
        setLoading(false)
        return
      }

      // Super admin her şeye erişebilir
      if (adminData.isSuperAdmin) {
        setHasPermission(true)
        setLoading(false)
        return
      }

      // İzin kontrolü
      if (adminData.permissions[requiredPermission]) {
        setHasPermission(true)
        setLoading(false)
      } else {
        toast.error('Bu sayfaya erişim yetkiniz yok')
        router.push('/admin/dashboard')
      }
    } catch (error) {
      console.error('Permission check error:', error)
      localStorage.removeItem('admin_token')
      router.push('/admin')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen admin-layout-bg">
        <div className="admin-spinner"></div>
      </div>
    )
  }

  if (!hasPermission) {
    return null
  }

  return <>{children}</>
}
