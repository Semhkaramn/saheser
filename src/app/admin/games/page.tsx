'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Gamepad2, Loader2, TrendingUp, TrendingDown, Search, Settings2, X } from 'lucide-react'
import { toast } from 'sonner'

const theme = {
  gradientFrom: '#3b82f6',
  gradientTo: '#1d4ed8',
  success: '#22c55e',
  danger: '#ef4444',
  warning: '#f59e0b',
  card: 'rgba(30, 41, 59, 0.8)',
  border: 'rgba(71, 85, 105, 0.5)',
  text: '#f1f5f9',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  backgroundSecondary: '#1e293b',
}

const GAME_LABELS: Record<string, string> = {
  mines: 'Mines',
  dice: 'Zar',
  roulette: 'Rulet',
  blackjack: 'Blackjack',
}

const RESULT_LABELS: Record<string, { label: string; color: string }> = {
  win: { label: 'Kazandı', color: theme.success },
  lose: { label: 'Kaybetti', color: theme.danger },
  cashout: { label: 'Nakite Çevirdi', color: theme.warning },
  pending: { label: 'Devam Ediyor', color: theme.textMuted },
}

interface GamePlayItem {
  id: string
  userId: string
  gameType: string
  betAmount: number
  payout: number
  netChange: number
  multiplier: number | null
  result: string
  createdAt: string
  user: { id: string; siteUsername: string | null; email: string | null }
}

interface GameStat {
  gameType: string
  totalPlays: number
  wins: number
  pushes: number
  losses: number
  totalBet: number
  totalPayout: number
  netHouseResult: number
  rtp: number
}

interface GameSettingsItem {
  gameType: string
  isEnabled: boolean
  minBet: number
  maxBet: number
  houseEdgePercent: number
}

export default function AdminGamesPage() {
  const router = useRouter()
  const [items, setItems] = useState<GamePlayItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(25)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<GameStat[]>([])
  const [last24h, setLast24h] = useState(0)

  const [gameTypeFilter, setGameTypeFilter] = useState('')
  const [resultFilter, setResultFilter] = useState('')
  const [userFilter, setUserFilter] = useState('')

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settings, setSettings] = useState<GameSettingsItem[]>([])
  const [savingSettings, setSavingSettings] = useState(false)

  const authHeader = useCallback(() => {
    const token = localStorage.getItem('admin_token')
    return { Authorization: `Bearer ${token}` }
  }, [])

  const loadHistory = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        ...(gameTypeFilter ? { gameType: gameTypeFilter } : {}),
        ...(resultFilter ? { result: resultFilter } : {}),
        ...(userFilter ? { user: userFilter } : {}),
      })
      const res = await fetch(`/api/admin/games/history?${params}`, { headers: authHeader() })
      if (res.status === 403) {
        toast.error('Bu sayfaya erişim yetkiniz yok')
        router.push('/admin/dashboard')
        return
      }
      const data = await res.json()
      setItems(data.items || [])
      setTotal(data.total || 0)
    } catch {
      toast.error('Geçmiş yüklenemedi')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, gameTypeFilter, resultFilter, userFilter, authHeader, router])

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/games/stats', { headers: authHeader() })
      const data = await res.json()
      setStats(data.stats || [])
      setLast24h(data.last24hPlays || 0)
    } catch {
      // sessiz geç
    }
  }, [authHeader])

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/games/settings', { headers: authHeader() })
      const data = await res.json()
      setSettings(data.settings || [])
    } catch {
      toast.error('Ayarlar yüklenemedi')
    }
  }, [authHeader])

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (!token) {
      router.push('/admin')
      return
    }
    loadStats()
  }, [loadStats, router])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  const saveSetting = async (setting: GameSettingsItem) => {
    setSavingSettings(true)
    try {
      const res = await fetch('/api/admin/games/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify(setting),
      })
      if (!res.ok) throw new Error()
      toast.success(`${GAME_LABELS[setting.gameType]} ayarları güncellendi`)
      loadStats()
    } catch {
      toast.error('Ayar güncellenemedi')
    } finally {
      setSavingSettings(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})` }}
          >
            <Gamepad2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: theme.text }}>Oyunlar</h1>
            <p className="text-sm" style={{ color: theme.textMuted }}>
              Mines, Zar, Rulet, Blackjack — geçmiş, istatistik ve ayarlar
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setSettingsOpen(true)
            loadSettings()
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold"
          style={{ borderColor: theme.border, color: theme.text }}
        >
          <Settings2 className="w-4 h-4" /> Oyun Ayarları
        </button>
      </div>

      {/* İstatistik kartları */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.gameType} className="rounded-2xl border p-4" style={{ backgroundColor: theme.card, borderColor: theme.border }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold" style={{ color: theme.text }}>{GAME_LABELS[s.gameType]}</span>
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: s.netHouseResult >= 0 ? `${theme.success}22` : `${theme.danger}22`,
                  color: s.netHouseResult >= 0 ? theme.success : theme.danger,
                }}
              >
                {s.netHouseResult >= 0 ? 'Site +' : 'Kullanıcı +'}
              </span>
            </div>
            <div className="text-2xl font-black mb-1" style={{ color: theme.text }}>
              {s.totalPlays.toLocaleString('tr-TR')} <span className="text-sm font-normal" style={{ color: theme.textMuted }}>el</span>
            </div>
            <div className="flex items-center gap-3 text-xs" style={{ color: theme.textSecondary }}>
              <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" style={{ color: theme.success }} /> {s.wins}</span>
              <span className="flex items-center gap-1"><TrendingDown className="w-3 h-3" style={{ color: theme.danger }} /> {s.losses}</span>
              {s.pushes > 0 && <span style={{ color: theme.textMuted }}>{s.pushes} berabere</span>}
              <span>RTP: %{s.rtp.toFixed(1)}</span>
            </div>
            <div className="text-xs mt-1.5" style={{ color: theme.textMuted }}>
              Net: {Math.abs(s.netHouseResult).toLocaleString('tr-TR')} puan {s.netHouseResult >= 0 ? '(site lehine)' : '(kullanıcı lehine)'}
            </div>
          </div>
        ))}
        <div className="rounded-2xl border p-4 flex flex-col justify-center items-center sm:col-span-2 lg:col-span-4" style={{ backgroundColor: theme.card, borderColor: theme.border }}>
          <span className="text-xs uppercase tracking-wide" style={{ color: theme.textMuted }}>Son 24 saat</span>
          <span className="text-3xl font-black" style={{ color: theme.text }}>{last24h}</span>
          <span className="text-xs" style={{ color: theme.textMuted }}>el oynandı</span>
        </div>
      </div>

      {/* Filtreler */}
      <div className="rounded-2xl border p-4 flex flex-wrap gap-3 items-center" style={{ backgroundColor: theme.card, borderColor: theme.border }}>
        <select
          value={gameTypeFilter}
          onChange={(e) => { setGameTypeFilter(e.target.value); setPage(1) }}
          className="px-3 py-2 rounded-lg border text-sm bg-transparent"
          style={{ borderColor: theme.border, color: theme.text }}
        >
          <option value="" style={{ color: '#000' }}>Tüm Oyunlar</option>
          {Object.entries(GAME_LABELS).map(([k, v]) => (
            <option key={k} value={k} style={{ color: '#000' }}>{v}</option>
          ))}
        </select>
        <select
          value={resultFilter}
          onChange={(e) => { setResultFilter(e.target.value); setPage(1) }}
          className="px-3 py-2 rounded-lg border text-sm bg-transparent"
          style={{ borderColor: theme.border, color: theme.text }}
        >
          <option value="" style={{ color: '#000' }}>Tüm Sonuçlar</option>
          {Object.entries(RESULT_LABELS).map(([k, v]) => (
            <option key={k} value={k} style={{ color: '#000' }}>{v.label}</option>
          ))}
        </select>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: theme.textMuted }} />
          <input
            value={userFilter}
            onChange={(e) => { setUserFilter(e.target.value); setPage(1) }}
            placeholder="Kullanıcı adı veya e-posta ara..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border text-sm bg-transparent"
            style={{ borderColor: theme.border, color: theme.text }}
          />
        </div>
      </div>

      {/* Geçmiş tablosu */}
      <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: theme.card, borderColor: theme.border }}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: theme.textMuted }} />
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-sm" style={{ color: theme.textMuted }}>Kayıt bulunamadı</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                  {['Kullanıcı', 'Oyun', 'Bahis', 'Çarpan', 'Kazanç', 'Net', 'Sonuç', 'Tarih'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-semibold" style={{ color: theme.textMuted }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const resultInfo = RESULT_LABELS[item.result] || RESULT_LABELS.pending
                  return (
                    <tr key={item.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                      <td className="px-4 py-3">
                        <div className="font-semibold" style={{ color: theme.text }}>{item.user?.siteUsername || '—'}</div>
                        <div className="text-xs" style={{ color: theme.textMuted }}>{item.user?.email}</div>
                      </td>
                      <td className="px-4 py-3" style={{ color: theme.text }}>{GAME_LABELS[item.gameType] || item.gameType}</td>
                      <td className="px-4 py-3" style={{ color: theme.text }}>{item.betAmount.toLocaleString('tr-TR')}</td>
                      <td className="px-4 py-3" style={{ color: theme.textSecondary }}>{item.multiplier ? `${item.multiplier.toFixed(2)}×` : '—'}</td>
                      <td className="px-4 py-3" style={{ color: theme.text }}>{item.payout.toLocaleString('tr-TR')}</td>
                      <td className="px-4 py-3 font-semibold" style={{ color: item.netChange >= 0 ? theme.success : theme.danger }}>
                        {item.netChange >= 0 ? '+' : ''}{item.netChange.toLocaleString('tr-TR')}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ backgroundColor: `${resultInfo.color}22`, color: resultInfo.color }}>
                          {resultInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: theme.textMuted }}>
                        {new Date(item.createdAt).toLocaleString('tr-TR')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Sayfalama */}
        <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: `1px solid ${theme.border}` }}>
          <span className="text-xs" style={{ color: theme.textMuted }}>
            Toplam {total.toLocaleString('tr-TR')} kayıt — Sayfa {page}/{totalPages}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg border text-xs font-semibold disabled:opacity-40"
              style={{ borderColor: theme.border, color: theme.text }}
            >
              Önceki
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 rounded-lg border text-xs font-semibold disabled:opacity-40"
              style={{ borderColor: theme.border, color: theme.text }}
            >
              Sonraki
            </button>
          </div>
        </div>
      </div>

      {/* Ayarlar modalı */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setSettingsOpen(false)}>
          <div
            className="w-full max-w-xl rounded-2xl border p-5 max-h-[85vh] overflow-y-auto"
            style={{ backgroundColor: theme.backgroundSecondary, borderColor: theme.border }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold" style={{ color: theme.text }}>Oyun Ayarları</h2>
              <button onClick={() => setSettingsOpen(false)}>
                <X className="w-5 h-5" style={{ color: theme.textMuted }} />
              </button>
            </div>
            <div className="space-y-4">
              {settings.map((s, idx) => (
                <div key={s.gameType} className="rounded-xl border p-4" style={{ borderColor: theme.border }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold" style={{ color: theme.text }}>{GAME_LABELS[s.gameType]}</span>
                    <label className="flex items-center gap-2 text-xs" style={{ color: theme.textMuted }}>
                      <input
                        type="checkbox"
                        checked={s.isEnabled}
                        onChange={(e) => {
                          const next = [...settings]
                          next[idx] = { ...s, isEnabled: e.target.checked }
                          setSettings(next)
                        }}
                      />
                      Aktif
                    </label>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] uppercase" style={{ color: theme.textMuted }}>Min Bahis</label>
                      <input
                        type="number"
                        value={s.minBet}
                        onChange={(e) => {
                          const next = [...settings]
                          next[idx] = { ...s, minBet: Number(e.target.value) }
                          setSettings(next)
                        }}
                        className="w-full px-2 py-1.5 rounded-lg border text-sm bg-transparent"
                        style={{ borderColor: theme.border, color: theme.text }}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase" style={{ color: theme.textMuted }}>Max Bahis</label>
                      <input
                        type="number"
                        value={s.maxBet}
                        onChange={(e) => {
                          const next = [...settings]
                          next[idx] = { ...s, maxBet: Number(e.target.value) }
                          setSettings(next)
                        }}
                        className="w-full px-2 py-1.5 rounded-lg border text-sm bg-transparent"
                        style={{ borderColor: theme.border, color: theme.text }}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase" style={{ color: theme.textMuted }}>House Edge %</label>
                      <input
                        type="number"
                        step="0.1"
                        value={s.houseEdgePercent}
                        onChange={(e) => {
                          const next = [...settings]
                          next[idx] = { ...s, houseEdgePercent: Number(e.target.value) }
                          setSettings(next)
                        }}
                        className="w-full px-2 py-1.5 rounded-lg border text-sm bg-transparent"
                        style={{ borderColor: theme.border, color: theme.text }}
                      />
                    </div>
                  </div>
                  <button
                    disabled={savingSettings}
                    onClick={() => saveSetting(s)}
                    className="mt-3 w-full py-1.5 rounded-lg text-xs font-bold text-white"
                    style={{ background: `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})` }}
                  >
                    Kaydet
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
