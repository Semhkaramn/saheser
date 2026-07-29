import { prisma } from '@/lib/prisma'
import { sendTelegramMessage, editTelegramMessage, answerCallbackQuery } from '../core'
import { isBotSystemEnabled } from '../bot-system-check'
import { renderTemplateByKey } from '@/lib/message-templates'

// randy-web'deki sponsor onay akışından uyarlandı.
// Kullanıcı sponsor bilgisini (kullanıcı adı/id/email) girince, sponsorun
// approvalGroupId'sine bir onay kartı gönderilir. Grup adminleri Onay/Red/
// Yatırım Sonrası/Hatalı butonlarından birine basar, bir Evet/Hayır teyidi
// ile onaylar. Karar sonrası kullanıcıya (Telegram bağlıysa) DM bildirimi
// gider.

export type EntryStatus = 'approved' | 'rejected' | 'post_deposit' | 'incorrect'

const STATUS_LABEL: Record<EntryStatus, string> = {
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
  post_deposit: 'Yatırım Sonrası',
  incorrect: 'Bilgi Hatalı',
}

const FIELD_TYPE_LABEL: Record<string, string> = { username: 'Kullanıcı Adı', id: 'Telegram ID', email: 'E-posta' }

function isValidStatus(s: string): s is EntryStatus {
  return ['approved', 'rejected', 'post_deposit', 'incorrect'].includes(s)
}

function summaryLines(identifier: string, sponsorName: string, fieldType: string, siteUsername: string) {
  const fieldLabel = FIELD_TYPE_LABEL[fieldType] || fieldType
  return [
    `🔗 <b>Yeni Referans Bildirimi</b>`,
    '',
    `Sponsor: <b>${sponsorName}</b>`,
    `Site üyesi: <b>${siteUsername}</b>`,
    `${fieldLabel}: <code>${identifier}</code>`,
  ].join('\n')
}

function buildPendingMessage(entryId: string, identifier: string, sponsorName: string, fieldType: string, siteUsername: string) {
  const fieldLabel = FIELD_TYPE_LABEL[fieldType] || fieldType
  return {
    text: [summaryLines(identifier, sponsorName, fieldType, siteUsername), '', 'Durumu seçin:'].join('\n'),
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Onay', callback_data: `sponsor_action:${entryId}:approved` },
          { text: '❌ Red', callback_data: `sponsor_action:${entryId}:rejected` },
        ],
        [{ text: '💰 Yatırım Sonrası', callback_data: `sponsor_action:${entryId}:post_deposit` }],
        [{ text: `❗ ${fieldLabel} Hatalı`, callback_data: `sponsor_action:${entryId}:incorrect` }],
      ],
    },
  }
}

function buildConfirmMessage(entryId: string, identifier: string, sponsorName: string, fieldType: string, siteUsername: string, status: EntryStatus) {
  return {
    text: [
      summaryLines(identifier, sponsorName, fieldType, siteUsername),
      '',
      `Seçilen durum: <b>${STATUS_LABEL[status]}</b>`,
      'Bu değişikliği onaylıyor musun?',
    ].join('\n'),
    reply_markup: {
      inline_keyboard: [[
        { text: '✅ Evet', callback_data: `sponsor_confirm:${entryId}:${status}:yes` },
        { text: '↩️ Hayır', callback_data: `sponsor_confirm:${entryId}:${status}:no` },
      ]],
    },
  }
}

function buildFinalMessage(identifier: string, sponsorName: string, fieldType: string, siteUsername: string, status: EntryStatus) {
  return {
    text: [summaryLines(identifier, sponsorName, fieldType, siteUsername), '', `Durum: <b>${STATUS_LABEL[status]}</b> ✔️`].join('\n'),
    reply_markup: { inline_keyboard: [] },
  }
}

const STATUS_TEMPLATE_KEY: Record<EntryStatus, string> = {
  approved: 'sponsor_onay_approved',
  rejected: 'sponsor_onay_rejected',
  post_deposit: 'sponsor_onay_post_deposit',
  incorrect: 'sponsor_onay_incorrect',
}

export async function buildUserNotifyText(sponsorName: string, status: EntryStatus): Promise<string> {
  return renderTemplateByKey(STATUS_TEMPLATE_KEY[status], { sponsorAdi: sponsorName })
}

/**
 * Yeni bir sponsor bilgisi kaydedildiğinde çağrılır. Sponsor'un approvalGroupId'si
 * varsa o gruba bir onay kartı gönderir ve mesaj bilgilerini kaydeder.
 */
export async function notifySponsorApprovalGroup(sponsorInfoId: string) {
  if (!(await isBotSystemEnabled('sponsor_approval'))) return

  const info = await prisma.userSponsorInfo.findUnique({
    where: { id: sponsorInfoId },
    include: { sponsor: true, user: { select: { siteUsername: true, telegramUsername: true } } },
  })
  if (!info || !info.sponsor.approvalGroupId) return

  const { text, reply_markup } = buildPendingMessage(
    info.id,
    info.identifier,
    info.sponsor.name,
    info.sponsor.identifierType,
    info.user.siteUsername || info.user.telegramUsername || 'Bilinmiyor'
  )

  const sent = await sendTelegramMessage(info.sponsor.approvalGroupId, text, { keyboard: reply_markup })
  if (sent?.message_id) {
    await prisma.userSponsorInfo.update({
      where: { id: sponsorInfoId },
      data: { telegramChatId: info.sponsor.approvalGroupId, telegramMessageId: String(sent.message_id) },
    })
  }
}

export async function handleSponsorAction(query: any): Promise<boolean> {
  const [, entryId, statusRaw] = String(query.data).split(':')
  if (!isValidStatus(statusRaw)) return false

  const chatId = query.message?.chat?.id
  const info = await prisma.userSponsorInfo.findUnique({
    where: { id: entryId },
    include: { sponsor: true, user: { select: { siteUsername: true, telegramUsername: true } } },
  })
  if (!info) return true

  const { text, reply_markup } = buildConfirmMessage(
    info.id,
    info.identifier,
    info.sponsor.name,
    info.sponsor.identifierType,
    info.user.siteUsername || info.user.telegramUsername || 'Bilinmiyor',
    statusRaw
  )
  await editTelegramMessage(chatId, query.message.message_id, text, reply_markup)
  return true
}

export async function handleSponsorConfirm(query: any): Promise<boolean> {
  const [, entryId, statusRaw, decision] = String(query.data).split(':')
  if (!isValidStatus(statusRaw)) return false

  const chatId = query.message?.chat?.id
  const info = await prisma.userSponsorInfo.findUnique({
    where: { id: entryId },
    include: { sponsor: true, user: { select: { id: true, siteUsername: true, telegramUsername: true, telegramId: true } } },
  })
  if (!info) return true

  if (decision === 'no') {
    const { text, reply_markup } = buildPendingMessage(
      info.id, info.identifier, info.sponsor.name, info.sponsor.identifierType,
      info.user.siteUsername || info.user.telegramUsername || 'Bilinmiyor'
    )
    await editTelegramMessage(chatId, query.message.message_id, text, reply_markup)
    await answerCallbackQuery(query.id, '↩️ İptal edildi, ilk seçime dönüldü.', false)
    return false
  }

  await prisma.userSponsorInfo.update({
    where: { id: entryId },
    data: { status: statusRaw, decidedByTelegramId: String(query.from.id), decidedAt: new Date() },
  })

  const { text, reply_markup } = buildFinalMessage(
    info.identifier, info.sponsor.name, info.sponsor.identifierType,
    info.user.siteUsername || info.user.telegramUsername || 'Bilinmiyor', statusRaw
  )
  await editTelegramMessage(chatId, query.message.message_id, text, reply_markup)

  if (info.user.telegramId) {
    await sendTelegramMessage(info.user.telegramId, await buildUserNotifyText(info.sponsor.name, statusRaw)).catch(() => {})
  }

  return true
}
