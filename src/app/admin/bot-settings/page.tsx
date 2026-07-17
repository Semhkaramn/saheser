'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

interface SystemRow {
  key: string
  label: string
  description: string
  enabled: boolean
}

interface BotStatus {
  ok: boolean
  me?: { username: string; first_name: string }
  webhookInfo?: { url: string; pending_update_count: number; last_error_message?: string; last_error_date?: number; allowed_updates?: string[] }
  error?: string
}

interface NotificationSetting {
  key: string
  label: string
  description: string
  value: boolean
}

interface Template {
  key: string
  category: string
  label: string
  description: string
  variables: string[]
  content: string
  isCustomized: boolean
  updatedAt: string | null
}

const NOTIFICATION_DEFS: { key: string; label: string; description: string }[] = [
  { key: 'notify_order_approved', label: 'Sipariş Onay Bildirimi', description: 'Market siparişleri onaylandığında/reddedildiğinde kullanıcıya özelden mesaj gönderilsin' },
  { key: 'notify_level_up', label: 'Seviye Atlama Bildirimi', description: 'Kullanıcı seviye atladığında grupta bildirim mesajı gönderilsin' },
  { key: 'notify_wheel_reset', label: 'Çark Sıfırlama Bildirimi', description: 'Şans çarkı sıfırlandığında kullanıcılara özelden bildirim gönderilsin' },
  { key: 'roll_enabled', label: 'Roll Sistemi', description: 'Roll komutları (/başlat, /kaydet, /durum vs.) kullanılabilsin' },
]

const CATEGORY_LABELS: Record<string, string> = {
  randy: '🎲 Randy',
  sponsor_approval: '✅ Sponsor Onayı (Aff)',
  siparis: '🛒 Market Sipariş Bildirimleri',
  rutbe: '🏆 Seviye Atlama',
  cark: '🎡 Şans Çarkı',
  bilet: '🎟️ Bilet Sistemi',
}

// Bot Ayarları + Bot Mesajları buraya birleştirildi (eskiden 2 ayrı sayfaydı,
// ikisi de "botun genel davranışı" ile ilgili olduğu için tek sayfada
// sekmeli hale getirildi).
export default function BotSettingsPage() {
  const [tab, setTab] = useState('genel')

  // ── Genel sekmesi state ──
  const [systems, setSystems] = useState<SystemRow[]>([])
  const [status, setStatus] = useState<BotStatus | null>(null)
  const [notifications, setNotifications] = useState<NotificationSetting[]>(
    NOTIFICATION_DEFS.map((n) => ({ ...n, value: false }))
  )
  const [loading, setLoading] = useState(true)
  const [siteUrl, setSiteUrl] = useState('')
  const [rewiring, setRewiring] = useState(false)
  const isLive = Boolean(status?.webhookInfo?.url && status.webhookInfo.url.length > 0)

  // ── Mesajlar sekmesi state ──
  const [templates, setTemplates] = useState<Template[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)

  useEffect(() => {
    loadGeneral()
    loadTemplates()
    if (typeof window !== 'undefined') setSiteUrl(window.location.origin)
  }, [])

  async function loadGeneral() {
    setLoading(true)
    try {
      const [botRes, settingsRes] = await Promise.all([
        fetch('/api/admin/bot-settings').then((r) => r.json()),
        fetch('/api/admin/settings').then((r) => r.json()),
      ])
      setSystems(botRes.systems || [])
      setStatus(botRes.status || null)

      const settingsList: { key: string; value: string }[] = settingsRes.settings || []
      setNotifications(
        NOTIFICATION_DEFS.map((n) => ({
          ...n,
          value: settingsList.find((s) => s.key === n.key)?.value === 'true',
        }))
      )
    } catch (e) {
      toast.error('Bot ayarları yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  async function loadTemplates() {
    setTemplatesLoading(true)
    try {
      const res = await fetch('/api/admin/message-templates')
      const data = await res.json()
      setTemplates(data.templates || [])
      const draftMap: Record<string, string> = {}
      for (const t of data.templates || []) draftMap[t.key] = t.content
      setDrafts(draftMap)
    } catch {
      toast.error('Şablonlar yüklenemedi')
    } finally {
      setTemplatesLoading(false)
    }
  }

  async function toggle(key: string, enabled: boolean) {
    setSystems((prev) => prev.map((s) => (s.key === key ? { ...s, enabled } : s)))
    try {
      const res = await fetch('/api/admin/bot-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, enabled }),
      })
      if (!res.ok) throw new Error()
      toast.success(enabled ? 'Sistem açıldı' : 'Sistem kapatıldı')
    } catch {
      toast.error('Güncellenemedi')
      loadGeneral()
    }
  }

  async function toggleNotification(key: string, value: boolean) {
    setNotifications((prev) => prev.map((n) => (n.key === key ? { ...n, value } : n)))
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: value.toString() }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      toast.success('Ayar güncellendi')
    } catch {
      toast.error('Güncellenemedi')
      setNotifications((prev) => prev.map((n) => (n.key === key ? { ...n, value: !value } : n)))
    }
  }

  async function rewireWebhook() {
    setRewiring(true)
    try {
      const res = await fetch('/api/admin/bot-settings/rewire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Hata')
      toast.success('Webhook yeniden bağlandı!')
      loadGeneral()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Webhook bağlanamadı')
    } finally {
      setRewiring(false)
    }
  }

  async function saveTemplate(key: string) {
    setSavingKey(key)
    try {
      const res = await fetch('/api/admin/message-templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, content: drafts[key] }),
      })
      if (!res.ok) throw new Error()
      toast.success('Mesaj kaydedildi')
      loadTemplates()
    } catch {
      toast.error('Kaydedilemedi')
    } finally {
      setSavingKey(null)
    }
  }

  async function resetTemplateToDefault(key: string) {
    setSavingKey(key)
    try {
      const res = await fetch(`/api/admin/message-templates?key=${encodeURIComponent(key)}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error()
      toast.success('Varsayılana döndürüldü')
      loadTemplates()
    } catch {
      toast.error('Sıfırlanamadı')
    } finally {
      setSavingKey(null)
    }
  }

  const categories = Array.from(new Set(templates.map((t) => t.category)))

  return (
    <div className="admin-page-container">
      <h1 className="font-display text-2xl font-extrabold mb-1 text-white">Bot Ayarları</h1>
      <p className="text-sm admin-text-muted mb-6">
        Modüller, bildirimler ve hazır mesajlar. Ayrıntılı ayarlar için bota özelden <code>/panel</code> yaz.
      </p>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList>
          <TabsTrigger value="genel">Genel</TabsTrigger>
          <TabsTrigger value="mesajlar">Mesajlar</TabsTrigger>
        </TabsList>

        <TabsContent value="genel" className="space-y-6 mt-6">
          <div className="admin-card p-4">
            <h2 className="text-lg font-semibold text-white mb-3">Bot Durumu</h2>
            {loading ? (
              <p className="admin-text-muted text-sm">Yükleniyor...</p>
            ) : status?.ok ? (
              <div className="text-sm space-y-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-2.5 h-2.5 rounded-full inline-block ${isLive ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                  <strong className="text-white">{isLive ? 'Bot aktif ve webhook bağlı' : 'Bot çalışıyor ama webhook bağlı değil'}</strong>
                </div>
                <p className="admin-text-muted">Bağlı bot: <code className="text-white/80">@{status.me?.username}</code></p>
                <p className="admin-text-muted break-all">Webhook: {status.webhookInfo?.url || '(ayarlanmamış)'}</p>
                <p className="admin-text-muted">Bekleyen güncelleme: {status.webhookInfo?.pending_update_count ?? 0}</p>
                <p className="admin-text-muted">
                  İzinli olay tipleri: {status.webhookInfo?.allowed_updates && status.webhookInfo.allowed_updates.length > 0
                    ? status.webhookInfo.allowed_updates.join(', ')
                    : 'hepsi (varsayılan)'}
                </p>
                {status.webhookInfo?.allowed_updates && !status.webhookInfo.allowed_updates.includes('chat_member') && (
                  <p className="text-amber-400">
                    ⚠️ "chat_member" izinli listede yok - ban/kick olayları bota hiç ulaşmıyor demektir (çapraz ban bu yüzden çalışmaz). "Webhook Yeniden Bağla"ya bas.
                  </p>
                )}
                {status.webhookInfo?.last_error_message && (
                  <p className="text-rose-400">Son hata: {status.webhookInfo.last_error_message}</p>
                )}
              </div>
            ) : (
              <p className="text-rose-400 text-sm">❌ Bot durumu alınamadı: {status?.error}</p>
            )}

            <div className="mt-4 flex gap-2 items-center">
              <input
                value={siteUrl}
                onChange={(e) => setSiteUrl(e.target.value)}
                className="admin-input flex-1"
                placeholder="https://siteniz.com"
              />
              <Button onClick={rewireWebhook} disabled={rewiring}>
                {rewiring ? 'Bağlanıyor...' : 'Webhook Yeniden Bağla'}
              </Button>
            </div>
            <p className="text-xs admin-text-muted mt-2">
              Bu buton, botun grup ekleme/çıkarma ve ban olaylarını (my_chat_member, chat_member) alabilmesi
              için gerekli izinlerle webhook'u yeniden kurar. Bot davranışı garip görünürse önce bunu dene.
            </p>
          </div>

          <div className="admin-card p-4">
            <h2 className="text-lg font-semibold text-white mb-3">Modüller</h2>
            <p className="text-xs admin-text-muted mb-3">
              Botun tüm açık/kapalı özellikleri — hem bot komut sistemleri hem bota start yapmış
              kullanıcılara/gruba gönderilen otomatik bildirimler tek listede.
            </p>
            {loading ? (
              <p className="admin-text-muted text-sm">Yükleniyor...</p>
            ) : (
              <div className="space-y-3">
                {notifications.map((n) => (
                  <div key={n.key} className="flex items-center justify-between border-b admin-border pb-3 last:border-0">
                    <div className="flex-1 pr-4">
                      <p className="text-white font-medium">{n.label}</p>
                      <p className="text-xs admin-text-muted">{n.description}</p>
                    </div>
                    <button
                      onClick={() => toggleNotification(n.key, !n.value)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        n.value ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'
                      }`}
                    >
                      {n.value ? 'Açık' : 'Kapalı'}
                    </button>
                  </div>
                ))}
                {systems.map((s) => (
                  <div key={s.key} className="flex items-center justify-between border-b admin-border pb-3 last:border-0">
                    <div>
                      <p className="text-white font-medium">{s.label}</p>
                      <p className="text-xs admin-text-muted">{s.description}</p>
                    </div>
                    <button
                      onClick={() => toggle(s.key, !s.enabled)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        s.enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'
                      }`}
                    >
                      {s.enabled ? 'Açık' : 'Kapalı'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="mesajlar" className="space-y-6 mt-6">
          <p className="text-sm admin-text-muted -mt-2">
            Botun özelden/grupta gönderdiği tüm hazır mesajlar — Randy, sponsor onayı, sipariş bildirimleri,
            seviye atlama, çark ve bilet mesajları. Metni değiştirip kaydet; istediğin zaman "Varsayılana Döndür"
            ile eski haline dönebilirsin.{' '}
            <code className="mx-1 px-1 rounded bg-white/10">{'{değişken}'}</code>
            yazımıyla gösterilen yerler gönderim anında gerçek bilgiyle değişir.
          </p>

          {templatesLoading ? (
            <p className="admin-text-muted text-sm">Yükleniyor...</p>
          ) : (
            <div className="space-y-8">
              {categories.map((category) => (
                <div key={category}>
                  <h2 className="text-lg font-semibold text-white mb-3">
                    {CATEGORY_LABELS[category] || category}
                  </h2>
                  <div className="space-y-4">
                    {templates
                      .filter((t) => t.category === category)
                      .map((t) => (
                        <div key={t.key} className="admin-card p-4">
                          <div className="flex items-start justify-between mb-2 gap-2">
                            <div>
                              <p className="text-white font-medium flex items-center gap-2">
                                {t.label}
                                {t.isCustomized && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                                    Özelleştirildi
                                  </span>
                                )}
                              </p>
                              <p className="text-xs admin-text-muted">{t.description}</p>
                              {t.variables.length > 0 && (
                                <p className="text-xs admin-text-muted mt-1">
                                  Değişkenler:{' '}
                                  {t.variables.map((v) => (
                                    <code key={v} className="mx-0.5 px-1 rounded bg-white/10">{`{${v}}`}</code>
                                  ))}
                                </p>
                              )}
                            </div>
                          </div>

                          <Textarea
                            value={drafts[t.key] ?? ''}
                            onChange={(e) => setDrafts((prev) => ({ ...prev, [t.key]: e.target.value }))}
                            rows={4}
                            className="admin-input w-full font-mono text-sm"
                          />

                          <div className="flex gap-2 mt-2">
                            <Button
                              size="sm"
                              onClick={() => saveTemplate(t.key)}
                              disabled={savingKey === t.key || drafts[t.key] === t.content}
                            >
                              {savingKey === t.key ? 'Kaydediliyor...' : 'Kaydet'}
                            </Button>
                            {t.isCustomized && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => resetTemplateToDefault(t.key)}
                                disabled={savingKey === t.key}
                              >
                                Varsayılana Döndür
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
