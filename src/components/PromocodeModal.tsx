'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Gift, Star, Loader2, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/components/providers/auth-provider'
import { useUserTheme } from '@/components/providers/user-theme-provider'

interface PromocodeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function PromocodeModal({ open, onOpenChange }: PromocodeModalProps) {
  const { refreshUser } = useAuth()
  const { theme } = useUserTheme()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<{ points: number; balance: number } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim() || loading) return

    setLoading(true)
    setSuccess(null)

    try {
      const res = await fetch('/api/promocode/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: code.trim() })
      })

      const data = await res.json()

      if (res.ok) {
        setSuccess({
          points: data.pointsEarned,
          balance: data.newBalance
        })
        toast.success(data.message || 'Promocode başarıyla kullanıldı!')
        // Kullanıcı bilgilerini güncelle
        refreshUser()
        setCode('')
      } else {
        toast.error(data.error || 'Promocode kullanılamadı')
      }
    } catch (error) {
      console.error('Promocode hatası:', error)
      toast.error('Bir hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    setSuccess(null)
    setCode('')
    onOpenChange(false)
  }

  const dialogContentStyle = {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.cardBorder,
    color: theme.colors.text
  }

  const inputStyle = {
    backgroundColor: `${theme.colors.backgroundSecondary}80`,
    borderColor: theme.colors.border,
    color: theme.colors.text
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]" style={dialogContentStyle}>
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full" style={{ backgroundColor: `${theme.colors.accent}20` }}>
              <Gift className="w-8 h-8" style={{ color: theme.colors.accent }} />
            </div>
          </div>
          <DialogTitle className="text-2xl font-bold text-center" style={{ color: theme.colors.text }}>
            Promocode Kullan
          </DialogTitle>
          <DialogDescription className="text-center" style={{ color: theme.colors.textMuted }}>
            Kodunuzu girerek puan kazanın
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ backgroundColor: `${theme.colors.success}30` }}>
              <CheckCircle className="w-8 h-8" style={{ color: theme.colors.success }} />
            </div>
            <div>
              <p className="text-lg font-semibold mb-1" style={{ color: theme.colors.text }}>Tebrikler!</p>
              <div className="flex items-center justify-center gap-2 text-2xl font-bold" style={{ color: theme.colors.warning }}>
                <Star className="w-6 h-6" style={{ fill: theme.colors.warning }} />
                +{success.points} Puan
              </div>
              <p className="text-sm mt-2" style={{ color: theme.colors.textMuted }}>
                Yeni bakiyeniz: <span className="font-medium" style={{ color: theme.colors.text }}>{success.balance.toLocaleString()}</span> puan
              </p>
            </div>
            <div className="pt-4" style={{ borderTop: `1px solid ${theme.colors.border}` }}>
              <Button
                onClick={handleClose}
                className="w-full text-white"
                style={{ background: `linear-gradient(to right, ${theme.colors.gradientFrom}, ${theme.colors.gradientTo})` }}
              >
                Tamam
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label htmlFor="promocode" className="text-sm font-medium" style={{ color: theme.colors.textSecondary }}>
                  Promocode
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Gift className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: theme.colors.textMuted }} />
                    <Input
                      id="promocode"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      className="w-full pl-10 font-mono tracking-wider"
                      style={inputStyle}
                      placeholder="KODUNUZ"
                      disabled={loading}
                      autoFocus
                      autoComplete="off"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={!code.trim() || loading}
                    className="whitespace-nowrap px-6 text-white"
                    style={{ background: `linear-gradient(to right, ${theme.colors.gradientFrom}, ${theme.colors.gradientTo})` }}
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Gift className="mr-2 h-4 w-4" />
                        Kodu Kullan
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
