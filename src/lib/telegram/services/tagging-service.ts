import { prisma } from '@/lib/prisma'
import { sendTelegramMessage } from '../core'
import { isBotSystemEnabled } from '../bot-system-check'

// "/naber" komutu için ilgi çekici, çeşitli cümle/soru havuzu - her etikette
// havuzdan RASTGELE bir tanesi seçilir, böylece art arda gelen mesajlar hep
// aynı olmuyor. İstersen bunu ileride admin panelinden düzenlenebilir hale
// getirebiliriz; şimdilik kod içinde geniş bir varsayılan havuz var.
export const NABER_PHRASES: string[] = [
  'Naber? 👋', 'Bugün nasıl geçiyor? 😄', 'Ne yapıyorsun şu an? 🤔', 'Aramızda mısın hala? 👀',
  'Bugün şansını denedin mi? 🍀', 'Puanların ne durumda? 💰', 'Yeni bir şey kaçırma! 🔥',
  'Hazır mısın? 🎉', 'Bugün form tutuyor musun? 💪', 'Sıradaki sen olabilirsin! 🎯',
  'Merhaba, orada mısın? 😊', 'Bir şeyler kaçıyor gibi, bak bakalım 👇', 'Uzun zamandır yoksun, naber? 🕐',
  'Bugün nasılsın bakalım? ✨', 'Aktif kalanlar kazanıyor, sen de ol! 🏆', 'Çarkı çevirdin mi bugün? 🎡',
  'Görev listesi seni bekliyor 📝', 'Bir dakikan var mı? ⏰', 'Ne düşünüyorsun bu konuda? 💭',
  'Bugün moralin nasıl? 😎', 'Kaçırma, tam zamanı! ⚡', 'Selam! Ne haber? 🙌', 'Nasıl gidiyor işler? 📈',
  'Sırada sen varsın belki 🎁', 'Bugün buradasın, iyi bari 👌', 'Bir göz atsana şuraya 👀',
  'Neler oluyor hayatında? 🌟', 'Aktivite zamanı! 🚀', 'Bugün ne yapıyorsun? 🎮', 'Hazır ol, bir şey geliyor 📢',
  'Sence bugün şanslı mısın? 🎰', 'Yeni haberler var, gördün mü? 📰', 'Merhaba merhaba! 👋',
  'Uzun zamandır sessizsin 🤫', 'Bir cevap bekliyoruz senden 💬', 'Bugünkü ruh halin ne? 😌',
  'Kimse seni unutmadı, naber? ❤️', 'Puan toplama zamanı! 💎', 'Şansını dene bakalım 🍀',
  'Aramıza katılan oldu mu bugün? 🎊', 'İyi misin, naber? 🌈', 'Bugün enerjin nasıl? ⚡',
  'Ne var ne yok? 🗣️', 'Sıcak haber var! 🔥', 'Bugün ilk sen ol! 🥇', 'Kaçırdığın bir şey olabilir 🧐',
  'Hoş geldin tekrar! 🎈', 'Bugünkü hedefin ne? 🎯', 'Bir merhaba de bari 😊', 'Nasıl vakit geçiriyorsun? ⌛',
  'Sıradaki kazanan sen olabilirsin 🏅', 'Aktif olanları seviyoruz, sen de aktif ol 💪',
  'Bugün burada mısın gerçekten? 👻', 'Yeni bir gün, yeni fırsatlar! 🌅', 'Neredesin böyle? 🔍',
  'Konuşalım biraz, naber? 💬', 'Bugün için bir planın var mı? 📅', 'Herkes seni merak ediyor 👥',
  'Bugün kendini nasıl hissediyorsun? 🙂', 'Bir tık uzaktasın büyük ödülden 🎁', 'Şansını denemeye ne dersin? 🎲',
  'Ekip seni özledi! 🥲', 'Aktiflik puanların artıyor mu? 📊', 'Bugün coşkun nasıl? 🎶',
  'Sıra sende, hazır mısın? 🚦', 'Merhaba! Kaç puanın var şu an? 💰', 'Bir haberimiz var, duydun mu? 📣',
  'İyi bir gün geçiriyor musun? ☀️', 'Bugün için motivasyonun nasıl? 🔋', 'Yeni bir hedef koydun mu? 🎯',
  'Selamlar, aramıza hoş geldin! 🌟', 'Aktivitene devam, güzel gidiyor 👏', 'Bugün ne kadar aktifsin? 📈',
  'Bir şey mi kaçırıyorsun acaba? 🤨', 'Herkes burada, sen neredesin? 🧭', 'Naber koçum? 😄',
  'Bugün havanda mısın? 🎈', 'Bir tık daha ve büyük ödül senin olabilir 🏆', 'Sessizliğini bozalım mı? 🔔',
  'Bugün kaç mesaj attın? 💬', 'Aramızdaki en aktif kim olacak bakalım 👀', 'Yeni fırsatlar seni bekliyor 🎁',
  'Naber, moralin yerinde mi? 😁', 'Bugün için bir tahminin var mı? 🔮', 'Sıradaki şanslı sen olabilirsin 🍀',
  'Aktif ol, kazan! 💪', 'Bugün burada olduğun için teşekkürler 🙏', 'Ne düşünüyorsun, katılır mısın? 🤝',
  'Bugün enerjik görünüyorsun (umarım) ⚡', 'Sohbete katılmaya ne dersin? 💭', 'Bir dakikan varsa bak şuraya 👇',
  'Naber, uzun zamandır yoktun 🕰️', 'Bugün nasıl bir gün geçiriyorsun? 🌤️', 'Herkes seni bekliyor 🎉',
  'Aktivite skorun yükseliyor mu? 📶', 'Bir şeyler paylaşmak ister misin? 💬', 'Selam! Bugün buradasın işte 😊',
  'Yeni bir başlangıç için hazır mısın? 🌱', 'Kazanmaya bir adım daha yakınsın 🏅', 'Naber, keyifler nasıl? 🎶',
  'Bugün hangi görevi tamamlayacaksın? ✅', 'Bir merhaba yeter, naber? 👋', 'Aramızda olduğun için mutluyuz 🥰',
  'Bugün için şansını konuşalım mı? 🎲', 'Sıcacık bir merhaba: naber? ☕', 'Yeni bir fırsat kapıda 🚪',
  'Bugün form durumun nasıl? 📊', 'Aktifliğin bizi mutlu ediyor 😄', 'Naber, ne var ne yok bakalım? 🗨️',
  'Bugün için hedefin belli mi? 🎯', 'Aramıza tekrar hoş geldin! 🎊', 'Bir şeyler soracağız, hazır mısın? ❓',
  'Naber, bugünkü planların ne? 📆', 'Şansını denemeden geçme! 🍀', 'Bugün için bir mesajın var mı? 💬',
  'Aktif kalmaya devam! 🚀', 'Naber, keyifler yolunda mı? 🙂', 'Bugün de buradasın, güzel! 👏',
]

/**
 * Havuzdan rastgele bir naber cümlesi seçer.
 */
export function pickRandomNaberPhrase(): string {
  return NABER_PHRASES[Math.floor(Math.random() * NABER_PHRASES.length)]
}

// randy-web'deki tagging_service mantığından uyarlandı.
// NOT: tamsite'de kullanıcılar tek bir global TelegramGroupUser kaydına
// sahip (grup başına ayrı satır yok) — bu yüzden "bu gruba etiketlenebilir"
// listesi, kullanıcının en son mesaj attığı grup (lastGroupId) üzerinden
// belirleniyor. Bir kullanıcı birden fazla grupta aktifse, sadece en son
// mesaj attığı grupta etiketlenir.

export async function getTaggingSettings(groupId: string) {
  return prisma.taggingSettings.findUnique({ where: { groupId } })
}

export async function setTaggingSettings(
  groupId: string,
  data: Partial<{ enabled: boolean; intervalMinutes: number; tagMessage: string }>
) {
  return prisma.taggingSettings.upsert({
    where: { groupId },
    update: data,
    create: {
      groupId,
      enabled: data.enabled ?? false,
      intervalMinutes: data.intervalMinutes ?? 60,
      tagMessage: data.tagMessage ?? '🎉 Selamlar!',
    },
  })
}

export async function setUserTaggable(telegramId: string, isTaggable: boolean) {
  await prisma.telegramGroupUser.updateMany({ where: { telegramId }, data: { isTaggable } })
}

/**
 * Admin bir kullanıcıyı "@kullaniciadi" ya da doğrudan telegram ID (sayı)
 * yazarak etiketleme dışında bırakabilir/tekrar dahil edebilir.
 */
export async function setUserTaggableByUsernameOrId(
  groupId: string,
  input: string,
  isTaggable: boolean
): Promise<{ ok: boolean; matchedName?: string }> {
  const cleaned = input.trim().replace(/^@/, '')

  const user = /^\d+$/.test(cleaned)
    ? await prisma.telegramGroupUser.findFirst({ where: { telegramId: cleaned } })
    : await prisma.telegramGroupUser.findFirst({ where: { lastGroupId: groupId, username: { equals: cleaned, mode: 'insensitive' } } })

  if (!user) return { ok: false }

  await setUserTaggable(user.telegramId, isTaggable)
  return { ok: true, matchedName: user.username ? `@${user.username}` : user.firstName || user.telegramId }
}

export async function getExcludedUsers(groupId: string) {
  return prisma.telegramGroupUser.findMany({
    where: { lastGroupId: groupId, isTaggable: false },
    orderBy: { lastMessageAt: 'desc' },
    select: { telegramId: true, username: true, firstName: true },
  })
}

interface TaggableUser {
  telegramId: string
  username: string | null
  firstName: string | null
}

async function getTaggableUsers(groupId: string): Promise<TaggableUser[]> {
  const users = await prisma.telegramGroupUser.findMany({
    where: { lastGroupId: groupId, isTaggable: true },
    select: { telegramId: true, username: true, firstName: true },
  })
  return shuffle(users)
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Bir kullanıcı için görünen ismi (mention metni) döner - "@kullanici" ya da
 * kullanıcı adı yoksa ilk adı. HTML etiketi İÇERMEZ - linki entities
 * dizisiyle (text_link) uyguluyoruz, çünkü Telegram'da parse_mode (HTML
 * etiketleri metin içinde) ile entities (offset tabanlı biçimlendirme) AYNI
 * mesajda birlikte kullanılamaz. Admin'in özel mesajı zaten entities olarak
 * geliyorsa (kalın yazı, premium emoji vb.), mention'ları da HTML yerine
 * entities olarak eklemek zorundayız - yoksa "<a href=...>" metni olduğu
 * gibi (link olmadan) görünür.
 */
function getMentionDisplayName(u: { username: string | null; firstName: string | null }): string {
  return u.username ? `@${u.username}` : u.firstName || 'Kullanıcı'
}

/**
 * Etiketleme işlemini çalıştırır.
 *  - batchSize=5 (varsayılan, "/etiket"): 5'erli gruplar halinde mention gönderir.
 *  - batchSize=1 ("/naber"): kişi kişi, tek tek mention gönderir.
 *  - entities: admin'in yazdığı mesajdaki premium emoji/kalın-italik gibi
 *    biçimlendirmeyi korumak için (mesaj her zaman metnin EN BAŞINDA olduğu
 *    için offset kaydırmaya gerek yok).
 * Serverless zaman aşımı riskine karşı bekleme süresi kısa tutuldu.
 */
export async function runTagging(
  groupId: string,
  message: string | null,
  options: { batchSize?: number; entities?: any[]; delayMs?: number; useRandomPhrasePool?: boolean } = {}
): Promise<{ sent: number; total: number; stopped: boolean }> {
  if (!(await isBotSystemEnabled('auto_tag'))) return { sent: 0, total: 0, stopped: true }

  const batchSize = options.batchSize ?? 5
  const delayMs = options.delayMs ?? (batchSize === 1 ? 2000 : 1200)

  const users = await getTaggableUsers(groupId)
  if (users.length === 0) return { sent: 0, total: 0, stopped: false }

  await prisma.taggingRun.upsert({
    where: { groupId },
    update: { status: 'running', sent: 0, total: users.length, startedAt: new Date() },
    create: { groupId, status: 'running', sent: 0, total: users.length },
  })

  let sent = 0
  let stopped = false

  for (let i = 0; i < users.length; i += batchSize) {
    const run = await prisma.taggingRun.findUnique({ where: { groupId } })
    if (run?.status === 'stopped') {
      stopped = true
      break
    }

    const batch = users.slice(i, i + batchSize)
    // "/naber" modunda her turda havuzdan rastgele farklı bir cümle seçilir;
    // sabit bir mesaj verilmişse ("/etiket" gibi) o kullanılır.
    const batchMessage = options.useRandomPhrasePool ? pickRandomNaberPhrase() : (message || '')

    // Mention'ları HTML yerine entities (text_link) olarak inşa ediyoruz -
    // böylece admin'in mesajındaki kendi formatlaması (kalın, premium emoji
    // vb. entities) ile çakışmaz, ikisi de aynı mesajda entities dizisinde
    // birlikte gönderilebilir.
    let mentionOffset = batchMessage.length + 2 // "\n\n" ayracı
    const mentionNames: string[] = []
    const mentionEntities = batch.map((u) => {
      const displayName = getMentionDisplayName(u)
      const entity = { type: 'text_link', offset: mentionOffset, length: displayName.length, url: `tg://user?id=${u.telegramId}` }
      mentionNames.push(displayName)
      mentionOffset += displayName.length + 1 // +1 = mention'lar arası boşluk
      return entity
    })
    const mentions = mentionNames.join(' ')
    const text = `${batchMessage}\n\n${mentions}`

    // Rastgele havuz modunda admin entities'i yok (her mesaj metni farklı
    // olduğu için eşleşmez) - sabit mesaj modunda ("/etiket") admin'in
    // orijinal entities'i (offset 0'dan başlıyor, mesaj hep en başta) aynen
    // korunur, mention entities'i sonuna eklenir.
    const baseEntities = options.useRandomPhrasePool ? [] : (options.entities || [])
    const allEntities = [...baseEntities, ...mentionEntities]

    try {
      await sendTelegramMessage(groupId, text, { entities: allEntities })
      sent += batch.length
    } catch {
      // Flood/hata durumunda bu batch'i atla, devam et
    }

    await prisma.taggingRun.update({ where: { groupId }, data: { sent } }).catch(() => {})

    if (i + batchSize < users.length) {
      await new Promise((r) => setTimeout(r, delayMs))
    }
  }

  await prisma.taggingRun.update({ where: { groupId }, data: { status: stopped ? 'stopped' : 'completed', sent } }).catch(() => {})
  await prisma.taggingSettings.updateMany({ where: { groupId }, data: { lastTaggedAt: new Date() } })

  return { sent, total: users.length, stopped }
}

export async function stopTaggingRun(groupId: string) {
  await prisma.taggingRun.updateMany({ where: { groupId, status: 'running' }, data: { status: 'stopped' } })
}

export async function getTaggingRunStatus(groupId: string) {
  return prisma.taggingRun.findUnique({ where: { groupId } })
}

/**
 * CRON job tarafından çağrılır: süresi gelmiş, enabled=true tüm grupları bulur.
 */
export async function getDueAutoTagGroups() {
  const settings = await prisma.taggingSettings.findMany({ where: { enabled: true } })
  const now = Date.now()
  return settings.filter((s) => {
    if (!s.lastTaggedAt) return true
    return now - s.lastTaggedAt.getTime() >= s.intervalMinutes * 60_000
  })
}
