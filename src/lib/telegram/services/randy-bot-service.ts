import { prisma } from '@/lib/prisma'
import { sendTelegramMessage, editTelegramMessage, pinChatMessage, getChatInfo, shiftEntitiesForEmbeddedText, deleteTelegramMessage } from '../core'
import { RANDY } from '../taslaklar'
import { invalidateRandyCache } from '../handlers/message-handler'
import { logActivity } from '@/lib/services/activity-log-service'
import { isBotSystemEnabled } from '../bot-system-check'
import { renderTemplateByKey, getTemplateContent } from '@/lib/message-templates'
import { SiteConfig } from '@/lib/site-config'

/**
 * Bot DM'i üzerinden bir Randy taslağı oluşturur. requirementType 'none' ise
 * şartsız, 'message_count'/'post_randy_messages' ise ilgili şart alanlarıyla
 * birlikte, kanal üyelik şartı da (opsiyonel) desteklenir.
 */

export async function createSimpleRandyDraft(input: {
  targetGroupId: string
  message: string
  winnerCount: number
  prizePoints?: number
  requirementType?: string
  messageCountPeriod?: string
  messageCountRequired?: number
  postRandyMessages?: number
  requireChannelMembership?: boolean
  membershipCheckChannelIds?: string
  pinMessage?: boolean
}) {
  const title = input.message.slice(0, 60) || 'Randy Çekilişi'
  return prisma.randy.create({
    data: {
      title,
      message: input.message,
      targetGroupId: input.targetGroupId,
      requirementType: input.requirementType || 'none',
      messageCountPeriod: input.messageCountPeriod,
      messageCountRequired: input.messageCountRequired,
      postRandyMessages: input.postRandyMessages,
      requireChannelMembership: input.requireChannelMembership || false,
      membershipCheckChannelIds: input.membershipCheckChannelIds,
      winnerCount: input.winnerCount,
      prizePoints: input.prizePoints || 0,
      pinMessage: input.pinMessage || false,
      status: 'draft',
    },
  })
}

/**
 * Taslak halindeki bir Randy'yi Telegram grubuna gönderip aktif hale getirir.
 */
export async function startRandy(randyId: string) {
  if (!(await isBotSystemEnabled('randy'))) return { success: false, error: 'Randy sistemi şu anda kapalı (Bot Ayarları\'ndan açabilirsin)' }

  const randy = await prisma.randy.findUnique({ where: { id: randyId } })
  if (!randy) return { success: false, error: 'Randy bulunamadı' }
  if (randy.status !== 'draft') return { success: false, error: 'Randy zaten başlatılmış' }

  const chatId = randy.targetGroupId
  if (!chatId) return { success: false, error: 'Randy için hedef grup belirlenmemiş' }

  const aciklamaBlok = randy.message && randy.message.trim() ? `${randy.message}\n\n` : ''
  let finalMessage = await renderTemplateByKey('randy_start', {
    aciklama_blok: aciklamaBlok,
    katilimciSayisi: 0,
    odul_blok: randy.prizePoints > 0 ? ` | 🎁 ${randy.prizePoints} puan` : '',
    kazananSayisi: randy.winnerCount,
  })

  const sartlar: string[] = []
  if (randy.requirementType === 'message_count' && randy.messageCountRequired) {
    const periodText: Record<string, string> = { daily: 'Günlük', weekly: 'Haftalık', monthly: 'Aylık', all_time: 'Toplam' }
    sartlar.push(`📝 ${periodText[randy.messageCountPeriod || 'daily'] || 'Günlük'} ${randy.messageCountRequired} mesaj`)
  }
  if (randy.requirementType === 'post_randy_messages' && randy.postRandyMessages) {
    sartlar.push(`📝 Randy sonrası ${randy.postRandyMessages} mesaj`)
  }
  if (sartlar.length > 0) {
    finalMessage += RANDY.SARTLAR_BOLUMU(sartlar)
  }

  const newEntities: any[] = []

  if (randy.requireChannelMembership && randy.membershipCheckChannelIds) {
    const channelIds = randy.membershipCheckChannelIds.split(',').map((id: string) => id.trim()).filter(Boolean)
    const channelInfos = await Promise.all(
      channelIds.map(async (id: string) => {
        const chatInfo = await getChatInfo(id)
        const channelName = chatInfo?.title || 'Kanal'
        const link = chatInfo?.username ? `https://t.me/${chatInfo.username}` : `https://t.me/c/${id.replace('-100', '')}`
        return { channelName, link }
      })
    )

    // Önce düz metin olarak ekliyoruz (HTML etiketi YOK - "entities" modunda
    // gönderiyoruz, HTML etiketleri yorumlanmıyor, olduğu gibi görünürdü).
    const channelLinesPlain = channelInfos.map((c: { channelName: string }) => `📢 ${c.channelName}`)
    const prefix = `\n\nKatılım Zorunlu Kanallar:\n`
    const sectionStart = finalMessage.length + prefix.length
    finalMessage += RANDY.ZORUNLU_KANALLAR(channelLinesPlain.join('\n'))

    // Her kanal adı için gerçek bir "text_link" entity oluşturuyoruz -
    // Telegram'ın kendi biçimlendirme sistemi, HTML etiketine gerek yok.
    let cursor = sectionStart
    for (let i = 0; i < channelInfos.length; i++) {
      const lineText = channelLinesPlain[i]
      const nameOffset = cursor + lineText.indexOf(channelInfos[i].channelName)
      newEntities.push({
        type: 'text_link',
        offset: nameOffset,
        length: channelInfos[i].channelName.length,
        url: channelInfos[i].link,
      })
      cursor += lineText.length + 1 // +1: aradaki '\n'
    }
  }

  const katilButonuMetni = await getTemplateContent('randy_katil_butonu')
  const keyboard = {
    inline_keyboard: [[{ text: katilButonuMetni, callback_data: `randy_join_${randy.id}` }]],
  }

  // Premium emoji / kalın-italik gibi biçimlendirmeyi koru: admin'in yazdığı
  // ham mesajın entities'i, artık şablon içine gömülü olduğu için offset
  // kaydırılarak uygulanıyor.
  let rawEntities: any[] | undefined
  try {
    rawEntities = randy.messageEntitiesJson ? JSON.parse(randy.messageEntitiesJson) : undefined
  } catch {
    rawEntities = undefined
  }
  const shiftedEntities = shiftEntitiesForEmbeddedText(finalMessage, randy.message, rawEntities)
  const allEntities = [...(shiftedEntities || []), ...newEntities]

  const message = await sendTelegramMessage(chatId, finalMessage, { keyboard, entities: allEntities.length > 0 ? allEntities : undefined })
  if (!message) return { success: false, error: 'Telegram mesajı gönderilemedi' }

  if (randy.pinMessage && message.message_id) {
    await pinChatMessage(chatId, message.message_id).catch(() => {})
  }

  const updated = await prisma.randy.update({
    where: { id: randyId },
    data: { status: 'active', messageId: message.message_id, startedAt: new Date() },
  })

  await invalidateRandyCache()

  // 🎲 Randy başladığında botu başlatmış üyelere özelden haber ver, mesajın
  // gerçek linkiyle birlikte - grubu takip etmiyorlarsa bile kaçırmasınlar.
  // ⚠️ await ediyoruz: serverless ortamda await edilmeyen arka plan işleri
  // güvenilir şekilde tamamlanmıyor (bkz. broadcast-service.ts'deki aynı
  // ders) - Randy mesajı zaten grupta yayında, bu sadece bildirimi ekliyor.
  try {
    await notifyUsersOfRandyStart(chatId, message.message_id)
  } catch (err) {
    console.error('❌ Randy DM bildirimi hatası:', err)
  }

  return { success: true, randy: updated }
}

/**
 * Randy başladığında botu başlatmış tüm üyelere özelden, gerçek Randy
 * mesajının linkiyle birlikte bir bildirim gönderir. Ayrı bir fonksiyon
 * olarak tutulup ÇAĞIRILDIĞI YERDE await ediliyor - serverless ortamda
 * await edilmeyen arka plan işleri güvenilir şekilde tamamlanmıyor (bkz.
 * broadcast-service.ts'deki aynı ders).
 */
async function notifyUsersOfRandyStart(chatId: string | number, messageId: number) {
  const chatInfo = await getChatInfo(String(chatId))
  const groupName = chatInfo?.title || 'Grup'
  const numericId = String(chatId).replace('-100', '')
  const messageLink = chatInfo?.username
    ? `https://t.me/${chatInfo.username}/${messageId}`
    : `https://t.me/c/${numericId}/${messageId}`

  const telegramUsers = await prisma.telegramGroupUser.findMany({
    where: { hadStart: true },
    select: { telegramId: true, linkedUser: { select: { isBanned: true } } },
  })
  const validUsers = telegramUsers.filter((u: { telegramId: string; linkedUser: { isBanned: boolean } | null }) => u.telegramId && !u.linkedUser?.isBanned)

  const notificationText = `🎲 <b>${groupName}</b> grubunda yeni bir Randy başladı!\n\n👉 <a href="${messageLink}">Katılmak için tıkla</a>`

  for (const user of validUsers) {
    try {
      await sendTelegramMessage(user.telegramId!, notificationText, { parseMode: 'HTML' })
    } catch {
      // Bota engellemiş/DM kapatmış kullanıcılar - sessizce geç
    }
    // Telegram hız limitini aşmamak için mesajlar arası kısa bekleme
    await new Promise((r) => setTimeout(r, 40))
  }
}

/**
 * Aktif bir Randy'yi sonlandırır, kazananları seçer ve puanları dağıtır.
 */
export async function endRandy(randyId: string) {
  const randy = await prisma.randy.findUnique({ where: { id: randyId }, include: { participants: true } })
  if (!randy) return { success: false, error: 'Randy bulunamadı' }
  if (randy.status !== 'active') return { success: false, error: 'Randy aktif değil' }

  const eligibleParticipants = randy.participants.filter(p => p.username || p.firstName)
  const shuffled = eligibleParticipants.sort(() => 0.5 - Math.random())
  const actualWinnerCount = Math.min(randy.winnerCount || 1, eligibleParticipants.length)
  const selectedWinners = shuffled.slice(0, actualWinnerCount)

  const winnersWithPoints = await Promise.all(
    selectedWinners.map(async (participant) => {
      const siteUser = await prisma.user.findUnique({ where: { telegramId: participant.telegramId } })
      let pointsAwarded = 0
      let hasLinkedUser = false
      let linkedUserId: string | null = null

      if (siteUser) {
        hasLinkedUser = true
        linkedUserId = siteUser.id
        if (randy.prizePoints > 0) {
          pointsAwarded = randy.prizePoints
          await prisma.user.update({ where: { id: linkedUserId }, data: { points: { increment: randy.prizePoints } } })
          await prisma.pointHistory.create({
            data: {
              userId: linkedUserId,
              amount: randy.prizePoints,
              type: 'randy_win',
              description: `Randy çekilişi kazandı: ${randy.title}`,
              relatedId: randy.id,
            },
          })
          await logActivity({
            userId: linkedUserId!,
            actionType: 'randy_win' as any,
            actionTitle: `${randy.title} çekilişini kazandı`,
            actionDescription: `+${randy.prizePoints} puan kazanıldı`,
            newValue: String(randy.prizePoints),
            relatedId: randy.id,
            relatedType: 'randy',
            metadata: { randyTitle: randy.title, pointsWon: randy.prizePoints },
          })
        }
      }
      return { participant, pointsAwarded, hasLinkedUser, linkedUserId }
    })
  )

  const winners = await Promise.all(
    winnersWithPoints.map(({ participant, pointsAwarded, hasLinkedUser, linkedUserId }) =>
      prisma.randyWinner.create({
        data: {
          randyId: randy.id,
          telegramId: participant.telegramId,
          username: participant.username,
          firstName: participant.firstName,
          lastName: participant.lastName,
          pointsAwarded,
          hasLinkedUser,
          linkedUserId,
        },
      })
    )
  )

  await prisma.randy.update({ where: { id: randyId }, data: { status: 'ended', endedAt: new Date() } })
  await invalidateRandyCache()

  const kazananListesi = winners.map((w, index) => ({
    sira: index + 1,
    isim: w.username ? `@${w.username}` : `${w.firstName}${w.lastName ? ` ${w.lastName}` : ''}`,
    puanEklendi: w.hasLinkedUser && w.pointsAwarded > 0,
    // ✅ FIX: Randy'nin puan ödülü yoksa (prizePoints=0), zaten kimseye puan
    // eklenmeyecek - bu durumda "üyelik yok" notu anlamsız ve kafa karıştırıcı,
    // sadece gerçek bir puan ödülü olup da alamayanlarda gösterilir.
    uyelikYok: randy.prizePoints > 0 && !w.hasLinkedUser,
  }))

  const kazananListesiMetni = kazananListesi
    .map((k) => {
      if (k.puanEklendi) return `${k.sira}. ${k.isim} (+${randy.prizePoints} puan)`
      if (k.uyelikYok) return `${k.sira}. ${k.isim} (üyelik yok)`
      return `${k.sira}. ${k.isim}`
    })
    .join('\n')

  const winnerMessage = await renderTemplateByKey('randy_kazanan', {
    baslik_blok: `Randy Sona Erdi!\n\n`,
    katilimciSayisi: eligibleParticipants.length,
    odul_blok: randy.prizePoints > 0 ? ` | 🎁 ${randy.prizePoints} puan` : '',
    kazananListesi: kazananListesiMetni,
  })

  // ✅ FIX: Artık eski Randy mesajı DÜZENLENMİYOR - siliniyor ve kazanan
  // duyurusu YENİ bir mesaj olarak gönderilip SABİTLENİYOR. Böylece grup
  // üyeleri bildirim alır (mesaj düzenlemesi bildirim göndermez ama yeni
  // mesaj gönderir) ve kazananlar öne çıkar.
  if (randy.targetGroupId && randy.messageId) {
    await deleteTelegramMessage(randy.targetGroupId, randy.messageId).catch(() => {})
    const sentMessage = await sendTelegramMessage(randy.targetGroupId, winnerMessage)
    if (sentMessage?.message_id) {
      await pinChatMessage(randy.targetGroupId, sentMessage.message_id).catch(() => {})
    }
  }

  // ✅ Kazananlara özelden bildirim. "Sadece Puan" Randy'lerde fiziksel/harici
  // bir ödül olmadığı için destek ekibiyle iletişime geçmesine gerek yok -
  // puan zaten otomatik eklendi (ya da site hesabı yoksa üye olması
  // gerekiyor). Normal Randy'lerde (fiziksel/harici ödül olabilir) eskisi
  // gibi destek ekibine yönlendiriliyor.
  await Promise.all(
    winners.map(async (w) => {
      try {
        let dmMessage: string
        let keyboard: any = undefined

        if (randy.pointsOnly) {
          if (w.hasLinkedUser && w.pointsAwarded > 0) {
            dmMessage = [
              `🎉 Tebrikler, Randy'yi kazandın!`,
              `🎁 Ödül: <b>${w.pointsAwarded} puan</b> hesabına eklendi.`,
            ].join('\n')
          } else {
            dmMessage = [
              `🎉 Tebrikler, Randy'yi kazandın!`,
              '',
              `Puanını alabilmek için önce web sitemize üye olman gerekiyor. Üye olduktan sonra puanın hesabına tanımlanır.`,
            ].join('\n')
            keyboard = {
              inline_keyboard: [[{ text: '🌐 Siteye Git', url: SiteConfig.appUrl }]],
            }
          }
        } else {
          dmMessage = [
            `🎉 Tebrikler, Randy'yi kazandın!`,
            w.pointsAwarded > 0 ? `🎁 Ödül: <b>${w.pointsAwarded} puan</b> hesabına eklendi.` : '',
            '',
            `Ödülünü almak/onaylatmak için @harleydestek ile iletişime geç.`,
          ].filter(Boolean).join('\n')
          keyboard = { inline_keyboard: [[{ text: '💬 @harleydestek', url: 'https://t.me/harleydestek' }]] }
        }

        await sendTelegramMessage(w.telegramId, dmMessage, { keyboard, parseMode: 'HTML' })
      } catch (err) {
        // Kullanıcı botu engellemiş olabilir, ya da geçersiz chat ID -
        // sessizce geçme, en azından logla ki teşhis edilebilsin.
        console.error(`❌ Randy kazanan DM gönderilemedi (telegramId: ${w.telegramId}):`, err)
      }
    })
  )

  return { success: true, winners }
}
