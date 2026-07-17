import { prisma } from '@/lib/prisma'
import { sendTelegramMessage } from '../core'
import { isBotSystemEnabled } from '../bot-system-check'

// randy-web'deki gpt servisinden uyarlandı. OPENAI_API_KEY ayarlanmadığı
// sürece bu özellik tamamen sessiz kalır (hiçbir hata/uyarı üretmez).

const SYSTEM_PROMPT = `Sen gruba özel, samimi ve tatlı bir sohbet botusun.

KARAKTER:
- Samimi, sıcak, doğal bir insan gibi konuşursun
- Bazen esprili ama abartısız
- Gerçek zamanlı sohbet ediyormuş gibi konuşursun

KONUŞMA TARZI:
- Kısa yorum, soru veya tepki ver (1-3 cümle)
- Emoji kullanma
- Fazla süslü veya kitap gibi konuşma

ÇOK ÖNEMLİ:
- Sadece doğrudan cevabını yaz, başka bir şey ekleme
- Hangi modda olduğunu asla belirtme`

const SKIP_PATTERNS = [
  'randy başladı', 'randy sona erdi', 'katıl', 'kazananlar:',
  'çekiliş başladı', 'çekilişi kazandınız', 'çekiliş sona erdi', 'çekiliş kazananı',
  'aktiflik liderleri', 'en aktif', 'aktivite sıralaması',
  '.günlük', '.haftalık', '.aylık', 'bugün yazdı', 'bu hafta yazdı', 'bu ay yazdı',
  'roll başladı', 'roll sonlandırıldı', 'roll durumu',
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
    return (data.choices?.[0]?.message?.content || '').trim() || null
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
  const hasTriggerWord = lower.includes(turkishLower(settings.triggerWord))

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
