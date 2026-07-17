'use client'

import { useState, useCallback } from 'react'
import { useAuth } from '@/components/providers/auth-provider'

interface VerificationStatus {
  telegramConnected: boolean
  emailVerified: boolean
  isFullyVerified: boolean
  needsTelegram: boolean
  needsEmail: boolean
}

interface UseVerificationReturn extends VerificationStatus {
  showVerificationModal: boolean
  pendingAction: (() => void) | null
  actionName: string
  openVerificationModal: (actionName?: string) => void
  closeVerificationModal: () => void
  /**
   * Doğrulama kontrolü yapar ve gerekli ise modal açar
   * @param action - Doğrulama tamamlandığında çalıştırılacak fonksiyon
   * @param actionName - Modal'da gösterilecek işlem adı
   * @returns boolean - true = doğrulanmış, false = doğrulanmamış (modal açıldı)
   */
  requireVerification: (action: () => void, actionName?: string) => boolean
  /**
   * Sadece doğrulama durumunu kontrol eder, modal açmaz
   * @returns boolean - true = tam doğrulanmış, false = doğrulanmamış
   */
  checkVerification: () => boolean
}

export function useVerification(): UseVerificationReturn {
  const { user } = useAuth()
  const [showVerificationModal, setShowVerificationModal] = useState(false)
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)
  const [actionName, setActionName] = useState('bu işlemi gerçekleştirmek')

  const telegramConnected = !!user?.telegramId
  const emailVerified = !!user?.emailVerified
  const isFullyVerified = telegramConnected && emailVerified
  const needsTelegram = !telegramConnected
  const needsEmail = !emailVerified

  const openVerificationModal = useCallback((name: string = 'bu işlemi gerçekleştirmek') => {
    setActionName(name)
    setShowVerificationModal(true)
  }, [])

  const closeVerificationModal = useCallback(() => {
    setShowVerificationModal(false)
    setPendingAction(null)
  }, [])

  const requireVerification = useCallback((action: () => void, name: string = 'bu işlemi gerçekleştirmek'): boolean => {
    if (isFullyVerified) {
      return true
    }

    setPendingAction(() => action)
    setActionName(name)
    setShowVerificationModal(true)
    return false
  }, [isFullyVerified])

  const checkVerification = useCallback((): boolean => {
    return isFullyVerified
  }, [isFullyVerified])

  return {
    telegramConnected,
    emailVerified,
    isFullyVerified,
    needsTelegram,
    needsEmail,
    showVerificationModal,
    pendingAction,
    actionName,
    openVerificationModal,
    closeVerificationModal,
    requireVerification,
    checkVerification
  }
}
