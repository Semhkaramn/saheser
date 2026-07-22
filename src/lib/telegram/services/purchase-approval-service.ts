import { prisma } from '@/lib/prisma'
import { sendTelegramMessage, editTelegramMessage, answerCallbackQuery } from '../core'
import { isBotSystemEnabled } from '../bot-system-check'
import { notifyOrderStatusChange } from '@/lib/notifications'

// randy-web'deki purchase onay akışından uyarlandı. Bir sipariş oluşunca,
// ürün bir sponsora bağlıysa sponsorun approvalGroupId'sine, değilse genel
// PURCHASE_APPROVAL_GROUP_ID env değişkenine bir onay kartı gönderilir.

type Decision = 'approved' | 'rejected'

function summaryLines(itemName: string, price: number, siteUsername: string, sponsorInfo: string | null, walletAddress: string | null, isSponsorGroup: boolean) {
  const lines = [
    `🛒 <b>Yeni Sipariş</b>`,
    '',
    `Ürün: <b>${itemName}</b>`,
    `Üye: <b>${siteUsername}</b>`,
  ]
  // Sponsora özel onay grubunda puan yerine sponsor bilgisi öne çıkıyor -
  // orada admin puanla değil, kullanıcının o sponsordaki referans/kullanıcı
  // bilgisini doğrulamakla ilgileniyor. Genel onay kuyruğunda (site geneli)
  // puan bilgisi hâlâ gösteriliyor.
  if (isSponsorGroup && sponsorInfo) {
    lines.push(`Sponsor Bilgisi: <code>${sponsorInfo}</code>`)
  } else {
    lines.push(`Puan: <b>${price}</b>`)
    if (sponsorInfo) lines.push(`Sponsor Bilgisi: <code>${sponsorInfo}</code>`)
  }
  if (walletAddress) lines.push(`Cüzdan: <code>${walletAddress}</code>`)
  return lines.join('\n')
}

function buildPendingMessage(purchaseId: string, itemName: string, price: number, siteUsername: string, sponsorInfo: string | null, walletAddress: string | null, isSponsorGroup: boolean) {
  return {
    text: [summaryLines(itemName, price, siteUsername, sponsorInfo, walletAddress, isSponsorGroup), '', 'Durumu seçin:'].join('\n'),
    reply_markup: {
      inline_keyboard: [[
        { text: '✅ Onayla (Teslim Edildi)', callback_data: `purchase_action:${purchaseId}:approved` },
        { text: '❌ Reddet (Puan İade)', callback_data: `purchase_action:${purchaseId}:rejected` },
      ]],
    },
  }
}

function buildConfirmMessage(purchaseId: string, itemName: string, price: number, siteUsername: string, sponsorInfo: string | null, walletAddress: string | null, decision: Decision, isSponsorGroup: boolean) {
  const label = decision === 'approved' ? 'Onayla (Teslim Edildi)' : 'Reddet (Puan İade)'
  return {
    text: [
      summaryLines(itemName, price, siteUsername, sponsorInfo, walletAddress, isSponsorGroup),
      '',
      `Seçilen işlem: <b>${label}</b>`,
      'Emin misin?',
    ].join('\n'),
    reply_markup: {
      inline_keyboard: [[
        { text: '✅ Evet', callback_data: `purchase_confirm:${purchaseId}:${decision}:yes` },
        { text: '↩️ Hayır', callback_data: `purchase_confirm:${purchaseId}:${decision}:no` },
      ]],
    },
  }
}

function buildFinalMessage(itemName: string, price: number, siteUsername: string, sponsorInfo: string | null, walletAddress: string | null, decision: Decision, isSponsorGroup: boolean) {
  const label = decision === 'approved' ? 'Onaylandı ✅' : 'Reddedildi ❌ (puan iade edildi)'
  return {
    text: [summaryLines(itemName, price, siteUsername, sponsorInfo, walletAddress, isSponsorGroup), '', `Durum: <b>${label}</b>`].join('\n'),
    reply_markup: { inline_keyboard: [] },
  }
}

/**
 * Yeni bir sipariş oluştuğunda çağrılır; uygun Telegram grubuna onay kartı yollar.
 */
export async function notifyPurchaseApprovalGroup(purchaseId: string) {
  if (!(await isBotSystemEnabled('purchase_approval'))) return

  const purchase = await prisma.userPurchase.findUnique({
    where: { id: purchaseId },
    include: { item: { include: { sponsor: true } }, user: { select: { siteUsername: true, telegramUsername: true } } },
  })
  if (!purchase) return

  const isSponsorGroup = !!purchase.item.sponsor?.approvalGroupId
  const groupId = purchase.item.sponsor?.approvalGroupId || process.env.PURCHASE_APPROVAL_GROUP_ID
  if (!groupId) return

  const { text, reply_markup } = buildPendingMessage(
    purchase.id,
    purchase.item.name,
    purchase.pointsSpent,
    purchase.user.siteUsername || purchase.user.telegramUsername || 'Bilinmiyor',
    purchase.sponsorInfo,
    purchase.walletAddress,
    isSponsorGroup
  )

  const sent = await sendTelegramMessage(groupId, text, { keyboard: reply_markup })
  if (sent?.message_id) {
    await prisma.userPurchase.update({
      where: { id: purchaseId },
      data: { telegramChatId: groupId, telegramMessageId: String(sent.message_id) },
    })
  }
}

export async function handlePurchaseAction(query: any): Promise<boolean> {
  const [, purchaseId, decisionRaw] = String(query.data).split(':')
  if (decisionRaw !== 'approved' && decisionRaw !== 'rejected') return false

  // ✅ Bu buton zaten sadece özel "satın alma onay grubu"nda görünüyor - o
  // gruba eklenen HERKES onay/red verebilsin diye Telegram admin kontrolü
  // kaldırıldı (grup zaten sadece bu iş için kullanılan, güvenilir bir grup).
  const chatId = query.message?.chat?.id
  const purchase = await prisma.userPurchase.findUnique({
    where: { id: purchaseId },
    include: { item: { include: { sponsor: true } }, user: { select: { siteUsername: true, telegramUsername: true } } },
  })
  if (!purchase) return true

  const { text, reply_markup } = buildConfirmMessage(
    purchase.id, purchase.item.name, purchase.pointsSpent,
    purchase.user.siteUsername || purchase.user.telegramUsername || 'Bilinmiyor',
    purchase.sponsorInfo, purchase.walletAddress, decisionRaw, !!purchase.item.sponsor?.approvalGroupId
  )
  await editTelegramMessage(chatId, query.message.message_id, text, reply_markup)
  return true
}

export async function handlePurchaseConfirm(query: any): Promise<boolean> {
  const [, purchaseId, decisionRaw, answer] = String(query.data).split(':')
  if (decisionRaw !== 'approved' && decisionRaw !== 'rejected') return false

  const chatId = query.message?.chat?.id
  const purchase = await prisma.userPurchase.findUnique({
    where: { id: purchaseId },
    include: { item: { include: { sponsor: true } }, user: { select: { id: true, siteUsername: true, telegramUsername: true, telegramId: true } } },
  })
  if (!purchase) return true

  if (answer === 'no') {
    const { text, reply_markup } = buildPendingMessage(
      purchase.id, purchase.item.name, purchase.pointsSpent,
      purchase.user.siteUsername || purchase.user.telegramUsername || 'Bilinmiyor',
      purchase.sponsorInfo, purchase.walletAddress, !!purchase.item.sponsor?.approvalGroupId
    )
    await editTelegramMessage(chatId, query.message.message_id, text, reply_markup)
    await answerCallbackQuery(query.id, '↩️ İptal edildi, ilk seçime dönüldü.', false)
    return false
  }

  if (purchase.status === 'completed' || purchase.status === 'cancelled') {
    // Zaten karar verilmiş, tekrar işlem yapma (puan iadesi çift olmasın)
    return true
  }

  await prisma.$transaction(async (tx) => {
    await tx.userPurchase.update({
      where: { id: purchaseId },
      data: {
        status: decisionRaw === 'approved' ? 'completed' : 'cancelled',
        processedAt: new Date(),
        decidedByTelegramId: String(query.from.id),
      },
    })

    if (decisionRaw === 'rejected') {
      await tx.user.update({ where: { id: purchase.user.id }, data: { points: { increment: purchase.pointsSpent } } })
      await tx.pointHistory.create({
        data: {
          userId: purchase.user.id,
          amount: purchase.pointsSpent,
          type: 'purchase_refund',
          description: `${purchase.item.name} siparişi reddedildi, puan iade edildi`,
          relatedId: purchase.id,
        },
      })
    }
  })

  const { text, reply_markup } = buildFinalMessage(
    purchase.item.name, purchase.pointsSpent,
    purchase.user.siteUsername || purchase.user.telegramUsername || 'Bilinmiyor',
    purchase.sponsorInfo, purchase.walletAddress, decisionRaw, !!purchase.item.sponsor?.approvalGroupId
  )
  await editTelegramMessage(chatId, query.message.message_id, text, reply_markup)

  // Kullanıcıya DM bildirimi - web admin panelinden onaylanan siparişlerle
  // aynı davranış (notify_order_approved ayarına saygı gösterir)
  if (purchase.user.telegramId) {
    notifyOrderStatusChange(purchase.user.id, purchase.user.telegramId, {
      itemName: purchase.item.name,
      pointsSpent: purchase.pointsSpent,
      status: decisionRaw === 'approved' ? 'completed' : 'cancelled',
    }).catch((err) => console.error('Purchase DM notification error:', err))
  }

  return true
}
