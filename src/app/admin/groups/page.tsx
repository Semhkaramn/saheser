'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

// ============================================================
// "Bot Yönetimi" sayfası: eskiden Gruplar, Randy, Çapraz Ban diye 3 ayrı
// sayfaydı - üçü de "Telegram botunun grup bazlı yönetimi" ile ilgili
// olduğu için tek sayfada sekmeli hale getirildi (ads/bot-settings
// sayfalarında yapıldığı gibi).
// ============================================================

interface GroupRow {
  id: string
  groupId: string
  title: string | null
  chatType?: string
  isActive: boolean
  memberCount: number
  createdAt: string
}

interface ExcludedUser {
  telegramId: string
  username: string | null
  firstName: string | null
}

function GroupsTab() {
  const [groups, setGroups] = useState<GroupRow[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null)
  const [excluded, setExcluded] = useState<ExcludedUser[]>([])
  const [excludedLoading, setExcludedLoading] = useState(false)
  const [newExclude, setNewExclude] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/groups')
      const data = await res.json()
      setGroups(data.groups || [])
    } catch {
      toast.error('Gruplar yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  async function toggleActive(g: GroupRow) {
    try {
      const res = await fetch(`/api/admin/groups/${g.groupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !g.isActive }),
      })
      if (!res.ok) throw new Error()
      toast.success(g.isActive ? 'Grup pasifleştirildi' : 'Grup aktifleştirildi')
      load()
    } catch {
      toast.error('Güncellenemedi')
    }
  }

  async function deleteGroup(g: GroupRow) {
    if (!confirm(`"${g.title || g.groupId}" grubunu kalıcı olarak listeden silmek istediğine emin misin? (Bot gruptan çıkarılmaz, sadece kayıt silinir - eski/kalıntı kayıtları temizlemek için)`)) return
    try {
      const res = await fetch(`/api/admin/groups/${g.groupId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Grup kaydı silindi')
      load()
    } catch {
      toast.error('Silinemedi')
    }
  }

  async function refreshExcluded(groupId: string) {
    setExcludedLoading(true)
    try {
      const res = await fetch(`/api/admin/groups/${groupId}/tag-exclusions`)
      const data = await res.json()
      setExcluded(data.excluded || [])
    } catch {
      toast.error('Liste yüklenemedi')
    } finally {
      setExcludedLoading(false)
    }
  }

  async function toggleExpanded(groupId: string) {
    if (expandedGroupId === groupId) {
      setExpandedGroupId(null)
      return
    }
    setExpandedGroupId(groupId)
    await refreshExcluded(groupId)
  }

  async function addExclude(groupId: string) {
    if (!newExclude.trim()) return
    try {
      const res = await fetch(`/api/admin/groups/${groupId}/tag-exclusions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: newExclude.trim(), exclude: true }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Eklenemedi')
        return
      }
      toast.success(`${data.matchedName} etiketleme dışında bırakıldı`)
      setNewExclude('')
      await refreshExcluded(groupId)
    } catch {
      toast.error('Eklenemedi')
    }
  }

  async function removeExclude(groupId: string, telegramId: string) {
    try {
      const res = await fetch(`/api/admin/groups/${groupId}/tag-exclusions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: telegramId, exclude: false }),
      })
      if (!res.ok) throw new Error()
      toast.success('Tekrar etiketlenebilir yapıldı')
      setExcluded((prev) => prev.filter((u) => u.telegramId !== telegramId))
    } catch {
      toast.error('Güncellenemedi')
    }
  }

  return (
    <div>
      <p className="text-sm admin-text-muted mb-6">
        Botun bulunduğu grup ve kanallar — mesaj/gönderi attıkça otomatik listelenir. Sponsor onay grupları hariçtir.
      </p>

      {loading ? (
        <p className="admin-text-muted text-sm">Yükleniyor...</p>
      ) : groups.length === 0 ? (
        <div className="admin-card p-8 text-center">
          <p className="admin-text-muted text-sm">
            Henüz kayıtlı grup/kanal yok. Botu bir gruba veya kanala admin olarak ekleyip
            birinin mesaj/gönderi atmasını bekle, otomatik burada görünecek.
          </p>
        </div>
      ) : (
        <div className="admin-card p-2">
          {groups.map((g) => (
            <div key={g.id} className="border-b admin-border last:border-0">
              <div className={`flex items-center gap-3 px-3 py-3 ${g.isActive ? '' : 'opacity-50'}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {g.chatType === 'channel' ? '📢' : '👥'} {g.title || `Grup ${g.groupId}`}
                  </p>
                  <p className="text-xs admin-text-muted">
                    ID: {g.groupId} · {g.memberCount} bilinen üye · eklenme: {new Date(g.createdAt).toLocaleDateString('tr-TR')}
                  </p>
                </div>
                <span className={`text-xs font-semibold whitespace-nowrap ${g.isActive ? 'text-emerald-400' : 'admin-text-muted'}`}>
                  {g.isActive ? '● Aktif' : '● Pasif'}
                </span>
                {g.chatType !== 'channel' && (
                  <Button variant="outline" size="sm" onClick={() => toggleExpanded(g.groupId)}>
                    {expandedGroupId === g.groupId ? 'Kapat' : 'Etiket Hariç Listesi'}
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => toggleActive(g)}>
                  {g.isActive ? 'Pasifleştir' : 'Aktifleştir'}
                </Button>
                <Button variant="outline" size="sm" className="text-rose-400 hover:text-rose-300" onClick={() => deleteGroup(g)}>
                  Sil
                </Button>
              </div>

              {expandedGroupId === g.groupId && (
                <div className="px-3 pb-4">
                  <div className="rounded-lg bg-white/5 p-3">
                    <p className="text-xs admin-text-muted mb-2">
                      Etiketleme Hariç Listesi (bu kişiler <code>/etiket</code> ve <code>/naber</code>'da atlanır)
                    </p>
                    {excludedLoading ? (
                      <p className="admin-text-muted text-sm">Yükleniyor...</p>
                    ) : excluded.length === 0 ? (
                      <p className="admin-text-muted text-sm mb-3">Şu an hariç tutulan kimse yok.</p>
                    ) : (
                      <div className="space-y-1.5 mb-3">
                        {excluded.map((u) => (
                          <div key={u.telegramId} className="flex items-center justify-between text-sm">
                            <span className="text-white">{u.username ? `@${u.username}` : u.firstName || u.telegramId}</span>
                            <Button variant="outline" size="sm" onClick={() => removeExclude(g.groupId, u.telegramId)}>
                              Tekrar Dahil Et
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Input
                        value={newExclude}
                        onChange={(e) => setNewExclude(e.target.value)}
                        placeholder="Kullanıcı adı ya da telegram ID"
                        className="flex-1"
                      />
                      <Button size="sm" onClick={() => addExclude(g.groupId)}>Hariç Tut</Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface RandyGroup { groupId: string; title: string | null; chatType?: string }
interface RandyRow {
  id: string
  title: string
  message: string
  status: string
  requirementType: string
  messageCountPeriod: string | null
  messageCountRequired: number | null
  postRandyMessages: number | null
  winnerCount: number
  prizePoints: number
  pinMessage: boolean
  requireChannelMembership: boolean
  membershipCheckChannelIds: string | null
  _count: { participants: number; winners: number }
}

const REQUIREMENT_OPTIONS: { value: string; label: string }[] = [
  { value: 'none', label: 'Şartsız' },
  { value: 'daily', label: 'Günlük mesaj' },
  { value: 'weekly', label: 'Haftalık mesaj' },
  { value: 'monthly', label: 'Aylık mesaj' },
  { value: 'all_time', label: 'Toplam mesaj' },
  { value: 'post_randy', label: 'Başladıktan sonra mesaj' },
]

function requirementLabel(r: RandyRow): string {
  if (r.requirementType === 'none') return 'Şartsız'
  if (r.requirementType === 'post_randy_messages') return `Randy sonrası ${r.postRandyMessages} mesaj`
  const periodLabel: Record<string, string> = { daily: 'Günlük', weekly: 'Haftalık', monthly: 'Aylık', all_time: 'Toplam' }
  return `${periodLabel[r.messageCountPeriod || 'daily']} ${r.messageCountRequired} mesaj`
}

function RandyStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    draft: { label: 'Taslak', className: 'admin-text-muted border-white/20' },
    active: { label: 'Aktif', className: 'text-emerald-400 border-emerald-400/40' },
    ended: { label: 'Bitti', className: 'text-amber-400 border-amber-400/40' },
  }
  const s = map[status] ?? map.draft
  return <span className={`text-[11px] border rounded-full px-2 py-0.5 ml-2 ${s.className}`}>{s.label}</span>
}

function RandyTab() {
  const [groups, setGroups] = useState<RandyGroup[]>([])
  const [groupId, setGroupId] = useState('')
  const [randys, setRandys] = useState<RandyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [message, setMessage] = useState('')
  const [requirementType, setRequirementType] = useState('none')
  const [requiredCount, setRequiredCount] = useState('0')
  const [winnerCount, setWinnerCount] = useState('1')
  const [pointsReward, setPointsReward] = useState('')
  const [channelId, setChannelId] = useState('')
  const [channelUsername, setChannelUsername] = useState('')
  const [defaultChannels, setDefaultChannels] = useState<{ channelId: string; channelUsername: string | null }[]>([])

  useEffect(() => {
    fetch('/api/admin/groups').then((r) => r.json()).then((data) => {
      const activeGroups = (data.groups || []).filter((g: any) => g.isActive)
      setGroups(activeGroups)
      if (activeGroups.length > 0) setGroupId(activeGroups[0].groupId)
      else setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (groupId) {
      loadRandys(groupId)
      loadDefaults(groupId)
    }
  }, [groupId])

  // ✅ Web panelindeki Randy ayarları artık "her seferinde yeni taslak
  // oluştur" değil - grup için TEK KALICI kayda bakan, her zaman
  // düzenlenebilen bir ekran (bottaki "Randy Ayarları" ile aynı mantık).
  async function loadDefaults(gid: string) {
    try {
      const res = await fetch(`/api/admin/randy-defaults?groupId=${gid}`)
      const data = await res.json()
      setMessage(data.defaults?.message || '')
      setRequirementType(data.defaults?.requirementType || 'none')
      setRequiredCount(String(data.defaults?.requiredMessageCount || 0))
      setWinnerCount(String(data.defaults?.winnerCount || 1))
      setPointsReward(data.defaults?.pointsReward ? String(data.defaults.pointsReward) : '')
      setDefaultChannels((data.channels || []).map((c: any) => ({ channelId: c.channelId, channelUsername: c.channelUsername })))
    } catch {
      toast.error('Randy ayarları yüklenemedi')
    }
  }

  async function loadRandys(gid: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/randy?groupId=${gid}`)
      const data = await res.json()
      setRandys(data.randys || [])
    } catch {
      toast.error('Randy listesi yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  async function addDefaultChannel() {
    if (!channelId) return
    try {
      const res = await fetch('/api/admin/randy-defaults', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId, channelId, channelUsername: channelUsername || null }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Eklenemedi'); return }
      setDefaultChannels(data.channels || [])
      setChannelId('')
      setChannelUsername('')
    } catch {
      toast.error('Eklenemedi')
    }
  }

  async function removeDefaultChannel(cid: string) {
    try {
      const res = await fetch(`/api/admin/randy-defaults?groupId=${groupId}&channelId=${cid}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Kaldırılamadı'); return }
      setDefaultChannels(data.channels || [])
    } catch {
      toast.error('Kaldırılamadı')
    }
  }

  // ✅ Artık "yeni taslak oluştur" değil - grubun kalıcı Randy ayarlarını
  // kaydediyor. Aynı ekran her zaman kalıyor, sürekli düzenleniyor.
  async function saveDefaults() {
    if (!message || !winnerCount) {
      toast.error('Mesaj ve kazanan sayısı gerekli')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/randy-defaults', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId, message, requirementType,
          requiredMessageCount: Number(requiredCount), winnerCount: Number(winnerCount),
          pointsReward: pointsReward ? Number(pointsReward) : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Kaydedilemedi')
        return
      }
      toast.success('Randy ayarları kaydedildi')
    } catch {
      toast.error('Kaydedilemedi')
    } finally {
      setSaving(false)
    }
  }

  async function startRandy(id: string) {
    if (!confirm('Bu Randy gruba duyurulsun mu?')) return
    try {
      const res = await fetch(`/api/admin/randy/${id}/start`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) toast.error(data.error || 'Başlatılamadı')
      else toast.success('Randy başlatıldı')
      loadRandys(groupId)
    } catch {
      toast.error('Başlatılamadı')
    }
  }

  async function endRandy(id: string) {
    if (!confirm('Randy sonlandırılıp kazananlar seçilsin mi?')) return
    try {
      const res = await fetch(`/api/admin/randy/${id}/end`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) toast.error(data.error || 'Sonlandırılamadı')
      else toast.success('Randy sonlandırıldı, kazananlar duyuruldu')
      loadRandys(groupId)
    } catch {
      toast.error('Sonlandırılamadı')
    }
  }

  async function deleteRandy(id: string) {
    if (!confirm('Bu Randy tamamen silinsin mi?')) return
    try {
      const res = await fetch(`/api/admin/randy/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) toast.error(data.error || 'Silinemedi')
      else loadRandys(groupId)
    } catch {
      toast.error('Silinemedi')
    }
  }

  if (groups.length === 0 && !loading) {
    return (
      <p className="admin-text-muted text-sm">
        Henüz kayıtlı grup/kanal yok. "Gruplar" sekmesinden botu bir gruba/kanala eklediğinden emin ol.
      </p>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-start mb-6 flex-wrap gap-3">
        <p className="admin-text-muted text-sm max-w-lg">
          Bu grubun kalıcı Randy ayarları — grupta <code>/randy</code> yazınca bu ayarlarla anında başlar.
        </p>
        <select
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
          className="admin-input rounded-lg px-3 py-2 text-sm"
        >
          {groups.map((g) => <option key={g.groupId} value={g.groupId}>{g.chatType === 'channel' ? '📢' : '👥'} {g.title || g.groupId}</option>)}
        </select>
      </div>

      <div className="admin-card p-5 mb-6">
        <Textarea placeholder="Duyuru mesajı" value={message} onChange={(e) => setMessage(e.target.value)} rows={3} className="mb-2.5" />

        <div className="flex gap-3 mb-3 flex-wrap items-center">
          <label className="text-sm admin-text-muted flex items-center gap-2">
            Şart tipi
            <select value={requirementType} onChange={(e) => setRequirementType(e.target.value)} className="admin-input rounded-lg px-2 py-1.5 text-sm">
              {REQUIREMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          {requirementType !== 'none' && (
            <label className="text-sm admin-text-muted flex items-center gap-2">
              Gerekli sayı
              <Input type="number" value={requiredCount} onChange={(e) => setRequiredCount(e.target.value)} className="w-20" />
            </label>
          )}
          <label className="text-sm admin-text-muted flex items-center gap-2">
            Kazanan sayısı
            <Input type="number" value={winnerCount} onChange={(e) => setWinnerCount(e.target.value)} className="w-20" />
          </label>
          <label className="text-sm admin-text-muted flex items-center gap-2">
            Puan ödülü (opsiyonel)
            <Input type="number" value={pointsReward} onChange={(e) => setPointsReward(e.target.value)} placeholder="—" className="w-24" />
          </label>
        </div>

        <div className="mb-3">
          <p className="text-sm admin-text-muted mb-1.5">Zorunlu kanallar (opsiyonel)</p>
          {defaultChannels.map((c) => (
            <div key={c.channelId} className="flex items-center gap-2 mb-1">
              <p className="text-sm text-white">📢 {c.channelUsername ? `@${c.channelUsername}` : c.channelId}</p>
              <button onClick={() => removeDefaultChannel(c.channelId)} className="text-xs text-rose-400 hover:underline">Kaldır</button>
            </div>
          ))}
          <div className="flex gap-2 flex-wrap">
            <Input placeholder="Kanal ID (örn: -100123456)" value={channelId} onChange={(e) => setChannelId(e.target.value)} className="w-52" />
            <Input placeholder="kullaniciadi (@ olmadan)" value={channelUsername} onChange={(e) => setChannelUsername(e.target.value)} className="w-44" />
            <Button variant="outline" onClick={addDefaultChannel}>Ekle</Button>
          </div>
        </div>

        <Button onClick={saveDefaults} disabled={saving}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Button>
      </div>

      {loading ? (
        <p className="admin-text-muted text-sm">Yükleniyor...</p>
      ) : randys.length === 0 ? (
        <p className="admin-text-muted text-sm">Bu grupta henüz Randy yok.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {randys.map((r) => (
            <div key={r.id} className="admin-card p-4">
              <div className="flex justify-between items-start flex-wrap gap-3">
                <div>
                  <p className="font-semibold text-[15px] mb-1 text-white">
                    {r.title} <RandyStatusBadge status={r.status} />
                  </p>
                  <p className="text-sm admin-text-muted mb-1.5">{r.message}</p>
                  <p className="text-xs admin-text-muted">
                    {requirementLabel(r)} · 🏆 {r.winnerCount} kazanan · 👥 {r._count.participants} katılımcı
                    {r.prizePoints > 0 ? ` · 🎁 ${r.prizePoints} puan` : ''}
                    {r.requireChannelMembership ? ' · 📢 kanal şartı var' : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  {r.status === 'draft' && <Button size="sm" onClick={() => startRandy(r.id)}>▶ Başlat</Button>}
                  {r.status === 'active' && <Button size="sm" variant="destructive" onClick={() => endRandy(r.id)}>■ Sonlandır</Button>}
                  {r.status !== 'active' && <Button size="sm" variant="outline" onClick={() => deleteRandy(r.id)}>Sil</Button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface CrossBanGroupRow { groupId: string; title: string | null; enabled: boolean }
interface ChannelRow { id: number; channelId: string; title: string | null; username: string | null; enabled: boolean }
interface LogRow {
  id: string; telegramId: string; username: string | null; firstName: string | null
  sourceGroupId: string; targetCount: number; successCount: number; createdAt: string; action?: string
}

function CrossBanTab() {
  const [groups, setGroups] = useState<CrossBanGroupRow[]>([])
  const [channels, setChannels] = useState<ChannelRow[]>([])
  const [logs, setLogs] = useState<LogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [newChannelId, setNewChannelId] = useState('')
  const [newChannelTitle, setNewChannelTitle] = useState('')

  // Loglarda ham grup ID'si (-1003... gibi) yerine grup adını göstermek için -
  // zaten çekilmiş grup/kanal listesinden eşleştiriyoruz, ayrı bir istek gerekmez.
  function groupDisplayName(groupId: string) {
    const group = groups.find((g) => g.groupId === groupId)
    if (group) return group.title || groupId
    const channel = channels.find((c) => c.channelId === groupId)
    if (channel) return channel.title || groupId
    return groupId
  }

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const [g, c, l] = await Promise.all([
        fetch('/api/admin/cross-ban/settings').then((r) => r.json()),
        fetch('/api/admin/cross-ban/channels').then((r) => r.json()),
        fetch('/api/admin/cross-ban/log').then((r) => r.json()),
      ])
      setGroups(g.groups || [])
      setChannels(c.channels || [])
      setLogs(l.logs || [])
    } catch {
      toast.error('Yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  async function toggle(groupId: string, enabled: boolean) {
    setGroups((prev) => prev.map((g) => (g.groupId === groupId ? { ...g, enabled } : g)))
    try {
      await fetch('/api/admin/cross-ban/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId, enabled }),
      })
    } catch {
      toast.error('Güncellenemedi')
    }
  }

  async function addChannel() {
    if (!newChannelId.trim()) return
    try {
      const res = await fetch('/api/admin/cross-ban/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId: newChannelId.trim(), title: newChannelTitle.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Eklenemedi')
        return
      }
      setNewChannelId('')
      setNewChannelTitle('')
      toast.success('Kanal eklendi')
      load()
    } catch {
      toast.error('Eklenemedi')
    }
  }

  async function toggleChannel(c: ChannelRow) {
    try {
      await fetch(`/api/admin/cross-ban/channels/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !c.enabled }),
      })
      load()
    } catch {
      toast.error('Güncellenemedi')
    }
  }

  async function removeChannel(id: number) {
    if (!confirm('Bu kanal ağdan çıkarılsın mı?')) return
    try {
      await fetch(`/api/admin/cross-ban/channels/${id}`, { method: 'DELETE' })
      toast.success('Kanal kaldırıldı')
      load()
    } catch {
      toast.error('Kaldırılamadı')
    }
  }

  return (
    <div>
      <p className="text-sm admin-text-muted mb-6">
        Bir grupta biri banlanınca, aşağıda "açık" olan diğer tüm grup/kanallardan da otomatik banlanır.
      </p>

      {loading ? (
        <p className="admin-text-muted text-sm">Yükleniyor...</p>
      ) : (
        <>
          <h2 className="text-base font-bold mb-3 text-white">Ağa Dahil Gruplar</h2>
          {groups.length === 0 ? (
            <p className="admin-text-muted text-sm mb-6">Henüz kayıtlı grup yok.</p>
          ) : (
            <div className="flex flex-col gap-2.5 mb-8">
              {groups.map((g) => (
                <div key={g.groupId} className="admin-card flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="font-semibold text-sm text-white">{g.title || g.groupId}</p>
                    <p className="text-xs admin-text-muted">{g.groupId}</p>
                  </div>
                  <button
                    onClick={() => toggle(g.groupId, !g.enabled)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      g.enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'
                    }`}
                  >
                    {g.enabled ? 'Açık' : 'Kapalı'}
                  </button>
                </div>
              ))}
            </div>
          )}

          <h2 className="text-base font-bold mb-3 text-white">Ağa Dahil Kanallar</h2>
          <p className="text-xs admin-text-muted mb-3">
            Kanallar mesaj atmadığı için otomatik keşfedilemiyor — ID'sini elle ekleyip açık/kapalı yapabilirsin.
          </p>
          <div className="flex gap-2 mb-3 flex-wrap">
            <Input
              value={newChannelId}
              onChange={(e) => setNewChannelId(e.target.value)}
              placeholder="Kanal ID (örn: -1001234567890)"
              className="w-56"
            />
            <Input
              value={newChannelTitle}
              onChange={(e) => setNewChannelTitle(e.target.value)}
              placeholder="Etiket (opsiyonel)"
              className="w-48"
            />
            <Button onClick={addChannel}>Ekle</Button>
          </div>
          {channels.length === 0 ? (
            <p className="admin-text-muted text-sm mb-8">Henüz kanal eklenmedi.</p>
          ) : (
            <div className="flex flex-col gap-2.5 mb-8">
              {channels.map((c) => (
                <div key={c.id} className="admin-card flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="font-semibold text-sm text-white">{c.title || c.username || c.channelId}</p>
                    <p className="text-xs admin-text-muted">{c.channelId}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleChannel(c)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        c.enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'
                      }`}
                    >
                      {c.enabled ? 'Açık' : 'Kapalı'}
                    </button>
                    <Button variant="outline" size="sm" onClick={() => removeChannel(c.id)}>Kaldır</Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <h2 className="text-base font-bold mb-3 text-white">Son Çapraz Banlar</h2>
          {logs.length === 0 ? (
            <p className="admin-text-muted text-sm">Henüz kayıt yok.</p>
          ) : (
            <div className="admin-card p-4">
              {logs.map((l) => (
                <div key={l.id} className="py-2 border-b admin-border last:border-0 text-sm">
                  <strong className="text-white">{l.firstName || (l.username ? `@${l.username}` : l.telegramId)}</strong>{' '}
                  <span className={l.action === 'unban' ? 'text-emerald-400' : 'text-rose-400'}>
                    {l.action === 'unban' ? '✅ Ban kaldırıldı' : '🚫 Banlandı'}
                  </span>{' '}
                  <span className="admin-text-muted">
                    — kaynak grup {groupDisplayName(l.sourceGroupId)} · {l.successCount}/{l.targetCount} grupta {l.action === 'unban' ? 'ban kaldırıldı' : 'banlandı'} ·{' '}
                    {new Date(l.createdAt).toLocaleString('tr-TR')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function BotManagementPage() {
  return (
    <div className="admin-page-container">
      <h1 className="font-display text-2xl font-extrabold mb-1 text-white">Bot Yönetimi</h1>
      <p className="text-sm admin-text-muted mb-6">
        Gruplar, Randy ve Çapraz Ban tek yerde.
      </p>

      <Tabs defaultValue="groups" className="w-full">
        <TabsList>
          <TabsTrigger value="groups">Gruplar</TabsTrigger>
          <TabsTrigger value="randy">Randy</TabsTrigger>
          <TabsTrigger value="crossban">Çapraz Ban</TabsTrigger>
        </TabsList>
        <TabsContent value="groups" className="mt-6"><GroupsTab /></TabsContent>
        <TabsContent value="randy" className="mt-6"><RandyTab /></TabsContent>
        <TabsContent value="crossban" className="mt-6"><CrossBanTab /></TabsContent>
      </Tabs>
    </div>
  )
}
