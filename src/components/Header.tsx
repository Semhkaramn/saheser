'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Star, TrendingUp, LogIn, UserPlus, User, Gift } from 'lucide-react'
import { useAuth } from '@/components/providers/auth-provider'
import { SITE_CONFIG } from '@/lib/site-config'
import { optimizeCloudinaryImage } from '@/lib/utils'
import PromocodeModal from '@/components/PromocodeModal'
import { useUserTheme } from '@/components/providers/user-theme-provider'

export default function Header() {
  const { user, isAuthenticated, setShowLoginModal, setShowRegisterModal } = useAuth()
  const [showPromocodeModal, setShowPromocodeModal] = useState(false)
  const { theme, button } = useUserTheme()

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 w-full backdrop-blur-sm h-16 lg:h-20"
      style={{
        backgroundColor: `${theme.colors.background}f2`,
        borderBottom: `1px solid ${theme.colors.primary}25`,
        transform: 'translateZ(0)',
        contain: 'paint'
      }}
    >
      <div className="px-3 lg:px-6 py-2 lg:py-4 h-full">
        <div className="flex items-center justify-between h-full">
          {/* Logo - Left Side */}
          <Link
            href="/"
            prefetch={true}
            className="flex items-center gap-2 lg:gap-3 cursor-pointer group ml-12 lg:ml-0"
          >
            <div className="w-9 h-9 lg:w-12 lg:h-12 flex-shrink-0 relative">
              <img
                src={SITE_CONFIG.siteLogo}
                alt="Logo"
                width={48}
                height={48}
                fetchPriority="high"
                decoding="async"
                className="w-full h-full object-contain transition-transform group-hover:scale-105"
              />
            </div>
            <h2
              className="text-base sm:text-xl md:text-2xl lg:text-3xl font-bold transition-colors tracking-tight font-display"
              style={{ color: theme.colors.text }}
            >
              <span className="group-hover:opacity-80 transition-opacity">
                {SITE_CONFIG.siteName}
              </span>
            </h2>
          </Link>

          {/* Right Side - User Info / Auth Buttons */}
          <div className="flex items-center gap-2 lg:gap-4">
            {/* Promocode Button - Hidden on mobile, visible on md+ */}
            {isAuthenticated && user && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPromocodeModal(true)}
                aria-label="Promocode Kullan"
                className="hidden md:flex text-xs lg:text-sm rounded-full"
                style={{
                  borderColor: `${theme.colors.accent}80`,
                  color: theme.colors.accent
                }}
              >
                <Gift className="w-3 lg:w-4 h-3 lg:h-4 mr-1 lg:mr-2" aria-hidden="true" />
                <span className="hidden lg:inline">Promocode</span>
                <span className="lg:hidden">Kod</span>
              </Button>
            )}

            {isAuthenticated && user ? (
              <>
                {/* Stats - rozet (pill) tarzı, madalyon rengiyle */}
                <div className="hidden md:flex items-center gap-2 lg:gap-3">
                  <div
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                    style={{ background: `${theme.colors.primary}18`, border: `1px solid ${theme.colors.primary}35` }}
                  >
                    <Star className="w-3.5 lg:w-4 h-3.5 lg:h-4" style={{ fill: theme.colors.primary, color: theme.colors.primary }} />
                    <span className="text-sm lg:text-base font-bold font-data" style={{ color: theme.colors.text }}>
                      {user.points.toLocaleString('tr-TR')}
                    </span>
                  </div>
                  <div
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                    style={{ background: `${theme.colors.accent}18`, border: `1px solid ${theme.colors.accent}35` }}
                  >
                    <TrendingUp className="w-3.5 lg:w-4 h-3.5 lg:h-4" style={{ color: theme.colors.accent }} />
                    <span className="text-sm lg:text-base font-bold font-data" style={{ color: theme.colors.text }}>
                      {user.xp.toLocaleString('tr-TR')}
                    </span>
                  </div>
                </div>

                {/* User Profile Button */}
                <Link
                  href="/profile"
                  prefetch={true}
                  className="flex items-center gap-2 lg:gap-3 px-2 lg:px-3 py-1.5 lg:py-2 rounded-full transition-all duration-200 backdrop-blur-sm"
                  style={{
                    backgroundColor: `${theme.colors.card}bb`,
                    border: `1px solid ${theme.colors.border}`
                  }}
                >
                  <Avatar className="w-8 lg:w-9 h-8 lg:h-9" style={{ boxShadow: `0 0 0 2px ${theme.colors.background}, 0 0 0 3px ${theme.colors.primary}66` }}>
                    {user.avatar ? (
                      <AvatarImage src={user.avatar} alt="Avatar" />
                    ) : (
                      <AvatarFallback
                        className="font-semibold text-xs lg:text-sm"
                        style={{
                          background: `linear-gradient(135deg, ${theme.colors.gradientFrom}, ${theme.colors.gradientTo})`,
                          color: theme.colors.primaryForeground
                        }}
                      >
                        {user.siteUsername?.[0]?.toUpperCase() || user.firstName?.[0]?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <span className="inline text-xs lg:text-sm font-medium pr-1 max-w-[72px] sm:max-w-none truncate" style={{ color: theme.colors.textSecondary }}>
                    {user.siteUsername || user.firstName || 'Profil'}
                  </span>
                </Link>
              </>
            ) : (
              <>
                {/* Not Authenticated - Show Login/Register Buttons IMMEDIATELY */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowLoginModal(true)}
                  aria-label="Giriş Yap"
                  className="text-xs lg:text-sm rounded-full"
                  style={{
                    borderColor: `${theme.colors.primary}80`,
                    color: theme.colors.primary
                  }}
                >
                  <LogIn className="w-3 lg:w-4 h-3 lg:h-4 mr-1 lg:mr-2" aria-hidden="true" />
                  <span className="hidden sm:inline">Giriş Yap</span>
                  <span className="sm:hidden">Giriş</span>
                </Button>
                <Button
                  size="sm"
                  onClick={() => setShowRegisterModal(true)}
                  aria-label="Kayıt Ol"
                  className="text-xs lg:text-sm rounded-full font-semibold"
                  style={{
                    background: `linear-gradient(to right, ${theme.colors.gradientFrom}, ${theme.colors.gradientTo})`,
                    color: theme.colors.primaryForeground
                  }}
                >
                  <UserPlus className="w-3 lg:w-4 h-3 lg:h-4 mr-1 lg:mr-2" aria-hidden="true" />
                  <span className="hidden sm:inline">Kayıt Ol</span>
                  <span className="sm:hidden">Kayıt</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Promocode Modal */}
      <PromocodeModal open={showPromocodeModal} onOpenChange={setShowPromocodeModal} />
    </header>
  )
}
