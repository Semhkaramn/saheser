'use client'

import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useUserTheme } from '@/components/providers/user-theme-provider'
import { ThemedButton } from '@/components/ui/themed'

interface PromptDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (value: string) => void
  title: string
  description: string
  label?: string
  placeholder?: string
  defaultValue?: string
  confirmText?: string
  cancelText?: string
}

export function PromptDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  label,
  placeholder = '',
  defaultValue = '',
  confirmText = 'Tamam',
  cancelText = 'İptal',
}: PromptDialogProps) {
  const { theme } = useUserTheme()
  const [value, setValue] = useState(defaultValue)

  const handleConfirm = () => {
    onConfirm(value)
    setValue(defaultValue)
  }

  const handleCancel = () => {
    setValue(defaultValue)
    onOpenChange(false)
  }

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
        <div className="py-4">
          {label && <Label style={{ color: theme.colors.text }} className="mb-2 block">{label}</Label>}
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className="border"
            style={{
              backgroundColor: theme.colors.backgroundSecondary,
              borderColor: theme.colors.border,
              color: theme.colors.text
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleConfirm()
              }
            }}
          />
        </div>
        <AlertDialogFooter>
          <ThemedButton
            onClick={handleCancel}
            variant="secondary"
            size="md"
          >
            {cancelText}
          </ThemedButton>
          <ThemedButton
            onClick={handleConfirm}
            variant="primary"
            size="md"
          >
            {confirmText}
          </ThemedButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
