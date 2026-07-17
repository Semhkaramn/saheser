/**
 * 🔒 Anonymous Admin Utilities
 * Telegram'da anonim olarak mesaj gönderen adminleri tespit eder ve yönetir.
 *
 * Anonim admin durumu:
 * - message.from.id = 1087968824 (GroupAnonymousBot ID)
 * - message.sender_chat = grup/kanal bilgisi (gerçek gönderen)
 *
 * Kurallar:
 * - Anonim adminler veritabanına kaydedilmez
 * - Anonim adminler roll listesine eklenmez
 * - Anonim adminler puan kazanmaz
 * - Anonim adminler komut kullanabilir (admin yetkileriyle)
 */

// GroupAnonymousBot ID - Telegram tarafından kullanılır
export const GROUP_ANONYMOUS_BOT_ID = 1087968824

// Telegram Service Account ID - Bağlı kanallardan gelen mesajlarda kullanılır
// Bu hesap "Telegram" adıyla görünür ve kanal mesajlarını gruplara yönlendirir
export const TELEGRAM_SERVICE_ACCOUNT_ID = 777000

/**
 * Mesajın Telegram servis hesabından (bağlı kanal) gelip gelmediğini kontrol eder
 * Bu hesap kanal mesajlarını gruplara otomatik yönlendirir
 * @param message Telegram message objesi
 * @returns true = Telegram servis hesabı (kanal mesajı), false = normal kullanıcı
 */
export function isTelegramServiceAccount(message: any): boolean {
  const fromId = message.from?.id
  return fromId === TELEGRAM_SERVICE_ACCOUNT_ID
}

/**
 * Mesajın kanal adına gönderilip gönderilmediğini kontrol eder
 * sender_chat varsa mesaj bir kanal/grup adına gönderilmiştir
 * @param message Telegram message objesi
 * @returns true = kanal/grup adına gönderilmiş, false = normal kullanıcı
 */
export function isChannelPost(message: any): boolean {
  // sender_chat varsa bu bir kanal/grup adına gönderilmiş mesajdır
  // Anonim admin olmasa bile (örn: bağlı kanal mesajları)
  return !!message.sender_chat
}

/**
 * Mesajın sistem mesajı olup olmadığını kontrol eder
 * Telegram servis hesabı veya kanal adına gönderilen mesajlar sistem mesajıdır
 * Bu mesajlar puan, roll vb. sistemlere dahil edilmemeli
 * @param message Telegram message objesi
 * @returns true = sistem mesajı (kayıt dışı bırakılmalı), false = normal kullanıcı mesajı
 */
export function isSystemMessage(message: any): boolean {
  // Telegram servis hesabından gelen mesajlar (bağlı kanal)
  if (isTelegramServiceAccount(message)) {
    return true
  }

  // Anonim admin mesajları (GroupAnonymousBot)
  if (isAnonymousAdmin(message)) {
    return true
  }

  // Kanal adına gönderilen mesajlar (sender_chat var ama anonim admin değil)
  // Bu durumda mesaj bir kanal tarafından gönderilmiştir
  if (message.sender_chat && message.from?.id !== GROUP_ANONYMOUS_BOT_ID) {
    return true
  }

  return false
}

/**
 * Mesajın anonim bir admin tarafından gönderilip gönderilmediğini kontrol eder
 * @param message Telegram message objesi
 * @returns true = anonim admin, false = normal kullanıcı
 */
export function isAnonymousAdmin(message: any): boolean {
  // from.id GroupAnonymousBot ID'si mi?
  const fromId = message.from?.id
  if (fromId !== GROUP_ANONYMOUS_BOT_ID) {
    return false
  }

  // sender_chat varsa bu anonim admin mesajıdır
  return !!message.sender_chat
}

/**
 * Anonim admin mesajından grup/kanal ID'sini al
 * @param message Telegram message objesi
 * @returns sender_chat.id veya null
 */
export function getAnonymousAdminChatId(message: any): number | null {
  if (!isAnonymousAdmin(message)) {
    return null
  }
  return message.sender_chat?.id || null
}

/**
 * Anonim admin mesajından grup/kanal başlığını al
 * @param message Telegram message objesi
 * @returns sender_chat.title veya null
 */
export function getAnonymousAdminChatTitle(message: any): string | null {
  if (!isAnonymousAdmin(message)) {
    return null
  }
  return message.sender_chat?.title || null
}

/**
 * Anonim admin mesajından grup/kanal tipini al
 * @param message Telegram message objesi
 * @returns sender_chat.type veya null (group, supergroup, channel)
 */
export function getAnonymousAdminChatType(message: any): string | null {
  if (!isAnonymousAdmin(message)) {
    return null
  }
  return message.sender_chat?.type || null
}

/**
 * Mesaj anonim admin tarafından mı gönderildi ve admin komutlarını kullanabilir mi?
 * Anonim adminler grubun adminleri olduğu için otomatik olarak admin yetkisine sahiptir.
 *
 * @param message Telegram message objesi
 * @returns true = anonim admin, admin komutlarını kullanabilir
 */
export function canAnonymousAdminUseCommands(message: any): boolean {
  if (!isAnonymousAdmin(message)) {
    return false
  }

  // sender_chat.id ile chat.id eşleşmeli (aynı gruptan anonim admin)
  const senderChatId = message.sender_chat?.id
  const chatId = message.chat?.id

  if (!senderChatId || !chatId) {
    return false
  }

  // Mutlak değer karşılaştırması (- işareti farkını gidermek için)
  const normalizedSenderChatId = String(senderChatId).replace(/-/g, '')
  const normalizedChatId = String(chatId).replace(/-/g, '')

  return normalizedSenderChatId === normalizedChatId
}

/**
 * Mesaj göndereni belirle - anonim admin mi yoksa normal kullanıcı mı
 * @param message Telegram message objesi
 * @returns { isAnonymous: boolean, userId: string | null, displayName: string | null }
 */
export function getMessageSender(message: any): {
  isAnonymous: boolean
  userId: string | null
  displayName: string | null
  username: string | null
  firstName: string | null
  lastName: string | null
} {
  if (isAnonymousAdmin(message)) {
    // Anonim admin - gerçek kullanıcı bilgisi yok
    return {
      isAnonymous: true,
      userId: null, // Anonim adminlerin gerçek userId'si bilinmiyor
      displayName: message.sender_chat?.title || 'Anonim Admin',
      username: message.sender_chat?.username || null,
      firstName: null,
      lastName: null
    }
  }

  // Normal kullanıcı
  return {
    isAnonymous: false,
    userId: message.from?.id ? String(message.from.id) : null,
    displayName: message.from?.first_name || message.from?.username || 'Bilinmeyen',
    username: message.from?.username || null,
    firstName: message.from?.first_name || null,
    lastName: message.from?.last_name || null
  }
}
