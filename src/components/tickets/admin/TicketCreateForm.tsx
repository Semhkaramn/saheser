'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, X, Infinity, ImagePlus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

// Mavi tema renkleri
const theme = {
  primary: '#3b82f6',
  primaryLight: '#60a5fa',
  primaryDark: '#2563eb',
  gradientFrom: '#3b82f6',
  gradientTo: '#1d4ed8',
  success: '#22c55e',
  danger: '#ef4444',
  card: 'rgba(15, 23, 42, 0.8)',
  border: 'rgba(71, 85, 105, 0.5)',
  text: '#f1f5f9',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  background: '#0f172a',
  backgroundSecondary: '#1e293b',
}

interface Sponsor {
  id: string
  name: string
  category: string
}

interface Prize {
  id?: string
  prizeAmount: number
  winnerCount: number
  order?: number
}

interface TicketCreateFormProps {
  sponsors: Sponsor[]
  onSuccess: () => void
  onCancel: () => void
}

export function TicketCreateForm({ sponsors, onSuccess, onCancel }: TicketCreateFormProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    sponsorId: '',
    totalTickets: 100,
    hasTotalTickets: true,
    ticketPrice: 100,
    imageUrl: '',
    imagePublicId: '',
    endDate: '',
    hasEndDate: true,
    requireApprovedSponsor: false,
  })
  const [uploading, setUploading] = useState(false)
  const [prizes, setPrizes] = useState<Prize[]>([{ prizeAmount: 1000, winnerCount: 1 }])
  const [creating, setCreating] = useState(false)
  const [submitHovered, setSubmitHovered] = useState(false)
  const [cancelHovered, setCancelHovered] = useState(false)

  function addPrize() {
    setPrizes([...prizes, { prizeAmount: 1000, winnerCount: 1 }])
  }

  function removePrize(index: number) {
    setPrizes(prizes.filter((_, i) => i !== index))
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Dosya boyutu en fazla 5MB olabilir')
      return
    }

    setUploading(true)
    try {
      const uploadFormData = new FormData()
      uploadFormData.append('file', file)
      uploadFormData.append('folder', 'tickets')

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: uploadFormData
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Yükleme başarısız')
      }

      const data = await res.json()
      setFormData(prev => ({ ...prev, imageUrl: data.url, imagePublicId: data.publicId }))
      toast.success('Görsel yüklendi')
    } catch (error: any) {
      toast.error(error.message || 'Görsel yüklenirken hata oluştu')
    } finally {
      setUploading(false)
    }
  }

  async function createEvent() {
    try {
      setCreating(true)
      const token = localStorage.getItem('admin_token')
      const res = await fetch('/api/admin/tickets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          sponsorId: formData.sponsorId,
          totalTickets: formData.hasTotalTickets ? formData.totalTickets : null,
          imageUrl: formData.imageUrl || null,
          requireApprovedSponsor: formData.requireApprovedSponsor,
          ticketPrice: formData.ticketPrice,
          endDate: formData.hasEndDate ? formData.endDate : null,
          prizes,
        }),
      })

      if (res.ok) {
        toast.success('Bilet etkinliği oluşturuldu')
        onSuccess()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Bilet etkinliği oluşturulamadı')
      }
    } catch (error) {
      console.error('Error creating event:', error)
      toast.error('Bilet etkinliği oluşturulurken hata oluştu')
    } finally {
      setCreating(false)
    }
  }

  const inputStyle = {
    background: theme.backgroundSecondary,
    border: `1px solid ${theme.border}`,
    color: theme.text,
    borderRadius: '0.5rem',
    padding: '0.5rem 0.75rem',
    width: '100%',
    fontSize: '0.875rem',
    outline: 'none',
  }

  const labelStyle = {
    color: theme.textSecondary,
    fontSize: '0.75rem',
    fontWeight: 500,
    marginBottom: '0.25rem',
    display: 'block',
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: theme.card,
        border: `1px solid ${theme.border}`,
      }}
    >
      <div className="p-4 space-y-3">
        <div
          className="flex justify-between items-center pb-3"
          style={{ borderBottom: `1px solid ${theme.border}` }}
        >
          <h3 className="text-lg font-bold" style={{ color: theme.text }}>Yeni Bilet Etkinliği</h3>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg transition-colors duration-200"
            style={{
              color: theme.textMuted,
              background: 'transparent'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = theme.backgroundSecondary
              e.currentTarget.style.color = theme.text
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = theme.textMuted
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <label style={labelStyle}>Bilet Görseli</label>
          {formData.imageUrl ? (
            <div
              className="relative w-full max-w-[180px] aspect-[2/1] rounded-xl overflow-hidden"
              style={{ background: theme.backgroundSecondary, border: `1px solid ${theme.border}` }}
            >
              <Image src={formData.imageUrl} alt="Önizleme" fill className="object-cover" />
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, imageUrl: '', imagePublicId: '' }))}
                className="absolute top-2 right-2 p-1.5 rounded-lg transition-all"
                style={{ background: 'rgba(0,0,0,0.6)', color: theme.textSecondary }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <label
              className="flex flex-col items-center justify-center w-full max-w-[180px] aspect-[2/1] rounded-xl cursor-pointer transition-all duration-200 hover:opacity-80"
              style={{ background: `${theme.backgroundSecondary}80`, border: `2px dashed ${theme.border}` }}
            >
              <div className="flex flex-col items-center justify-center py-2 px-2">
                {uploading ? (
                  <Loader2 className="w-5 h-5 mb-1 animate-spin" style={{ color: theme.primary }} />
                ) : (
                  <ImagePlus className="w-5 h-5 mb-1" style={{ color: theme.textMuted }} />
                )}
                <p className="text-[10px] font-medium text-center leading-tight" style={{ color: theme.textSecondary }}>
                  {uploading ? 'Yükleniyor...' : 'Görsel yükle'}
                </p>
              </div>
              <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={uploading} />
            </label>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label style={labelStyle}>Ana Başlık *</label>
            <input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              style={inputStyle}
              placeholder="Örn: 10.000 TL Bilet Çekilişi"
            />
          </div>

          <div>
            <label style={labelStyle}>Sponsor *</label>
            <Select value={formData.sponsorId} onValueChange={(val) => setFormData({ ...formData, sponsorId: val })}>
              <SelectTrigger
                style={{
                  ...inputStyle,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <SelectValue placeholder="Sponsor seçin" />
              </SelectTrigger>
              <SelectContent
                style={{
                  background: theme.backgroundSecondary,
                  border: `1px solid ${theme.border}`,
                }}
              >
                {sponsors.map(sponsor => (
                  <SelectItem key={sponsor.id} value={sponsor.id} style={{ color: theme.text }}>
                    {sponsor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <label style={labelStyle}>Açıklama</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            style={{
              ...inputStyle,
              minHeight: '80px',
              resize: 'vertical',
            }}
            placeholder="Bilet etkinliği açıklaması...&#10;Satır satır yazabilirsiniz."
            rows={3}
          />
          <p className="text-xs mt-1" style={{ color: theme.textMuted }}>
            Açıklama satır satır yazılabilir (Enter ile alt satıra geçebilirsiniz)
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <div className="flex items-center justify-between">
              <label style={labelStyle}>Toplam Bilet Sayısı {formData.hasTotalTickets && '*'}</label>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, hasTotalTickets: !formData.hasTotalTickets })}
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: '9999px',
                  background: formData.hasTotalTickets ? `${theme.primary}15` : `${theme.primary}30`,
                  color: theme.primaryLight,
                }}
              >
                {formData.hasTotalTickets ? 'Sınırsız Yap' : '✓ Sınırsız'}
              </button>
            </div>
            {formData.hasTotalTickets ? (
              <input
                type="number"
                value={formData.totalTickets}
                onChange={(e) => setFormData({ ...formData, totalTickets: e.target.value === '' ? '' as any : Number(e.target.value) })}
                style={inputStyle}
              />
            ) : (
              <div style={{ ...inputStyle, display: 'flex', alignItems: 'center', color: theme.textMuted }}>
                Sınırsız - sabit bir bilet sayısı duyurulmaz
              </div>
            )}
          </div>

          <div>
            <label style={labelStyle}>Bir Bilet Fiyatı (TL) *</label>
            <input
              type="number"
              value={formData.ticketPrice}
              onChange={(e) => setFormData({ ...formData, ticketPrice: e.target.value === '' ? '' as any : Number(e.target.value) })}
              style={inputStyle}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label style={{ ...labelStyle, marginBottom: 0 }}>Bitiş Tarihi</label>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, hasEndDate: !formData.hasEndDate, endDate: '' })}
                className="flex items-center gap-1 text-xs px-2 py-0.5 rounded transition-colors duration-200"
                style={{
                  background: formData.hasEndDate ? `${theme.primary}15` : `${theme.primary}30`,
                  color: theme.primaryLight,
                  border: `1px solid ${theme.primary}25`
                }}
              >
                <Infinity className="w-3 h-3" />
                {formData.hasEndDate ? 'Süresiz Yap' : 'Süresiz'}
              </button>
            </div>
            {formData.hasEndDate ? (
              <input
                type="datetime-local"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                style={inputStyle}
              />
            ) : (
              <div
                className="flex items-center justify-center gap-2 h-[38px] rounded-lg"
                style={{
                  background: `${theme.primary}10`,
                  border: `1px solid ${theme.primary}20`,
                  color: theme.primaryLight,
                  fontSize: '0.875rem',
                }}
              >
                <Infinity className="w-4 h-4" />
                <span>Süresiz Etkinlik</span>
              </div>
            )}
          </div>
        </div>

        {/* Onay Şartı */}
        <div
          className="flex items-center justify-between p-3 rounded-xl"
          style={{ background: theme.backgroundSecondary, border: `1px solid ${theme.border}` }}
        >
          <div>
            <p className="text-sm font-semibold" style={{ color: theme.text }}>Sadece onaylılar katılabilsin</p>
            <p className="text-xs" style={{ color: theme.textSecondary }}>Açıksa, sponsor bilgisi admin tarafından onaylanmamış kullanıcılar katılamaz</p>
          </div>
          <button
            type="button"
            onClick={() => setFormData({ ...formData, requireApprovedSponsor: !formData.requireApprovedSponsor })}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex-shrink-0"
            style={{
              background: formData.requireApprovedSponsor ? `${theme.primary}20` : theme.backgroundSecondary,
              color: formData.requireApprovedSponsor ? theme.primaryLight : theme.textMuted,
            }}
          >
            {formData.requireApprovedSponsor ? 'Açık' : 'Kapalı'}
          </button>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label style={labelStyle}>Ödüller *</label>
            <button
              type="button"
              onClick={addPrize}
              className="text-xs p-1.5 flex items-center gap-1 rounded-lg transition-colors duration-200"
              style={{
                background: `${theme.primary}15`,
                color: theme.primaryLight,
                border: `1px solid ${theme.primary}25`
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = `${theme.primaryDark}30`
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = `${theme.primary}15`
              }}
            >
              <Plus className="w-3 h-3" />
              Ödül Ekle
            </button>
          </div>

          <div className="space-y-2">
            {prizes.map((prize, index) => (
              <div key={index} className="flex gap-2 items-end">
                <div className="flex-1">
                  <label style={{ ...labelStyle, fontSize: '0.65rem' }}>Ödül Miktarı (TL)</label>
                  <input
                    type="number"
                    value={prize.prizeAmount}
                    onChange={(e) => {
                      const newPrizes = [...prizes]
                      newPrizes[index].prizeAmount = e.target.value === '' ? '' as any : Number(e.target.value)
                      setPrizes(newPrizes)
                    }}
                    style={inputStyle}
                  />
                </div>

                <div className="flex-1">
                  <label style={{ ...labelStyle, fontSize: '0.65rem' }}>Kazanan Sayısı</label>
                  <input
                    type="number"
                    value={prize.winnerCount}
                    onChange={(e) => {
                      const newPrizes = [...prizes]
                      newPrizes[index].winnerCount = e.target.value === '' ? '' as any : Number(e.target.value)
                      setPrizes(newPrizes)
                    }}
                    style={inputStyle}
                  />
                </div>

                {prizes.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removePrize(index)}
                    className="p-1.5 rounded-lg transition-colors duration-200"
                    style={{
                      background: `${theme.danger}15`,
                      color: theme.danger,
                      border: `1px solid ${theme.danger}25`
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = `${theme.danger}30`
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = `${theme.danger}15`
                    }}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-3">
          <button
            onClick={createEvent}
            disabled={creating}
            onMouseEnter={() => setSubmitHovered(true)}
            onMouseLeave={() => setSubmitHovered(false)}
            className="flex-1 py-2.5 text-sm font-semibold rounded-xl transition-colors duration-200 disabled:opacity-50"
            style={{
              background: submitHovered
                ? `linear-gradient(135deg, ${theme.primaryDark}, #1e40af)`
                : `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})`,
              color: 'white',
              boxShadow: `0 4px 12px ${theme.gradientFrom}30`
            }}
          >
            {creating ? 'Oluşturuluyor...' : 'Oluştur'}
          </button>
          <button
            onClick={onCancel}
            disabled={creating}
            onMouseEnter={() => setCancelHovered(true)}
            onMouseLeave={() => setCancelHovered(false)}
            className="flex-1 py-2.5 text-sm font-semibold rounded-xl transition-colors duration-200"
            style={{
              background: cancelHovered ? theme.backgroundSecondary : `${theme.backgroundSecondary}80`,
              color: cancelHovered ? theme.text : theme.textSecondary,
              border: `1px solid ${theme.border}`
            }}
          >
            İptal
          </button>
        </div>
      </div>
    </div>
  )
}
