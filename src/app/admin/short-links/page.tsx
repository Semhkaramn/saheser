'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { BarChart3, TrendingUp, Calendar, MousePointerClick } from 'lucide-react'

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

  return (
    <div className="admin-page-container">
      <div className="flex justify-between items-start mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold mb-1 text-white">Kısa Linkler</h1>
          <p className="text-sm admin-text-muted">
            Hedef adresleri tek yerden yönet, tıklanmaları takip et.
          </p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm((v) => !v) }}>+ Yeni Link</Button>
      </div>

      {showForm && (
        <div className="admin-card p-5 mb-6">
          <div className="flex gap-2 mb-2.5 flex-wrap">
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

      {loading ? (
        <p className="admin-text-muted text-sm">Yükleniyor...</p>
      ) : links.length === 0 ? (
        <p className="admin-text-muted text-sm">Henüz kısa link yok.</p>
      ) : (
        <div className="admin-card p-2">
          {links.map((l) => (
            <div key={l.id} className="flex items-center gap-3 px-3 py-3 border-b admin-border last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">
                  {siteUrl}/{l.slug} {l.title && <span className="admin-text-muted font-normal">— {l.title}</span>}
                </p>
                <p className="text-xs admin-text-muted truncate">→ {l.targetUrl}</p>
              </div>
              <span className="text-xs admin-text-muted whitespace-nowrap font-data">{l.clickCount} tıklama</span>
              <Button variant="outline" size="sm" onClick={() => openStats(l)}>
                <BarChart3 className="w-3.5 h-3.5 mr-1" />
                Analiz
              </Button>
              <Button variant="outline" size="sm" onClick={() => copyLink(l.slug)}>Kopyala</Button>
              <Button variant="outline" size="sm" onClick={() => startEdit(l)}>Düzenle</Button>
              <Button variant="outline" size="sm" onClick={() => remove(l.id)}>Sil</Button>
            </div>
          ))}
        </div>
      )}

      {/* Detaylı analiz modalı - günlük/haftalık kırılım + üst kaynaklar */}
      <Dialog open={!!statsFor} onOpenChange={(open) => !open && setStatsFor(null)}>
        <DialogContent className="admin-dialog max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">
              {siteUrl}/{statsFor?.slug} — Tıklanma Analizi
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
