'use client'

import { useAuth } from '@/components/providers/auth-provider'
import TelegramConnectionModal from '@/components/TelegramConnectionModal'

export default function TelegramModalWrapper() {
  const { showChannelModal, setShowChannelModal, refreshUser } = useAuth()

  const handleClose = () => {
    setShowChannelModal(false)
  }

  const handleSuccess = () => {
    refreshUser()
    setShowChannelModal(false)
  }

  return (
    <TelegramConnectionModal
      isOpen={showChannelModal}
      onClose={handleClose}
      onSuccess={handleSuccess}
    />
  )
}
