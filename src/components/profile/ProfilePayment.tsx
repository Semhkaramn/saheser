'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Wallet, Building2, Edit2, Save, X, AlertCircle, CheckCircle2, Search, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useUserTheme } from '@/components/providers/user-theme-provider'
import { normalizeForSearch, optimizeCloudinaryImage } from '@/lib/utils'

interface Sponsor {
  id: string
  name: string
  identifierType: string
  logoUrl?: string
}

interface UserSponsorInfo {
  id: string
  identifier: string
  status?: string
  sponsor: Sponsor
}

interface ProfilePaymentProps {
  walletAddress?: string
  sponsorInfos: UserSponsorInfo[]
  allSponsors: Sponsor[]
  onUpdate: () => Promise<void>
}

export default function ProfilePayment({
  walletAddress,
  sponsorInfos,
  allSponsors,
  onUpdate
}: ProfilePaymentProps) {
  const { theme, card, button } = useUserTheme()
  const [editingWallet, setEditingWallet] = useState(false)
  const [walletInput, setWalletInput] = useState(walletAddress || '')

  // walletAddress prop değiştiğinde walletInput'u güncelle
  useEffect(() => {
    setWalletInput(walletAddress || '')
  }, [walletAddress])

  const [editingSponsor, setEditingSponsor] = useState<string | null>(null)
  const [sponsorInput, setSponsorInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  async function saveWallet() {
    if (!walletInput.trim()) {
      toast.error('Cüzdan adresi boş olamaz')
      return
    }

    if (!walletInput.startsWith('T') || walletInput.length !== 34) {
      toast.error('Geçersiz TRC20 cüzdan adresi')
      return
    }

    try {
      const response = await fetch('/api/user/wallet', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: walletInput })
      })

      if (response.ok) {
        await onUpdate()
        setEditingWallet(false)
        toast.success('Cüzdan adresi kaydedildi')
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || 'Kaydetme başarısız')
      }
    } catch (error) {
      console.error('Cüzdan kaydetme hatası:', error)
      toast.error('Bir hata oluştu')
    }
  }

  async function deleteWallet() {
    try {
      const response = await fetch('/api/user/wallet', {
        method: 'DELETE',
        credentials: 'include'
      })
      if (response.ok) {
        setWalletInput('')
        setEditingWallet(false)
        await onUpdate()
        toast.success('Cüzdan adresi silindi')
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || 'Bir hata oluştu')
      }
    } catch (error) {
      toast.error('Bir hata oluştu')
    }
  }

  async function saveSponsorInfo(sponsorId: string) {
    if (!sponsorInput.trim()) {
      toast.error('Bilgi boş olamaz')
      return
    }

    const sponsor = allSponsors.find(s => s.id === sponsorId)
    if (!sponsor) return

    if (sponsor.identifierType === 'id' && !/^\d+$/.test(sponsorInput.trim())) {
      toast.error('ID sadece sayılardan oluşmalıdır')
      return
    }

    if (sponsor.identifierType === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sponsorInput.trim())) {
      toast.error('Geçerli bir email adresi giriniz')
      return
    }

    try {
      const response = await fetch('/api/user/sponsor-info', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sponsorId, identifier: sponsorInput.trim() })
      })

      if (response.ok) {
        await onUpdate()
        setEditingSponsor(null)
        setSponsorInput('')
        toast.success('Sponsor bilgisi kaydedildi')
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || 'Bir hata oluştu')
      }
    } catch (error) {
      toast.error('Bir hata oluştu')
    }
  }

  async function deleteSponsorInfo(sponsorId: string) {
    try {
      const response = await fetch('/api/user/sponsor-info', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sponsorId })
      })

      if (response.ok) {
        await onUpdate()
        toast.success('Sponsor bilgisi silindi')
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || 'Bir hata oluştu')
      }
    } catch (error) {
      toast.error('Bir hata oluştu')
    }
  }

  const getIdentifierLabel = (type: string) => {
    switch (type) {
      case 'username': return 'Kullanıcı Adı'
      case 'id': return 'ID'
      case 'email': return 'Email'
      default: return 'Bilgi'
    }
  }

  // Bot admin'in gruptaki 3-4 butonlu onay kartından verdiği kararı burada
  // gösteriyoruz - eskiden bu bilgi hiç görünmüyordu, kullanıcı durumunu
  // bilmeden bekliyordu.
  const getStatusInfo = (status?: string) => {
    switch (status) {
      case 'approved':
        return { label: 'Ref Geçildi ✅', color: theme.colors.success }
      case 'rejected':
        return { label: 'Onaylanmadı ❌', color: theme.colors.error }
      case 'post_deposit':
        return { label: 'Yatırım Sonrası Tekrar Bildirin 💰', color: theme.colors.warning }
      case 'incorrect':
        return { label: 'Bilgi Hatalı - Düzeltip Tekrar Gönderin ⚠️', color: theme.colors.error }
      case 'pending':
      default:
        return { label: 'Onay Bekliyor ⏳', color: theme.colors.textMuted }
    }
  }

  const shouldShowWallet = !searchQuery ||
    'cüzdan'.includes(normalizeForSearch(searchQuery)) ||
    'wallet'.includes(normalizeForSearch(searchQuery)) ||
    'trc20'.includes(normalizeForSearch(searchQuery)) ||
    (walletAddress && normalizeForSearch(walletAddress).includes(normalizeForSearch(searchQuery)))

  const filteredSponsorInfos = sponsorInfos.filter(info =>
    !searchQuery ||
    normalizeForSearch(info.sponsor.name).includes(normalizeForSearch(searchQuery)) ||
    normalizeForSearch(info.identifier).includes(normalizeForSearch(searchQuery))
  )

  // All sponsors that user hasn't added yet
  const remainingSponsors = allSponsors.filter(sponsor =>
    !sponsorInfos.some(info => info.sponsor.id === sponsor.id) &&
    (!searchQuery || normalizeForSearch(sponsor.name).includes(normalizeForSearch(searchQuery)))
  )

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5"
          style={{ color: theme.colors.textMuted }}
        />
        <Input
          type="text"
          name="search"
          placeholder="Cüzdan veya sponsor ara..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 sm:pl-10 text-sm border"
          style={{
            backgroundColor: `${theme.colors.text}06`,
            borderColor: theme.colors.border,
            color: theme.colors.text
          }}
        />
      </div>

      {/* Grid Layout - All Payment Methods */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        {/* TRC20 Wallet Card - Always First */}
        {shouldShowWallet && (
          <Card
            className="transition-all border"
            style={{
              background: `linear-gradient(135deg, ${theme.colors.success}10, ${theme.colors.success}15)`,
              borderColor: `${theme.colors.success}30`
            }}
          >
            <div className="p-3 sm:p-4">
              <div className="flex flex-col gap-3">
                {/* Icon */}
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0 border"
                    style={{
                      backgroundColor: `${theme.colors.success}20`,
                      borderColor: `${theme.colors.success}30`
                    }}
                  >
                    <Wallet className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: theme.colors.success }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm sm:text-base flex items-center gap-2" style={{ color: theme.colors.text }}>
                      TRC20 Cüzdan
                      {walletAddress && <CheckCircle2 className="w-4 h-4" style={{ color: theme.colors.success }} />}
                    </h3>
                    <p className="text-xs" style={{ color: theme.colors.textMuted }}>Ödeme almak için</p>
                  </div>
                </div>

                {!editingWallet ? (
                  <>
                    {walletAddress ? (
                      <div
                        className="rounded-lg p-2 sm:p-2.5 border"
                        style={{
                          backgroundColor: `${theme.colors.text}08`,
                          borderColor: `${theme.colors.border}50`
                        }}
                      >
                        <p className="font-mono text-xs break-all" style={{ color: theme.colors.text }}>{walletAddress}</p>
                      </div>
                    ) : (
                      <div
                        className="rounded-lg p-2 flex items-center gap-2 border"
                        style={{
                          backgroundColor: theme.colors.warningBg,
                          borderColor: `${theme.colors.warning}30`
                        }}
                      >
                        <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: theme.colors.warning }} />
                        <p className="text-xs" style={{ color: theme.colors.warning }}>Cüzdan eklenmemiş</p>
                      </div>
                    )}

                    <div className="flex gap-1.5 sm:gap-2">
                      {walletAddress ? (
                        <div
                          className="flex-1 flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-lg"
                          style={{ background: `${theme.colors.success}12`, color: theme.colors.success }}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                          Kaydedildi - sadece yönetici değiştirebilir/kaldırabilir
                        </div>
                      ) : (
                        <Button
                          onClick={() => {
                            setEditingWallet(true)
                            setWalletInput('')
                          }}
                          size="sm"
                          variant="outline"
                          className="flex-1 text-xs sm:text-sm h-8"
                          style={{
                            borderColor: `${theme.colors.success}50`,
                            color: theme.colors.success
                          }}
                        >
                          <Edit2 className="w-3 h-3 mr-1.5" />
                          Ekle
                        </Button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    <div>
                      <Label htmlFor="wallet" className="text-xs sm:text-sm" style={{ color: theme.colors.text }}>TRC20 Cüzdan Adresi</Label>
                      <Input
                        id="wallet"
                        name="walletAddress"
                        value={walletInput}
                        onChange={(e) => setWalletInput(e.target.value)}
                        placeholder="T..."
                        className="font-mono text-xs sm:text-sm h-8 sm:h-9 border"
                        style={{
                          backgroundColor: `${theme.colors.text}06`,
                          borderColor: theme.colors.border,
                          color: theme.colors.text
                        }}
                      />
                      <p className="text-[10px] mt-1" style={{ color: theme.colors.textMuted }}>T ile başlamalı, 34 karakter</p>
                    </div>
                    <div className="flex gap-1.5 sm:gap-2">
                      <Button
                        onClick={saveWallet}
                        size="sm"
                        className="flex-1 text-xs sm:text-sm h-8"
                        style={{ backgroundColor: theme.colors.success }}
                      >
                        <Save className="w-3 h-3 mr-1.5" />
                        Kaydet
                      </Button>
                      <Button
                        onClick={() => {
                          setEditingWallet(false)
                          setWalletInput(walletAddress || '')
                        }}
                        size="sm"
                        variant="outline"
                        className="h-8"
                        style={{
                          borderColor: theme.colors.border,
                          color: theme.colors.textMuted
                        }}
                      >
                        <X className="w-3 h-3 mr-1.5" />
                        İptal
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Existing Sponsor Cards */}
        {filteredSponsorInfos.map(info => (
          <Card
            key={info.id}
            className="transition-all border"
            style={{
              background: `linear-gradient(135deg, ${theme.colors.primary}10, ${theme.colors.primary}15)`,
              borderColor: `${theme.colors.primary}30`
            }}
          >
            <div className="p-3 sm:p-4">
              <div className="flex flex-col gap-3">
                {/* Header with Logo */}
                <div className="flex items-center gap-3">
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 border overflow-hidden p-1"
                    style={{
                      borderColor: `${theme.colors.primary}30`,
                      backgroundColor: `${theme.colors.primary}20`
                    }}
                  >
                    {info.sponsor.logoUrl ? (
                      <img
                        src={optimizeCloudinaryImage(info.sponsor.logoUrl, 80, 80)}
                        alt={info.sponsor.name}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <Building2 className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: theme.colors.primary }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm sm:text-base truncate flex items-center gap-2" style={{ color: theme.colors.text }}>
                      {info.sponsor.name}
                    </h3>
                    <p className="text-xs" style={{ color: theme.colors.textMuted }}>{getIdentifierLabel(info.sponsor.identifierType)}</p>
                    <p className="text-xs font-semibold mt-0.5" style={{ color: getStatusInfo(info.status).color }}>
                      {getStatusInfo(info.status).label}
                    </p>
                  </div>
                </div>

                {editingSponsor === info.sponsor.id ? (
                  <div className="space-y-2">
                    <Input
                      name="sponsorInfo"
                      value={sponsorInput}
                      onChange={(e) => setSponsorInput(e.target.value)}
                      placeholder={getIdentifierLabel(info.sponsor.identifierType)}
                      className="text-xs sm:text-sm h-8 sm:h-9 border"
                      style={{
                        backgroundColor: `${theme.colors.text}06`,
                        borderColor: theme.colors.border,
                        color: theme.colors.text
                      }}
                    />
                    <div className="flex gap-1.5 sm:gap-2">
                      <Button
                        onClick={() => saveSponsorInfo(info.sponsor.id)}
                        size="sm"
                        className="flex-1 text-xs sm:text-sm h-8"
                        style={{ backgroundColor: theme.colors.primary }}
                      >
                        <Save className="w-3 h-3 mr-1.5" />
                        Kaydet
                      </Button>
                      <Button
                        onClick={() => {
                          setEditingSponsor(null)
                          setSponsorInput('')
                        }}
                        size="sm"
                        variant="outline"
                        className="h-8"
                        style={{ borderColor: theme.colors.border }}
                      >
                        <X className="w-3 h-3 mr-1.5" />
                        İptal
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div
                      className="rounded-lg p-2 sm:p-2.5 border"
                      style={{
                        backgroundColor: `${theme.colors.text}08`,
                        borderColor: `${theme.colors.border}50`
                      }}
                    >
                      <p className="text-xs font-mono break-all" style={{ color: theme.colors.text }}>{info.identifier}</p>
                    </div>

                    <div className="flex gap-1.5 sm:gap-2">
                      {['incorrect', 'post_deposit'].includes(info.status || '') ? (
                        <>
                          <Button
                            onClick={() => {
                              setEditingSponsor(info.sponsor.id)
                              setSponsorInput(info.identifier)
                            }}
                            size="sm"
                            variant="outline"
                            className="flex-1 text-xs sm:text-sm h-8"
                            style={{
                              borderColor: `${theme.colors.primary}50`,
                              color: theme.colors.primary
                            }}
                          >
                            <Edit2 className="w-3 h-3 mr-1.5" />
                            Düzenle
                          </Button>
                          <Button
                            onClick={() => deleteSponsorInfo(info.sponsor.id)}
                            size="sm"
                            variant="outline"
                            className="h-8"
                            style={{
                              borderColor: `${theme.colors.error}50`,
                              color: theme.colors.error
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </>
                      ) : (
                        <div
                          className="flex-1 flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-lg"
                          style={{ background: `${theme.colors.textMuted}12`, color: theme.colors.textMuted }}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                          {info.status === 'approved'
                            ? 'Onaylandı - sadece yönetici kaldırabilir'
                            : info.status === 'rejected'
                            ? 'Onaylanmadı - sadece yönetici kaldırabilir'
                            : 'Onay bekliyor - sadece yönetici kaldırabilir'}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </Card>
        ))}

        {/* Remaining Sponsors - Show directly in grid - Same theme as TRC20 */}
        {remainingSponsors.map(sponsor => (
          <Card
            key={sponsor.id}
            className="transition-all border"
            style={{
              background: `linear-gradient(135deg, ${theme.colors.primary}10, ${theme.colors.primary}15)`,
              borderColor: `${theme.colors.primary}30`
            }}
          >
            <div className="p-3 sm:p-4">
              <div className="flex flex-col gap-3">
                {/* Header with Logo */}
                <div className="flex items-center gap-3">
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 border overflow-hidden p-1"
                    style={{
                      borderColor: `${theme.colors.primary}30`,
                      backgroundColor: `${theme.colors.primary}20`
                    }}
                  >
                    {sponsor.logoUrl ? (
                      <img
                        src={optimizeCloudinaryImage(sponsor.logoUrl, 80, 80)}
                        alt={sponsor.name}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <Building2 className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: theme.colors.primary }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm sm:text-base truncate" style={{ color: theme.colors.text }}>
                      {sponsor.name}
                    </h3>
                    <p className="text-xs" style={{ color: theme.colors.textMuted }}>{getIdentifierLabel(sponsor.identifierType)}</p>
                  </div>
                </div>

                {editingSponsor === sponsor.id ? (
                  <div className="space-y-2">
                    <Input
                      name="sponsorInfo"
                      value={sponsorInput}
                      onChange={(e) => setSponsorInput(e.target.value)}
                      placeholder={`${getIdentifierLabel(sponsor.identifierType)} girin`}
                      className="text-xs sm:text-sm h-8 sm:h-9 border"
                      style={{
                        backgroundColor: `${theme.colors.text}06`,
                        borderColor: theme.colors.border,
                        color: theme.colors.text
                      }}
                    />
                    <div className="flex gap-1.5 sm:gap-2">
                      <Button
                        onClick={() => saveSponsorInfo(sponsor.id)}
                        size="sm"
                        className="flex-1 text-xs sm:text-sm h-8"
                        style={{ backgroundColor: theme.colors.primary }}
                      >
                        <Save className="w-3 h-3 mr-1.5" />
                        Kaydet
                      </Button>
                      <Button
                        onClick={() => {
                          setEditingSponsor(null)
                          setSponsorInput('')
                        }}
                        size="sm"
                        variant="outline"
                        className="h-8"
                        style={{ borderColor: theme.colors.border }}
                      >
                        <X className="w-3 h-3 mr-1.5" />
                        İptal
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Yellow warning style like TRC20 */}
                    <div
                      className="rounded-lg p-2 flex items-center gap-2 border"
                      style={{
                        backgroundColor: theme.colors.warningBg,
                        borderColor: `${theme.colors.warning}30`
                      }}
                    >
                      <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: theme.colors.warning }} />
                      <p className="text-xs" style={{ color: theme.colors.warning }}>Bilgi eklenmemiş</p>
                    </div>

                    <Button
                      onClick={() => {
                        setEditingSponsor(sponsor.id)
                        setSponsorInput('')
                      }}
                      size="sm"
                      variant="outline"
                      className="w-full text-xs sm:text-sm h-8"
                      style={{
                        borderColor: `${theme.colors.primary}50`,
                        color: theme.colors.primary
                      }}
                    >
                      <Plus className="w-3 h-3 mr-1.5" />
                      Ekle
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* No Results Message */}
      {searchQuery && !shouldShowWallet && filteredSponsorInfos.length === 0 && remainingSponsors.length === 0 && (
        <div
          className="rounded-lg p-4 text-center text-sm border"
          style={{
            backgroundColor: `${theme.colors.text}06`,
            borderColor: theme.colors.border,
            color: theme.colors.textMuted
          }}
        >
          Arama sonucu bulunamadı
        </div>
      )}
    </div>
  )
}
