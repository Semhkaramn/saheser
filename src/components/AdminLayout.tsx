'use client'

import { ReactNode, useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import AdminSidebar from './AdminSidebar'
import AdminPermissionGuard from './AdminPermissionGuard'

interface AdminLayoutProps {
  children: ReactNode
}

interface AdminInfo {
  username: string
  isSuperAdmin: boolean
  permissions: Record<string, boolean>
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [adminInfo, setAdminInfo] = useState<AdminInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Eğer /admin login sayfasındaysa auth kontrolü yapma
    if (pathname === '/admin') {
      setLoading(false)
      return
    }

    const token = localStorage.getItem('admin_token')
    if (!token) {
      router.push('/admin')
      return
    }
    loadAdminInfo()
  }, [pathname])

  async function loadAdminInfo() {
    try {
      const token = localStorage.getItem('admin_token')
      const response = await fetch('/api/admin/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        const data = await response.json()
        setAdminInfo(data)
      } else {
        // 401 (Unauthorized) normal - admin giriş yapmamış veya token geçersiz
        if (response.status !== 401) {
          console.error('Unexpected admin auth error:', response.status)
        }
        localStorage.removeItem('admin_token')
        router.push('/admin')
      }
    } catch (error) {
      // Network hatalarını logla
      console.error('Network error loading admin info:', error)
      localStorage.removeItem('admin_token')
      router.push('/admin')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen admin-layout-bg">
        <div className="admin-spinner"></div>
      </div>
    )
  }

  // Eğer /admin login sayfasındaysa, sadece children'ı render et
  if (pathname === '/admin') {
    return <>{children}</>
  }

  return (
    <AdminPermissionGuard>
      <div className="min-h-screen admin-layout-bg">
        <AdminSidebar adminInfo={adminInfo} />

        <div className="lg:ml-64 transition-all duration-300">
          <main className="min-h-screen relative pt-14 lg:pt-0">
            {children}
          </main>
        </div>
      </div>
    </AdminPermissionGuard>
  )
}
