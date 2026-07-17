'use client'

import { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { toast } from 'sonner'

interface Rank {
  id: string
  name: string
  icon: string
  color: string
  minXp: number
  order: number
}

export interface UserData {
  id: string
  email?: string
  siteUsername?: string
  telegramUsername?: string
  firstName?: string
  lastName?: string
  points: number
  xp: number
  rank: Rank
  nextRank?: Rank
  allRanks?: Rank[]
  dailySpinsLeft: number
  lastSpinReset?: Date
  telegramId?: string
  isBanned?: boolean
  emailVerified?: boolean
  leaderboardRank?: number
  trc20WalletAddress?: string
  avatar?: string
  messageStats?: {
    daily: number
    weekly: number
    monthly: number
    total: number
  }
}

interface AuthStateContextType {
  user: UserData | null
  loading: boolean
  isAuthenticated: boolean
  initialCheckDone: boolean
}

interface AuthActionsContextType {
  refreshUser: () => Promise<void>
  logout: () => Promise<void>
  requireAuth: (redirectUrl: string) => boolean
}

interface ModalContextType {
  showLoginModal: boolean
  showRegisterModal: boolean
  showChannelModal: boolean
  returnUrl: string | null
  setShowLoginModal: (show: boolean) => void
  setShowRegisterModal: (show: boolean) => void
  setShowChannelModal: (show: boolean) => void
  setReturnUrl: (url: string | null) => void
}

const AuthStateContext = createContext<AuthStateContextType | undefined>(undefined)
const AuthActionsContext = createContext<AuthActionsContextType | undefined>(undefined)
const ModalContext = createContext<ModalContextType | undefined>(undefined)

const SESSION_TIMEOUT = 15 * 60 * 1000 // 15 dakika
const REFRESH_TIMEOUT = 8000 // 🚀 8 saniye timeout (503 önleme)
const REFRESH_COOLDOWN = 2000 // 🚀 2 saniye cooldown (rate limiting)

// 🚀 OPTIMIZATION: localStorage'dan cache oku
function getCachedUser(): UserData | null {
  if (typeof window === 'undefined') return null
  try {
    const cached = localStorage.getItem('user_cache')
    if (cached) {
      const data = JSON.parse(cached)
      // Cache 5 dakikadan eskiyse kullanma
      if (data.timestamp && Date.now() - data.timestamp < 5 * 60 * 1000) {
        return data.user
      }
    }
  } catch {}
  return null
}

// 🚀 OPTIMIZATION: localStorage'a cache yaz
function setCachedUser(user: UserData | null) {
  if (typeof window === 'undefined') return
  try {
    if (user) {
      localStorage.setItem('user_cache', JSON.stringify({ user, timestamp: Date.now() }))
    } else {
      localStorage.removeItem('user_cache')
    }
  } catch {}
}

// 🚀 OPTIMIZATION: Sayfa yüklendiğinde cache'den hemen oku (senkron)
function getInitialUser(): UserData | null {
  if (typeof window === 'undefined') return null
  return getCachedUser()
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  // 🚀 HYDRATION FIX + OPTIMISTIC UI:
  // - Sunucu: user=null, loading=false (SSR için)
  // - İstemci mount: cache varsa hemen göster, yoksa null (misafir varsay)
  // - API cevabı: sessizce güncelle
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(false) // 🚀 Artık false ile başlıyor!
  const [initialCheckDone, setInitialCheckDone] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [showChannelModal, setShowChannelModal] = useState(false)
  const [returnUrl, setReturnUrl] = useState<string | null>(null)

  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastActivityRef = useRef<number>(Date.now())

  // 🚀 FIX: isRefreshingRef blocking sorunu - Promise queue ile çözüm
  const pendingRefreshRef = useRef<Promise<void> | null>(null)
  const lastRefreshTimeRef = useRef<number>(0)
  const abortControllerRef = useRef<AbortController | null>(null)

  const refreshUser = useCallback(async () => {
    // 🚀 FIX: Cooldown kontrolü - çok sık refresh engelle
    const now = Date.now()
    if (now - lastRefreshTimeRef.current < REFRESH_COOLDOWN) {
      // Cooldown içindeyse mevcut promise'i bekle veya skip et
      if (pendingRefreshRef.current) {
        return pendingRefreshRef.current
      }
      return
    }

    // 🚀 FIX: Zaten bir refresh yapılıyorsa, aynı promise'i döndür
    if (pendingRefreshRef.current) {
      return pendingRefreshRef.current
    }

    lastRefreshTimeRef.current = now

    // 🚀 FIX: AbortController ile timeout
    abortControllerRef.current?.abort()
    abortControllerRef.current = new AbortController()

    const refreshPromise = (async () => {
      try {
        // 🚀 FIX: Timeout ile fetch
        const timeoutId = setTimeout(() => {
          abortControllerRef.current?.abort()
        }, REFRESH_TIMEOUT)

        const response = await fetch('/api/user/me', {
          credentials: 'include',
          signal: abortControllerRef.current?.signal
        })

        clearTimeout(timeoutId)

        if (response.ok) {
          const data = await response.json()
          setUser(data)
          setCachedUser(data) // 🚀 Cache'e yaz
        } else {
          if (response.status !== 401) {
            console.error('Unexpected error loading user:', response.status)
          }
          setUser(null)
          setCachedUser(null)
        }
      } catch (error) {
        // 🚀 FIX: Abort hatası sessizce geç
        if (error instanceof Error && error.name === 'AbortError') {
          console.warn('User refresh aborted (timeout)')
        } else {
          console.error('Network error loading user:', error)
        }
        // 🚀 Network hatası - cache'deki veriyi koru
      } finally {
        setInitialCheckDone(true)
        // 🚀 FIX: Promise'i temizle (finally'de her zaman çalışır)
        pendingRefreshRef.current = null
        abortControllerRef.current = null
      }
    })()

    pendingRefreshRef.current = refreshPromise
    return refreshPromise
  }, [])

  const logout = useCallback(async (reason?: 'timeout' | 'manual') => {
    try {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      // 🚀 FIX: Pending refresh'i iptal et
      abortControllerRef.current?.abort()
      pendingRefreshRef.current = null

      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      })
      setUser(null)
      setCachedUser(null) // 🚀 Cache temizle
    } catch (error) {
      console.error('Error logging out:', error)
    }
  }, [])

  const requireAuth = useCallback((redirectUrl: string): boolean => {
    if (!user && initialCheckDone) {
      setReturnUrl(redirectUrl)
      setShowLoginModal(true)
      return false
    }
    return !!user
  }, [user, initialCheckDone])

  const resetSessionTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    lastActivityRef.current = Date.now()
    if (user) {
      timeoutRef.current = setTimeout(() => {
        logout('timeout')
      }, SESSION_TIMEOUT)
    }
  }, [user, logout])

  useEffect(() => {
    if (!user) return

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click']

    const handleActivity = () => {
      const now = Date.now()
      const timeSinceLastActivity = now - lastActivityRef.current
      if (timeSinceLastActivity > 60000) {
        resetSessionTimeout()
      }
    }

    events.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true })
    })

    resetSessionTimeout()

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity)
      })
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [user, resetSessionTimeout])

  // 🚀 HYDRATION FIX + OPTIMISTIC UI:
  // Mount olduğunda cache'den oku ve hemen göster, API arka planda çalışsın
  useEffect(() => {
    if (!mounted) {
      setMounted(true)

      // 🚀 Cache'den hemen oku - ANINDA göster
      const cachedUser = getCachedUser()
      if (cachedUser) {
        setUser(cachedUser)
      }
      // Cache yoksa user=null kalır → "Giriş Yap" butonları hemen görünür

      // 🚀 Arka planda sessizce API'yi kontrol et
      refreshUser()
    }

    // 🚀 FIX: Cleanup - component unmount olunca abort et
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [mounted, refreshUser])

  const authState = useMemo(() => ({
    user,
    loading, // 🚀 Artık hep false, geriye dönük uyumluluk için tutuyoruz
    isAuthenticated: !!user,
    initialCheckDone,
  }), [user, loading, initialCheckDone])

  const authActions = useMemo(() => ({
    refreshUser,
    logout,
    requireAuth
  }), [refreshUser, logout, requireAuth])

  const modalState = useMemo(() => ({
    showLoginModal,
    showRegisterModal,
    showChannelModal,
    returnUrl,
    setShowLoginModal,
    setShowRegisterModal,
    setShowChannelModal,
    setReturnUrl,
  }), [showLoginModal, showRegisterModal, showChannelModal, returnUrl])

  return (
    <AuthStateContext.Provider value={authState}>
      <AuthActionsContext.Provider value={authActions}>
        <ModalContext.Provider value={modalState}>
          {children}
        </ModalContext.Provider>
      </AuthActionsContext.Provider>
    </AuthStateContext.Provider>
  )
}

export function useAuthState() {
  const context = useContext(AuthStateContext)
  if (context === undefined) {
    throw new Error('useAuthState must be used within an AuthProvider')
  }
  return context
}

export function useAuthActions() {
  const context = useContext(AuthActionsContext)
  if (context === undefined) {
    throw new Error('useAuthActions must be used within an AuthProvider')
  }
  return context
}

export function useModalState() {
  const context = useContext(ModalContext)
  if (context === undefined) {
    throw new Error('useModalState must be used within an AuthProvider')
  }
  return context
}

export const useModals = useModalState

export function useAuth() {
  const state = useAuthState()
  const actions = useAuthActions()
  const modals = useModalState()

  return {
    ...state,
    ...actions,
    ...modals
  }
}
