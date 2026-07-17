'use client'

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useUserTheme } from '@/components/providers/user-theme-provider'
import { ThemedButton } from '@/components/ui/themed'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive'
}

export function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmText = 'Tamam',
  cancelText = 'İptal',
  variant = 'destructive'
}: ConfirmDialogProps) {
  const { theme } = useUserTheme()

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className="backdrop-blur-sm"
        style={{
          backgroundColor: `${theme.colors.card}F0`,
          borderColor: theme.colors.border
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle style={{ color: theme.colors.text }}>{title}</AlertDialogTitle>
          <AlertDialogDescription style={{ color: theme.colors.textSecondary }}>
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <ThemedButton
            onClick={() => onOpenChange(false)}
            variant="secondary"
            size="md"
          >
            {cancelText}
          </ThemedButton>
          <ThemedButton
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}
            variant="primary"
            size="md"
            style={variant === 'destructive' ? {
              background: `linear-gradient(to right, ${theme.colors.error}, #dc2626)`,
            } : undefined}
          >
            {confirmText}
          </ThemedButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
