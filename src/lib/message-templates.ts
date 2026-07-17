import { prisma } from '@/lib/prisma'
import { getCachedData, enhancedCache, CacheTTL } from '@/lib/enhanced-cache'

const TEMPLATES_TAG = 'message_templates'

export interface TemplateDef {
  key: string
  category: string
  label: string
  description: string
  variables: string[]
  defaultContent: string
}

// ============================================================
// TÜM BOT MESAJLARININ TEK MERKEZİ LİSTESİ
// Admin panelinde ("Bot Mesajları") bunlar listelenir ve düzenlenebilir.
// Bir mesaj için DB'de kayıt yoksa buradaki defaultContent kullanılır.
// {değişken} yazımıyla, mesaj içine gönderim anında gerçek değer basılır.
// ============================================================
export const TEMPLATE_DEFS: TemplateDef[] = [
  // ─── Randy ──────────────────────────────────────────────
  {
    key: 'randy_start',
    category: 'randy',
    label: 'Randy Başlangıç Mesajı',
    description: 'Randy gruba duyurulduğunda gönderilen mesaj',
    variables: ['aciklama_blok', 'katilimciSayisi', 'odul_blok', 'kazananSayisi'],
    defaultContent:
      '{aciklama_blok}👥 {katilimciSayisi} katılımcı{odul_blok}\n\n🏆 Kazanan: {kazananSayisi} kişi',
  },
  {
    key: 'randy_kazanan',
    category: 'randy',
    label: 'Randy Kazanan Mesajı',
    description: 'Randy sona erince gönderilen kazanan duyurusu',
    variables: ['baslik_blok', 'katilimciSayisi', 'odul_blok', 'kazananListesi'],
    defaultContent:
      '{baslik_blok}👥 {katilimciSayisi} katılımcı{odul_blok}\n\n🏆 Kazananlar:\n{kazananListesi}\nTebrikler! 🎊',
  },
  {
    key: 'randy_katil_butonu',
    category: 'randy',
    label: 'Randy Katıl Butonu Metni',
    description: 'Randy mesajındaki katılım butonunun üzerindeki yazı',
    variables: [],
    defaultContent: '🎉 Katıl',
  },
  {
    key: 'randy_basariyla_katildin',
    category: 'randy',
    label: 'Randy - Katılım Başarılı',
    description: 'Kullanıcı Randy\'ye katılınca gösterilen bildirim',
    variables: [],
    defaultContent: '🎉 Başarıyla katıldınız!',
  },

  // ─── Sponsor Onayı (Aff) ─────────────────────────────────
  {
    key: 'sponsor_onay_approved',
    category: 'sponsor_approval',
    label: 'Sponsor Onaylandı Bildirimi',
    description: 'Admin sponsor bilgisini onaylayınca kullanıcıya giden DM',
    variables: ['sponsorAdi'],
    defaultContent: '🔔 <b>{sponsorAdi}</b> referansın için karar verildi: <b>Ref Geçildi</b>',
  },
  {
    key: 'sponsor_onay_rejected',
    category: 'sponsor_approval',
    label: 'Sponsor Reddedildi Bildirimi',
    description: 'Admin sponsor bilgisini reddedince kullanıcıya giden DM',
    variables: ['sponsorAdi'],
    defaultContent: '🔔 <b>{sponsorAdi}</b> referansın için karar verildi: <b>Reddedildi</b>',
  },
  {
    key: 'sponsor_onay_post_deposit',
    category: 'sponsor_approval',
    label: 'Sponsor - Yatırım Sonrası Bildirimi',
    description: 'Admin "yatırım sonrası tekrar bildir" seçince giden DM',
    variables: ['sponsorAdi'],
    defaultContent:
      '🔔 <b>{sponsorAdi}</b> referansın için karar verildi: <b>Yatırım Sonrası</b>\n\n💰 Yatırım yaptıysan "Sponsorlarım" sayfandan tekrar bildirebilirsin.',
  },
  {
    key: 'sponsor_onay_incorrect',
    category: 'sponsor_approval',
    label: 'Sponsor - Bilgi Hatalı Bildirimi',
    description: 'Admin girilen bilgiyi hatalı bulunca giden DM',
    variables: ['sponsorAdi'],
    defaultContent:
      '🔔 <b>{sponsorAdi}</b> referansın için karar verildi: <b>Bilgi Hatalı</b>\n\n❗ Girdiğin bilgi hatalı görünüyor. "Sponsorlarım" sayfasından düzeltip tekrar gönderebilirsin.',
  },

  // ─── Market Sipariş Onayı ────────────────────────────────
  {
    key: 'siparis_tamamlandi',
    category: 'siparis',
    label: 'Sipariş Tamamlandı',
    description: 'Sipariş onaylanıp teslim edildiğinde giden DM',
    variables: ['itemName', 'pointsSpent', 'teslimatBlok'],
    defaultContent:
      '🎉 <b>Siparişiniz Tamamlandı!</b>\n\n✅ Ürün: {itemName}\n💰 Fiyat: {pointsSpent} puan\n\n{teslimatBlok}Siparişiniz onaylandı ve teslim edildi!',
  },
  {
    key: 'siparis_islemde',
    category: 'siparis',
    label: 'Sipariş İşleme Alındı',
    description: 'Sipariş işleme alındığında giden DM',
    variables: ['itemName', 'pointsSpent', 'teslimatBlok'],
    defaultContent:
      '⏳ <b>Siparişiniz İşleme Alındı</b>\n\n📦 Ürün: {itemName}\n💰 Fiyat: {pointsSpent} puan\n\n{teslimatBlok}Siparişiniz hazırlanıyor. Lütfen bekleyiniz...',
  },
  {
    key: 'siparis_iptal',
    category: 'siparis',
    label: 'Sipariş İptal/Reddedildi',
    description: 'Sipariş reddedilip puan iade edildiğinde giden DM',
    variables: ['itemName', 'pointsSpent', 'teslimatBlok'],
    defaultContent:
      '❌ <b>Siparişiniz İptal Edildi</b>\n\n📦 Ürün: {itemName}\n💰 İade Edilen Puan: {pointsSpent}\n\n{teslimatBlok}Puanlarınız hesabınıza iade edildi.',
  },
  {
    key: 'siparis_beklemede',
    category: 'siparis',
    label: 'Sipariş Beklemede',
    description: 'Sipariş beklemede durumuna geçtiğinde giden DM',
    variables: ['itemName', 'pointsSpent'],
    defaultContent:
      '🔔 <b>Sipariş Durumu Güncellendi</b>\n\n📦 Ürün: {itemName}\n💰 Fiyat: {pointsSpent} puan\n\nSiparişiniz beklemede. En kısa sürede işleme alınacak.',
  },

  // ─── Seviye Atlama & Çark ────────────────────────────────
  {
    key: 'rutbe_seviye_atladi',
    category: 'rutbe',
    label: 'Seviye Atlama Bildirimi',
    description: 'Kullanıcı yeni bir rütbeye ulaşınca grupta paylaşılan mesaj',
    variables: ['mention', 'icon', 'isim', 'xp'],
    defaultContent: '🎉 {mention} seviye atladı! {icon} <b>{isim}</b> 💎 {xp} XP',
  },
  {
    key: 'cark_sifirlama_dm',
    category: 'cark',
    label: 'Çark Sıfırlama Bildirimi (DM)',
    description: 'Günlük çark hakları sıfırlandığında kullanıcılara giden özel mesaj',
    variables: ['siteName', 'firstName', 'dailySpins', 'appUrl'],
    defaultContent:
      '🎡 {siteName} - Günlük Çark Hakkın Yenilendi!\n\nMerhaba {firstName}! 🎉\n\nGünlük çark haklarınız sıfırlandı ve {dailySpins} yeni hak kazandınız! 🎊\n\n🎯 Hemen çarkı çevir, ödülünü kazan!\n🌐 {appUrl}/wheel\n\nBol şanslar! 🍀\n\n— {siteName} Ekibi',
  },

  // ─── Bilet Sistemi ───────────────────────────────────────
  {
    key: 'bilet_katilim',
    category: 'bilet',
    label: 'Bilete Katılım Onayı',
    description: 'Kullanıcı bir bilet etkinliğine katılınca giden DM',
    variables: ['etkinlikAdi'],
    defaultContent: '🎟️ <b>{etkinlikAdi}</b> biletine katıldınız!\n\nYatırımınız kontrol edildikten sonra bilet numaranız size bildirilecek.',
  },
  {
    key: 'bilet_numara_atandi',
    category: 'bilet',
    label: 'Bilet Numarası Atandı',
    description: 'Admin bilet numaralarını oluşturunca kullanıcıya giden DM',
    variables: ['etkinlikAdi', 'numaralar'],
    defaultContent: '🎟️ <b>{etkinlikAdi}</b> için bilet numaralarınız: {numaralar}',
  },
]

export function getTemplateDef(key: string): TemplateDef | undefined {
  return TEMPLATE_DEFS.find((d) => d.key === key)
}

/**
 * Bir şablonun güncel içeriğini döndürür: DB'de override varsa onu,
 * yoksa koddaki varsayılanı. Sonuç kısa süreliğine cache'lenir.
 */
export async function getTemplateContent(key: string): Promise<string> {
  const def = getTemplateDef(key)
  const fallback = def?.defaultContent || ''

  return getCachedData(
    `msgtpl:${key}`,
    async () => {
      const row = await prisma.messageTemplate.findUnique({ where: { key } })
      return row?.content ?? fallback
    },
    { ttl: CacheTTL.LONG, tags: [TEMPLATES_TAG] }
  )
}

/**
 * {degisken} yer tutucularını verilen değerlerle değiştirir.
 * Karşılığı olmayan bir yer tutucu varsa boş string ile değiştirilir.
 */
export function renderTemplate(content: string, vars: Record<string, string | number | undefined>): string {
  return content.replace(/\{(\w+)\}/g, (_, key) => {
    const value = vars[key]
    return value === undefined || value === null ? '' : String(value)
  })
}

/** Bir şablonu render edip döndürür - en sık kullanılan kısayol. */
export async function renderTemplateByKey(key: string, vars: Record<string, string | number | undefined>): Promise<string> {
  const content = await getTemplateContent(key)
  return renderTemplate(content, vars)
}

export async function invalidateTemplatesCache(): Promise<void> {
  await enhancedCache.invalidateByTag(TEMPLATES_TAG)
}
