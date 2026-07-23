import { prisma } from '@/lib/prisma'
import { sendTelegramMessage } from '../core'
import { isBotSystemEnabled } from '../bot-system-check'

// Python bot'taki (gpt_service.py) karakter, atlama kuralları ve özel
// cevaplar birebir buraya taşındı.

const SYSTEM_PROMPT = `Sen Harley adında tatlı bir kızsın ve Telegram grubunda sohbet ediyorsun.

KARAKTER:
- Samimi, sıcak, doğal bir insansın
- Bazen cilveli ama abartısız
- Ruh halin değişken (enerjik / sakin / dalgın / nazlı)
- Gerçek zamanlı sohbet ediyormuş gibi konuşursun

KONUŞMA TARZI:
İçinden rastgele bir tarz seç ve ona göre cevap ver:

- Kısa yorum: "hahaha bu baya iyiymiş", "cidden mi ya", "şaka gibi"
- Soru sorma: "ne yaptın bugün", "nasıl geçti günün", "ciddii mi"
- Tepki: "ahahaha", "yaa off", "hımm"
- Kısa sohbet: 1-3 cümlelik doğal anlatım

DİL STİLİ:
- Emoji kullanma
- ":D", "ahaha", "hahaha", "yaa", "hımm" serbest
- Bazen cümleler tam bitmeyebilir, doğal konuşma gibi
- Fazla süslü veya kitap gibi konuşma

ÇOK ÖNEMLİ KURALLAR:
- ASLA "YORUM MODU:", "REAKSİYON MODU:", "SORU MODU:", "SOHBET MODU:" gibi etiketler yazma
- ASLA hangi modda olduğunu belirtme veya açıklama
- Sadece doğrudan cevabını yaz, başka bir şey ekleme
- Ezber cümle kullanma, farklı ifadeler üret
- İnsan gibi hızlı düşünülmeden yazılmış hissi ver`

const SKIP_PATTERNS = [
  // Randy mesajları
  'randy başladı', 'randy sona erdi', 'katılımcı:', 'kazananlar:', '🎉 katıl', '🎲 randy',
  // Çekiliş mesajları
  'çekiliş başladı', 'çekilişi kazandınız', 'çekiliş sona erdi', 'çekiliş kazananı', '🎁 çekiliş',
  // Aktiflik mesajları
  'aktiflik liderleri', 'en aktif', 'aktivite sıralaması', 'haftalık aktivite', 'aylık aktivite', 'günlük aktivite',
  '🏆 haftalık', '🏆 aylık', '🏆 günlük',
  // İstatistik komutları ve çıktıları
  '.günlük', '.haftalık', '.aylık', '.aktiflik', 'bugün yazdı', 'bu hafta yazdı', 'bu ay yazdı', 'mesaj istatistik',
  // Roll mesajları
  'roll başladı', 'roll sonlandırıldı', 'roll durumu', 'adım kaydedildi',
]

// GPT cevabının başına bazen sızan mod etiketleri - kullanıcıya gitmeden temizlenir.
const MODE_PREFIXES = [
  'Harley:', 'harley:', 'HARLEY:',
  'YORUM MODU:', 'Yorum Modu:', 'yorum modu:',
  'REAKSİYON MODU:', 'Reaksiyon Modu:', 'reaksiyon modu:',
  'SORU MODU:', 'Soru Modu:', 'soru modu:',
  'SOHBET MODU:', 'Sohbet Modu:', 'sohbet modu:',
]

function turkishLower(text: string): string {
  const map: Record<string, string> = { İ: 'i', I: 'ı', Ğ: 'ğ', Ü: 'ü', Ş: 'ş', Ö: 'ö', Ç: 'ç' }
  let result = text
  for (const [upper, lower] of Object.entries(map)) result = result.split(upper).join(lower)
  return result.toLowerCase()
}

function shouldSkipGpt(text: string): boolean {
  if (!text) return true
  const lower = turkishLower(text.trim())
  return SKIP_PATTERNS.some((p) => lower.includes(p))
}

async function getGptResponse(userMessage: string, userName: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // ⚠️ PERFORMANS: "gpt-3.5-turbo" + 20 saniyelik zaman aşımı, bot çok
        // yavaş cevap veriyormuş gibi hissettiriyordu (webhook cevabı bu
        // süre boyunca bekletiliyordu). "gpt-4o-mini" hem daha hızlı hem
        // daha ucuz - zaman aşımını da 8 saniyeye indirdik.
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `${userName}: ${userMessage}` },
        ],
        max_tokens: 150,
        temperature: 0.9,
      }),
      signal: AbortSignal.timeout(8_000),
    })

    if (!res.ok) return null
    const data = await res.json()
    let content = (data.choices?.[0]?.message?.content || '').trim()
    if (!content) return null

    // Bazen cevabın başına sızan mod etiketlerini ("YORUM MODU:" vb.) temizle
    for (const prefix of MODE_PREFIXES) {
      if (content.startsWith(prefix)) {
        content = content.slice(prefix.length).trim()
        break
      }
    }
    return content || null
  } catch {
    return null
  }
}

export async function getGptSettings(groupId: string) {
  return prisma.gptSettings.findUnique({ where: { groupId } })
}

export async function setGptSettings(groupId: string, data: Partial<{ enabled: boolean; triggerWord: string }>) {
  return prisma.gptSettings.upsert({
    where: { groupId },
    update: data,
    create: { groupId, enabled: data.enabled ?? false, triggerWord: data.triggerWord ?? 'harley' },
  })
}

/**
 * Mesaj bir grup içinde gönderildiğinde çağrılır. GPT bu grupta açıksa ve
 * mesaj tetikleyici kelimeyi içeriyorsa, gruba bir cevap gönderir.
 * OPENAI_API_KEY tanımlı değilse tamamen no-op'tur.
 */
export async function maybeSendGptReply(groupId: string, text: string, message: any): Promise<void> {
  if (!process.env.OPENAI_API_KEY) return
  if (!(await isBotSystemEnabled('gpt'))) return
  if (!text || shouldSkipGpt(text)) return

  const settings = await prisma.gptSettings.findUnique({ where: { groupId } })
  if (!settings?.enabled) return

  const lower = turkishLower(text)
  const triggerLower = turkishLower(settings.triggerWord)
  // Varsayılan tetikleyici "harley" ise, yazım hatalarını da (harleyy,
  // harleyyy gibi) tetikleyici say - Python bot'taki davranışla aynı.
  const hasTriggerWord =
    triggerLower === 'harley'
      ? ['harley', 'harleyy', 'harleyyy'].some((k) => lower.includes(k))
      : lower.includes(triggerLower)

  // ✅ Bota (GPT mesajına) reply yapılırsa da cevap ver - tetikleyici kelime
  // olmasa bile. Ama Randy mesajına reply yapılırsa ASLA cevap verme (o
  // katılım/duyuru mesajı, GPT sohbetiyle alakası yok).
  let isReplyToBot = false
  const repliedMessage = message.reply_to_message
  if (!hasTriggerWord && repliedMessage?.from?.is_bot) {
    const isRandyMessage = repliedMessage.message_id
      ? await prisma.randy.findFirst({
          where: { targetGroupId: groupId, messageId: repliedMessage.message_id },
          select: { id: true },
        })
      : null
    isReplyToBot = !isRandyMessage
  }

  if (!hasTriggerWord && !isReplyToBot) return

  const reply = await getGptResponse(text, message.from?.first_name || 'Kullanıcı')
  if (!reply) return

  await sendTelegramMessage(groupId, reply, { replyToMessageId: message.message_id })
}
