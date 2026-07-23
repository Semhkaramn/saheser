'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  BarChart3,
  TrendingUp,
  Calendar,
  MousePointerClick,
  Search,
  Link2,
  Plus,
  Copy,
  Pencil,
  Trash2,
  ExternalLink,
  X,
} from 'lucide-react'

interface LinkRow {
  id: string
  slug: string
  targetUrl: string
  title: string | null
  clickCount: number
  createdAt: string
}

export default function ShortLinksPage() {
  const [links, setLinks] = useState<LinkRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [slug, setSlug] = useState('')
  const [targetUrl, setTargetUrl] = useState('')
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [siteUrl, setSiteUrl] = useState('')
  const [statsFor, setStatsFor] = useState<LinkRow | null>(null)
  const [stats, setStats] = useState<any>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  async function openStats(l: LinkRow) {
    setStatsFor(l)
    setStats(null)
    setStatsLoading(true)
    try {
      const res = await fetch(`/api/admin/short-links/${l.id}/stats?days=14`)
      const data = await res.json()
      setStats(data)
    } catch {
      toast.error('İstatistikler yüklenemedi')
    } finally {
      setStatsLoading(false)
    }
  }

  useEffect(() => {
    load()
    if (typeof window !== 'undefined') setSiteUrl(window.location.origin)
  }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/short-links')
      const data = await res.json()
      setLinks(data.links || [])
    } catch {
      toast.error('Yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  function startEdit(l: LinkRow) {
    setEditingId(l.id)
    setSlug(l.slug)
    setTargetUrl(l.targetUrl)
    setTitle(l.title || '')
    setShowForm(true)
  }

  function resetForm() {
    setSlug(''); setTargetUrl(''); setTitle(''); setEditingId(null); setShowForm(false)
  }

  async function save() {
    if (!slug.trim() || !targetUrl.trim()) {
      toast.error('Slug ve hedef adres gerekli')
      return
    }
    setSaving(true)
    try {
      const url = editingId ? `/api/admin/short-links/${editingId}` : '/api/admin/short-links'
      const method = editingId ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, targetUrl, title: title || null }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Kaydedilemedi')
        return
      }
      toast.success(editingId ? 'Güncellendi' : 'Kısa link oluşturuldu')
      resetForm()
      load()
    } catch {
      toast.error('Kaydedilemedi')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('Bu kısa link silinsin mi? Buna bağlı sponsor/banner varsa bağlantısı kopar.')) return
    try {
      await fetch(`/api/admin/short-links/${id}`, { method: 'DELETE' })
      toast.success('Silindi')
      load()
    } catch {
      toast.error('Silinemedi')
    }
  }

  function copyLink(slug: string) {
    navigator.clipboard.writeText(`${siteUrl}/${slug}`)
    toast.success('Kopyalandı')
  }

  const filteredLinks = useMemo(() => {
    const q = searchTerm.trim().toLocaleLowerCase('tr')
    if (!q) return links
    return links.filter(
      (l) =>
        l.slug.toLocaleLowerCase('tr').includes(q) ||
        (l.title || '').toLocaleLowerCase('tr').includes(q) ||
        l.targetUrl.toLocaleLowerCase('tr').includes(q)
    )
  }, [links, searchTerm])

  const totalClicks = useMemo(() => links.reduce((sum, l) => sum + l.clickCount, 0), [links])
  const topLink = useMemo(
    () => (links.length ? [...links].sort((a, b) => b.clickCount - a.clickCount)[0] : null),
    [links]
  )

  return (
    <div className="admin-page-container">
      <div className="admin-page-inner max-w-5xl">
        {/* Başlık + özet istatistikler */}
        <div className="flex justify-between items-start mb-5 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span
              className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.18), rgba(37,99,235,0.08))' }}
            >
              <Link2 className="w-5 h-5 text-blue-400" />
            </span>
            <div>
              <h1 className="font-display text-2xl font-extrabold text-white">Kısa Linkler</h1>
              <p className="text-sm admin-text-muted">Hedef adresleri tek yerden yönet, tıklanmaları takip et.</p>
            </div>
          </div>
          <Button onClick={() => { resetForm(); setShowForm((v) => !v) }} className="gap-1.5">
            <Plus className="w-4 h-4" />
            Yeni Link
          </Button>
        </div>

        {/* Özet kartları */}
        {!loading && links.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="admin-card p-4">
              <p className="text-[11px] uppercase tracking-wide admin-text-muted mb-1">Toplam Link</p>
              <p className="text-2xl font-extrabold font-data text-white">{links.length}</p>
            </div>
            <div className="admin-card p-4">
              <p className="text-[11px] uppercase tracking-wide admin-text-muted mb-1">Toplam Tıklama</p>
              <p className="text-2xl font-extrabold font-data text-white">{totalClicks.toLocaleString('tr-TR')}</p>
            </div>
            <div className="admin-card p-4">
              <p className="text-[11px] uppercase tracking-wide admin-text-muted mb-1">En Çok Tıklanan</p>
              <p className="text-sm font-bold text-white truncate">/{topLink?.slug}</p>
              <p className="text-[11px] admin-text-muted">{topLink?.clickCount.toLocaleString('tr-TR')} tıklama</p>
            </div>
          </div>
        )}

        {/* Yeni/Düzenle formu */}
        {showForm && (
          <div className="admin-card p-5 mb-5 border-blue-500/20" style={{ borderColor: 'rgba(59,130,246,0.25)' }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white">{editingId ? 'Linki Düzenle' : 'Yeni Kısa Link'}</h3>
              <button onClick={resetForm} className="admin-text-muted hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-2 mb-3 flex-wrap">
              <Input placeholder="slug (örn: vip-kanal)" value={slug} onChange={(e) => setSlug(e.target.value)} className="w-48" />
              <Input placeholder="Hedef adres (https://...)" value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} className="flex-1 min-w-[200px]" />
              <Input placeholder="Etiket (opsiyonel, örn: VIP kanal daveti)" value={title} onChange={(e) => setTitle(e.target.value)} className="w-64" />
            </div>
            <div className="flex gap-2">
              <Button onClick={save} disabled={saving}>{saving ? 'Kaydediliyor...' : editingId ? 'Güncelle' : 'Oluştur'}</Button>
              <Button variant="outline" onClick={resetForm}>İptal</Button>
            </div>
          </div>
        )}

        {/* Arama */}
        {!loading && links.length > 0 && (
          <div className="relative mb-4">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 admin-text-muted pointer-events-none" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Slug, etiket veya hedef adrese göre ara..."
              className="pl-10"
            />
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="admin-card p-4 animate-pulse">
                <div className="h-3 w-1/3 bg-white/10 rounded mb-2" />
                <div className="h-2.5 w-1/2 bg-white/5 rounded" />
              </div>
            ))}
          </div>
        ) : links.length === 0 ? (
          <div className="admin-card p-10 text-center">
            <Link2 className="w-8 h-8 mx-auto mb-3 admin-text-muted opacity-50" />
            <p className="text-sm font-semibold text-white mb-1">Henüz kısa link yok</p>
            <p className="text-xs admin-text-muted mb-4">Sponsor sitesi, banner veya davet bağlantıların için kısa, takip edilebilir bir link oluştur.</p>
            <Button size="sm" onClick={() => setShowForm(true)} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              İlk Linki Oluştur
            </Button>
          </div>
        ) : filteredLinks.length === 0 ? (
          <div className="admin-card p-8 text-center">
            <p className="text-sm admin-text-muted">"{searchTerm}" ile eşleşen link bulunamadı.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredLinks.map((l) => {
              const isTop = topLink && l.id === topLink.id && l.clickCount > 0
              return (
                <div
                  key={l.id}
                  className="admin-card p-4 flex items-center gap-4 transition-colors hover:bg-white/[0.03]"
                >
                  <span
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: isTop ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.05)' }}
                  >
                    <Link2 className={`w-4 h-4 ${isTop ? 'text-amber-400' : 'admin-text-muted'}`} />
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-white font-data">/{l.slug}</p>
                      {l.title && <span className="text-xs admin-text-muted">— {l.title}</span>}
                      {isTop && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400">
                          🔥 En popüler
                        </span>
                      )}
                    </div>
                    <p className="text-xs admin-text-muted truncate flex items-center gap-1 mt-0.5">
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      {l.targetUrl}
                    </p>
                  </div>

                  <div className="text-right flex-shrink-0 hidden sm:block">
                    <p className="text-lg font-extrabold font-data text-white leading-none">{l.clickCount.toLocaleString('tr-TR')}</p>
                    <p className="text-[10px] admin-text-muted uppercase tracking-wide">tıklama</p>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Button variant="outline" size="sm" onClick={() => openStats(l)} title="Analiz">
                      <BarChart3 className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => copyLink(l.slug)} title="Kopyala">
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => startEdit(l)} title="Düzenle">
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => remove(l.id)} title="Sil" className="hover:text-rose-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Detaylı analiz modalı - günlük/haftalık kırılım + üst kaynaklar */}
      <Dialog open={!!statsFor} onOpenChange={(open) => !open && setStatsFor(null)}>
        <DialogContent className="admin-dialog max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white font-data">
              /{statsFor?.slug} — Tıklanma Analizi
            </DialogTitle>
          </DialogHeader>

          {statsLoading ? (
            <p className="admin-text-muted text-sm py-8 text-center">Yükleniyor...</p>
          ) : stats ? (
            <div className="space-y-5">
              {/* Özet kartları */}
              <div className="grid grid-cols-3 gap-3">
                <div className="admin-card p-3 text-center">
                  <MousePointerClick className="w-4 h-4 mx-auto mb-1 text-blue-400" />
                  <p className="text-xl font-bold text-white font-data">{stats.totalClicks}</p>
                  <p className="text-[11px] admin-text-muted">Toplam</p>
                </div>
                <div className="admin-card p-3 text-center">
                  <Calendar className="w-4 h-4 mx-auto mb-1 text-emerald-400" />
                  <p className="text-xl font-bold text-white font-data">{stats.todayClicks}</p>
                  <p className="text-[11px] admin-text-muted">Bugün</p>
                </div>
                <div className="admin-card p-3 text-center">
                  <TrendingUp className="w-4 h-4 mx-auto mb-1 text-amber-400" />
                  <p className="text-xl font-bold text-white font-data">{stats.last7DaysClicks}</p>
                  <p className="text-[11px] admin-text-muted">Son 7 Gün</p>
                </div>
              </div>

              {/* Günlük kırılım - basit çubuk grafik */}
              <div>
                <p className="text-xs font-semibold admin-text-muted mb-2 uppercase tracking-wide">Son 14 Gün</p>
                <div className="flex items-end gap-1 h-24">
                  {stats.daily.map((d: { date: string; count: number }) => {
                    const max = Math.max(...stats.daily.map((x: any) => x.count), 1)
                    const heightPct = Math.max((d.count / max) * 100, d.count > 0 ? 8 : 2)
                    return (
                      <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative">
                        <div
                          className="w-full rounded-t transition-all"
                          style={{
                            height: `${heightPct}%`,
                            background: d.count > 0 ? 'linear-gradient(180deg, #3B82F6, #2563EB)' : 'rgba(255,255,255,0.08)',
                            minHeight: '2px',
                          }}
                          title={`${d.date}: ${d.count} tıklama`}
                        />
                        <span className="text-[9px] admin-text-muted rotate-0">{d.date.slice(5)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Üst kaynaklar */}
              {stats.topReferrers?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold admin-text-muted mb-2 uppercase tracking-wide">En Çok Tıklanan Kaynaklar</p>
                  <div className="space-y-1.5">
                    {stats.topReferrers.map((r: { referrer: string; count: number }, i: number) => (
                      <div key={i} className="flex items-center justify-between text-sm bg-slate-800/40 rounded-lg px-3 py-2">
                        <span className="text-slate-300 truncate max-w-[70%]">{r.referrer}</span>
                        <span className="text-white font-data font-semibold">{r.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
