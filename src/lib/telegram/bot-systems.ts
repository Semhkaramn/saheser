// Botun ana modüllerinin tek tanım yeri. "Bot Ayarları" sayfasındaki
// aç/kapa listesi buradan üretilir. Gerçek aç/kapa durumu BotSystemSetting
// tablosunda tutulur (bulunmuyorsa varsayılan: açık).

export type BotSystemKey =
  | 'broadcast'
  | 'randy'
  | 'classic_giveaway'
  | 'auto_tag'
  | 'weekly_rewards'
  | 'activity_rewards'
  | 'gpt'
  | 'cross_ban'
  | 'sponsor_approval'
  | 'purchase_approval'

export interface BotSystemDef {
  key: BotSystemKey
  label: string
  description: string
}

export const BOT_SYSTEMS: BotSystemDef[] = [
  { key: 'broadcast', label: 'Toplu Mesaj', description: 'Bot DM panelinden tüm kullanıcılara mesaj gönderme.' },
  { key: 'randy', label: 'Randy', description: 'Buton tabanlı özel çekiliş sistemi — kanal/mesaj şartı, puan ödülü.' },
  { key: 'classic_giveaway', label: 'Klasik Çekiliş', description: 'Rastgele anlarda mesaj atan ilk kişinin kazandığı çekiliş.' },
  { key: 'auto_tag', label: 'Otomatik Etiketleme', description: 'Belirli aralıklarla grup üyelerini otomatik etiketleme.' },
  { key: 'weekly_rewards', label: 'Haftalık Ödüller', description: 'Her hafta en aktif üyelere otomatik ödül duyurusu.' },
  { key: 'activity_rewards', label: 'Aktiflik Ödülleri', description: 'Manuel başlat/durdur ile aktiflik yarışması.' },
  { key: 'gpt', label: 'GPT Sohbet', description: 'Grupta GPT destekli otomatik yanıt sistemi.' },
  { key: 'cross_ban', label: 'Çapraz Ban', description: 'Bir grupta banlanan kullanıcı diğer tüm gruplardan da banlanır.' },
  { key: 'sponsor_approval', label: 'Sponsor Onayı', description: 'Sponsor bilgisi girişlerinin bot üzerinden grupta onaylanması.' },
  { key: 'purchase_approval', label: 'Sipariş Onayı', description: 'Market siparişlerinin bot üzerinden grupta onaylanması.' },
]
