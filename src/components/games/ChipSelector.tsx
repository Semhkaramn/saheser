'use client'

import { useUserTheme } from '@/components/providers/user-theme-provider'
import { hexToRgba } from '@/components/ui/themed'
import { X } from 'lucide-react'

// Gerçek kumarhane fişi renk kodları (yaygın standart)
const CHIP_STYLES: Record<number, { bg: string; ring: string }> = {
  10: { bg: 'radial-gradient(circle at 35% 30%, #f8fafc, #cbd5e1 70%, #94a3b8)', ring: '#64748b' },
  25: { bg: 'radial-gradient(circle at 35% 30%, #4ade80, #16a34a 70%, #14532d)', ring: '#166534' },
  50: { bg: 'radial-gradient(circle at 35% 30%, #60a5fa, #2563eb 70%, #1e3a8a)', ring: '#1d4ed8' },
  100: { bg: 'radial-gradient(circle at 35% 30%, #3f3f46, #18181b 70%, #000)', ring: '#d4af37' },
  500: { bg: 'radial-gradient(circle at 35% 30%, #c084fc, #9333ea 70%, #4c1d95)', ring: '#a855f7' },
  1000: { bg: 'radial-gradient(circle at 35% 30%, #fbbf24, #b45309 70%, #78350f)', ring: '#fbbf24' },
}

function formatChip(v: number) {
  return v >= 1000 ? `${v / 1000}k` : String(v)
}

interface ChipSelectorProps {
  value: number
  onChange: (next: number) => void
  denominations?: number[]
  max?: number
  disabled?: boolean
}

export default function ChipSelector({ value, onChange, denominations = [10, 25, 50, 100, 500], max, disabled }: ChipSelectorProps) {
  const { theme } = useUserTheme()

  const addChip = (v: number) => {
    if (disabled) return
    const next = value + v
    onChange(max !== undefined ? Math.min(next, max) : next)
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Aktif bahis - fiş yığını görünümü */}
      <div className="relative w-16 h-16">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="absolute inset-0 rounded-full border-2"
            style={{
              background: value > 0 ? CHIP_STYLES[denominations[denominations.length - 1]]?.bg ?? CHIP_STYLES[10].bg : 'rgba(255,255,255,0.05)',
              borderColor: value > 0 ? CHIP_STYLES[denominations[denominations.length - 1]]?.ring ?? '#64748b' : hexToRgba(theme.colors.border, 0.4),
              transform: `translateY(${-i * 3}px)`,
              opacity: value > 0 ? 1 - i * 0.15 : 0.4,
            }}
          />
        ))}
        <div
          className="absolute inset-0 rounded-full border-2 flex items-center justify-center font-black text-sm"
          style={{
            borderColor: 'rgba(255,255,255,0.5)',
            color: value > 0 ? '#fff' : theme.colors.textMuted,
          }}
        >
          {value > 0 ? value.toLocaleString('tr-TR') : '0'}
        </div>
        {value > 0 && !disabled && (
          <button
            onClick={() => onChange(0)}
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border"
            style={{ backgroundColor: theme.colors.card, borderColor: hexToRgba(theme.colors.border, 0.6) }}
            title="Bahsi temizle"
          >
            <X className="w-3 h-3" style={{ color: theme.colors.textMuted }} />
          </button>
        )}
      </div>

      {/* Fiş seçenekleri */}
      <div className="flex items-center gap-2 flex-wrap justify-center">
        {denominations.map((d) => {
          const style = CHIP_STYLES[d] ?? CHIP_STYLES[10]
          const affordable = max === undefined || value + d <= max
          return (
            <button
              key={d}
              onClick={() => addChip(d)}
              disabled={disabled || !affordable}
              className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-full border-2 flex items-center justify-center font-black text-[11px] sm:text-xs text-white transition-transform active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed hover:-translate-y-0.5"
              style={{
                background: style.bg,
                borderColor: style.ring,
                boxShadow: '0 3px 8px rgba(0,0,0,0.35)',
              }}
            >
              <span className="absolute inset-1 rounded-full border border-dashed border-white/40" />
              {formatChip(d)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
