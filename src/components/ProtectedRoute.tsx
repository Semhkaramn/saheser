'use client'

import { ReactNode, useEffect } from 'react'
import { useAuth, useModalState } from '@/components/providers/auth-provider'
import { useUserTheme } from '@/components/providers/user-theme-provider'
import Header from './Header'
import Sidebar from './Sidebar'
import { LoadingSpinner } from './LoadingSpinner'

interface ProtectedRouteProps {
  children: ReactNode
  requireAuth?: boolean
}

export default function ProtectedRoute({ children, requireAuth = false }: ProtectedRouteProps) {
  const { user, initialCheckDone } = useAuth()
  const { setShowLoginModal } = useModalState()
  const { theme } = useUserTheme()

  // 🚀 OPTIMISTIC UI: Loading durumunda artık spinner göstermiyoruz
  // İçeriği hemen göster, auth kontrolü arka planda yapılacak

  // If auth is required but user is not logged in, show login modal
  useEffect(() => {
    if (requireAuth && !user && initialCheckDone) {
      setShowLoginModal(true)
    }
  }, [requireAuth, user, initialCheckDone, setShowLoginModal])

  // If auth is not required or user is logged in, show children
  if (!requireAuth || user) {
    return <>{children}</>
  }

  // 🚀 Auth kontrolü henüz tamamlanmadıysa, içeriği göster (optimistic)
  // Kullanıcı giriş yapmamışsa modal açılacak
  if (!initialCheckDone) {
    return <>{children}</>
  }

  // If auth is required but user is not logged in, show message with login button
  return (
    <div className="min-h-screen" style={{ background: theme.colors.background }}>
      <Header />
      <Sidebar />
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="text-center max-w-md">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: `linear-gradient(135deg, ${theme.colors.gradientFrom}, ${theme.colors.gradientTo})` }}
          >
            <svg className="w-10 h-10" style={{ color: theme.colors.primaryForeground }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="font-display text-2xl font-bold mb-2" style={{ color: theme.colors.text }}>Giriş Gerekli</h2>
          <p className="mb-6" style={{ color: theme.colors.textMuted }}>
            Bu sayfayı görüntülemek için giriş yapmanız gerekiyor.
          </p>
          <button
            onClick={() => setShowLoginModal(true)}
            className="font-medium px-6 py-3 rounded-full transition-colors"
            style={{
              background: `linear-gradient(135deg, ${theme.colors.gradientFrom}, ${theme.colors.gradientTo})`,
              color: theme.colors.primaryForeground
            }}
          >
            Giriş Yap
          </button>
        </div>
      </div>
    </div>
  )
}
