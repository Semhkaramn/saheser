import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkTelegramAdmin, sendTelegramMessage, editTelegramMessage, answerCallbackQuery, pinChatMessage, deleteTelegramMessage } from '../core'
import { startRandy, endRandy } from '../services/randy-bot-service'
import { sendBroadcastToAllUsers } from '../services/broadcast-service'
import { runTagging, stopTaggingRun, getTaggingRunStatus } from '../services/tagging-service'
import { isCrossBanEnabled, setCrossBanEnabled } from '../services/cross-ban-service'
import { createClassicGiveaway, endClassicGiveaway, cancelClassicGiveaway, getActiveClassicGiveaway, getClassicGiveawayStatus } from '../services/classic-giveaway-service'
import { getGptSettings, setGptSettings } from '../services/gpt-service'
import { getActivityContestSettings, startActivityContest, stopActivityContestAndAnnounce, getActivityRewards, setActivityReward } from '../services/activity-rewards-service'
import { getWeeklyRewardSettings, setWeeklyRewardSettings, getWeeklyRewards, setWeeklyReward } from '../services/weekly-rewards-service'
import { listCrossBanChannels, addCrossBanChannel } from '../services/cross-ban-service'
import {
  getRandyGroupDefaults,
  setRandyGroupDefaults,
  listRandyGroupDefaultChannels,
  addRandyGroupDefaultChannel,
  removeRandyGroupDefaultChannel,
} from '../services/randy-quick-draft-service'

// ─── DM menü mesajları ──────────────────────────────────────────────────────

function buildGroupListMessage(groups: { groupId: string; title: string | null; chatType?: string }[]) {
  const rows = groups.map((g) => [{
    text: `${g.chatType === 'channel' ? '📢' : '👥'} ${g.title || g.groupId}`,
    callback_data: `admgrp:${g.groupId}`,
  }])
  rows.push([{ text: '📢 Tüm Kullanıcılara Mesaj Gönder', callback_data: 'admbroadcast:all' }])

  return {
    text: groups.length === 0
      ? '👋 Merhaba! Şu an yönetici olduğun, botun tanıdığı bir grup/kanal görünmüyor. Botu bir gruba/kanala admin olarak ekleyip tekrar dene.'
      : '👋 Merhaba! Hangi grup veya kanal için ayar yapmak istersin, ya da tüm kullanıcılara mesaj gönder:',
    reply_markup: { inline_keyboard: rows },
  }
}

async function buildGroupMenuMessage(group: { groupId: string; title: string | null; chatType?: string }) {
  const isChannel = group.chatType === 'channel'
  const crossBanOn = await isCrossBanEnabled(group.groupId)
  const gptSettings = await getGptSettings(group.groupId)
  const gptOn = gptSettings?.enabled ?? false
  const contest = await getActivityContestSettings(group.groupId)
  const contestRunning = contest?.isRunning ?? false
  const weeklySettings = await getWeeklyRewardSettings(group.groupId)
  const weeklyOn = weeklySettings?.enabled ?? false
  const activeGiveaway = isChannel ? null : await getActiveClassicGiveaway(group.groupId)

  const rows: { text: string; callback_data: string }[][] = []

  if (isChannel) {
    // Kanallarda üye mesajı takibi olmadığı için mesaj-bazlı özellikler
    // (broadcast, etiketleme, aktiflik yarışması, haftalık ödül, klasik
    // çekiliş, GPT sohbet) anlamsız - randy-web'de de kanal menüsü sadece
    // Randy + Çapraz Ban içerir.
    rows.push([{ text: '🎲 Randy Ayarları', callback_data: `admrandycfg:${group.groupId}` }])
    rows.push([{ text: '🎲 Randy Başlat (bu kanalda)', callback_data: `admrandy_new:${group.groupId}` }])
    rows.push([{ text: `🚫 Çapraz Ban: ${crossBanOn ? 'Açık ✅' : 'Kapalı ❌'}`, callback_data: `admcrossban:${group.groupId}` }])
  } else {
    rows.push([{ text: '📢 Üyelere Mesaj Gönder', callback_data: `admbroadcast:${group.groupId}` }])
    rows.push([{ text: '🎲 Randy Ayarları', callback_data: `admrandycfg:${group.groupId}` }])
    rows.push([{
      text: activeGiveaway ? '📊 Klasik Çekiliş: Devam Ediyor (Durum)' : '🎁 Klasik Çekiliş Başlat',
      callback_data: `admgiveaway_new:${group.groupId}`,
    }])
    rows.push([{ text: '🏷️ Üyeleri Etiketle', callback_data: `admtag_new:${group.groupId}` }])
    rows.push([{ text: '🚫 Etiketleme Hariç Listesi', callback_data: `admtagexcl:${group.groupId}` }])
    rows.push([{ text: contestRunning ? '📈 Aktiflik Yarışması: Devam Ediyor' : '📈 Aktiflik Yarışması', callback_data: `admactivitymenu:${group.groupId}` }])
    rows.push([{ text: `🏆 Haftalık Ödüller: ${weeklyOn ? 'Açık ✅' : 'Kapalı ❌'}`, callback_data: `admweeklymenu:${group.groupId}` }])
    rows.push([{ text: `🤖 GPT Sohbet: ${gptOn ? `Açık ✅ (“${gptSettings?.triggerWord || 'harley'}”)` : 'Kapalı ❌'}`, callback_data: `admgptmenu:${group.groupId}` }])
    rows.push([{ text: `🚫 Çapraz Ban: ${crossBanOn ? 'Açık ✅' : 'Kapalı ❌'}`, callback_data: `admcrossban:${group.groupId}` }])
  }
  rows.push([{ text: '⬅️ Gruplara Dön', callback_data: 'admgroups' }])

  return {
    text: `⚙️ <b>${group.title || group.groupId}</b>${isChannel ? ' (kanal)' : ''}\n\nNe yapmak istersin?`,
    reply_markup: { inline_keyboard: rows },
  }
}

// Metin/sayı bekleyen her ekranın altına eklenen "❌ İptal" butonu - artık
// /iptal YAZMAYA gerek yok, tamamen buton tabanlı. groupId 'all' ise
// (toplu mesaj hedefi "herkes" seçildiyse) grup listesine, değilse o grubun
// menüsüne döner.
function cancelKeyboard(groupId: string | null) {
  return { inline_keyboard: [[{ text: '❌ İptal', callback_data: `admcancel:${groupId ?? 'all'}` }]] }
}

const REQUIREMENT_LABEL_TR: Record<string, string> = {
  none: 'Şartsız',
  daily: 'Günlük mesaj',
  weekly: 'Haftalık mesaj',
  monthly: 'Aylık mesaj',
  all_time: 'Toplam mesaj',
  post_randy: 'Randy sonrası mesaj',
}

// GPT sohbet alt menüsü - eskiden sadece açık/kapalı butonuydu, tetikleyici
// kelimeyi (örn. "harley") hiçbir yerden değiştiremiyordun. Artık burada.
async function buildGptMenuMessage(group: { groupId: string; title: string | null }) {
  const settings = await getGptSettings(group.groupId)
  const enabled = settings?.enabled ?? false
  const triggerWord = settings?.triggerWord || 'harley'

  return {
    text: [
      `🤖 <b>GPT Sohbet — ${group.title || group.groupId}</b>`,
      '',
      `Durum: <b>${enabled ? 'Açık ✅' : 'Kapalı ❌'}</b>`,
      `Tetikleyici kelime: <b>"${triggerWord}"</b>`,
      '',
      `Mesajda "${triggerWord}" kelimesi geçince bot gruba bir cevap yazar.`,
    ].join('\n'),
    reply_markup: {
      inline_keyboard: [
        [{ text: enabled ? '❌ Kapat' : '✅ Aç', callback_data: `admgpt:${group.groupId}` }],
        [{ text: '✍️ Tetikleyici Kelimeyi Değiştir', callback_data: `admgptword:${group.groupId}` }],
        [{ text: '⬅️ Geri', callback_data: `admgrp:${group.groupId}` }],
      ],
    },
  }
}

// Aktiflik Yarışması alt menüsü - eskiden tek bir "Başlat/Bitir" butonuydu,
// 1./2./3. sıraya ne verileceğini ayarlayacak yer yoktu (setActivityReward
// arka planda vardı ama hiçbir buton çağırmıyordu).
async function buildActivityMenuMessage(group: { groupId: string; title: string | null }) {
  const contest = await getActivityContestSettings(group.groupId)
  const running = contest?.isRunning ?? false
  const rewards = await getActivityRewards(group.groupId)
  const rewardMap = new Map(rewards.map((r: { rank: number; rewardText: string }) => [r.rank, r.rewardText]))

  const medalFor = (rank: number) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`)
  const rewardRows = [1, 2, 3].map((rank) => {
    const current = rewardMap.get(rank)
    return [{
      text: `${medalFor(rank)} ${rank}. Sıra: ${current || 'ayarlanmadı'}`,
      callback_data: `admactivityreward:${group.groupId}:${rank}`,
    }]
  })

  return {
    text: [
      `📈 <b>Aktiflik Yarışması — ${group.title || group.groupId}</b>`,
      '',
      `Durum: <b>${running ? 'Devam ediyor ✅' : 'Kapalı'}</b>`,
      '',
      running
        ? 'Yarışma sürüyor - mesaj sayımı yapılıyor. Bitirince sonuçlar ve ödüller otomatik duyurulur.'
        : 'Başlatınca en aktif üyeleri saymaya başlar. Ödülleri önceden ayarlaman önerilir.',
    ].join('\n'),
    reply_markup: {
      inline_keyboard: [
        [{ text: running ? '⏹️ Yarışmayı Bitir ve Duyur' : '▶️ Yarışmayı Başlat', callback_data: `admactivity:${group.groupId}` }],
        ...rewardRows,
        [{ text: '⬅️ Geri', callback_data: `admgrp:${group.groupId}` }],
      ],
    },
  }
}

// Haftalık Ödüller alt menüsü - eskiden sadece açık/kapalı butonuydu.
// 1./2./3. sıraya ne verileceğini (ödül metni) ayarlayacak HİÇBİR yer yoktu -
// duyuru metninde ödül kısmı hep boş kalıyordu. Artık buradan ayarlanabiliyor.
async function buildWeeklyMenuMessage(group: { groupId: string; title: string | null }) {
  const settings = await getWeeklyRewardSettings(group.groupId)
  const enabled = settings?.enabled ?? false
  const topCount = settings?.topCount ?? 3
  const autoPin = settings?.autoPin ?? false
  const rewards = await getWeeklyRewards(group.groupId)
  const rewardMap = new Map(rewards.map((r: { rank: number; rewardText: string }) => [r.rank, r.rewardText]))

  const medalFor = (rank: number) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`)
  const rewardRows = Array.from({ length: Math.min(topCount, 5) }, (_, i) => {
    const rank = i + 1
    const current = rewardMap.get(rank)
    return [{
      text: `${medalFor(rank)} ${rank}. Sıra: ${current || 'ayarlanmadı'}`,
      callback_data: `admweeklyreward:${group.groupId}:${rank}`,
    }]
  })

  return {
    text: [
      `🏆 <b>Haftalık Ödüller — ${group.title || group.groupId}</b>`,
      '',
      `Durum: <b>${enabled ? 'Açık ✅' : 'Kapalı ❌'}</b>`,
      `Kaç kişiye ödül: <b>${topCount}</b>`,
      `Otomatik sabitle: <b>${autoPin ? 'Evet' : 'Hayır'}</b>`,
      '',
      'Her Pazar 20:00\'de o hafta en aktif üyeler ve aşağıda ayarladığın ödüller otomatik duyurulur.',
    ].join('\n'),
    reply_markup: {
      inline_keyboard: [
        [{ text: enabled ? '❌ Kapat' : '✅ Aç', callback_data: `admweekly:${group.groupId}` }],
        ...rewardRows,
        [{ text: '🔢 Kaç Kişiye Ödül Verilecek', callback_data: `admweeklytop:${group.groupId}` }],
        [{ text: autoPin ? '📌 Otomatik Sabitleme: Kapat' : '📌 Otomatik Sabitleme: Aç', callback_data: `admweeklypin:${group.groupId}` }],
        [{ text: '⬅️ Geri', callback_data: `admgrp:${group.groupId}` }],
      ],
    },
  }
}

// Randy grup varsayılanları ekranı - tamamen buton tabanlı (randy-web mantığı).
// Burada ayarlanan her şey, grupta "/randy" yazınca otomatik kullanılır -
// admin her Randy'de yeniden girmez.
async function buildRandyConfigMessage(group: { groupId: string; title: string | null; chatType?: string }) {
  const isChannel = group.chatType === 'channel'
  const defaults = await getRandyGroupDefaults(group.groupId)
  const channels = await listRandyGroupDefaultChannels(group.groupId)
  const req = defaults?.requirementType ?? 'none'
  const reqCount = defaults?.requiredMessageCount
  const points = defaults?.pointsReward
  const winnerCount = defaults?.winnerCount
  const websiteRequired = defaults?.requireWebsiteMembership ?? false

  const reqSummary = isChannel ? 'Şartsız' : `${REQUIREMENT_LABEL_TR[req] ?? req}${reqCount ? ` ${reqCount}` : ''}`

  return {
    text: [
      `🎲 <b>Randy Ayarları — ${group.title || group.groupId}</b>`,
      '',
      `Duyuru mesajı: <b>${defaults?.message ? '✅ ayarlandı' : '❌ ayarlanmadı'}</b>`,
      defaults?.message ? `<i>"${defaults.message.slice(0, 80)}${defaults.message.length > 80 ? '...' : ''}"</i>` : '',
      `Şart: <b>${reqSummary}</b>`,
      `Kanal şartı: <b>${channels.length > 0 ? `${channels.length} kanal` : 'yok'}</b>`,
      `Website zorunluluğu: <b>${websiteRequired ? 'Açık' : 'Kapalı'}</b>`,
      `Varsayılan kazanan sayısı: <b>${winnerCount ?? 'ayarlanmadı'}</b>`,
      `Puan ödülü: <b>${points ? `${points} puan` : 'kapalı'}</b>`,
      '',
      isChannel
        ? '"Randy Başlat" ile hemen başlat.'
        : 'Grupta "/randy" ile anında başlat, "/number 5" ile kazanan sayısını değiştir.',
    ].filter(Boolean).join('\n'),
    reply_markup: {
      inline_keyboard: [
        [{ text: '✍️ Randy Mesajını Ayarla', callback_data: `randymsg:${group.groupId}` }],
        [{ text: `📋 Mesaj Şartı (${reqSummary})`, callback_data: `randyreqmenu:${group.groupId}` }],
        [{ text: `📢 Kanal Şartı (${channels.length})`, callback_data: `randywc:${group.groupId}` }],
        [{ text: `${websiteRequired ? '☑️' : '⬜'} Website Zorunluluğu`, callback_data: `randywebreq:${group.groupId}` }],
        [{ text: '🔢 Kazanan Sayısını Ayarla', callback_data: `randywinner:${group.groupId}` }],
        [{ text: `💰 Puan Ödülü (${points ? `${points} puan` : 'kapalı'})`, callback_data: `randyptsmenu:${group.groupId}` }],
        [{ text: '⬅️ Geri', callback_data: `admgrp:${group.groupId}` }],
      ],
    },
  }
}

// Mesaj şartı alt menüsü - hangi periyotta kaç mesaj gerektiğini buradan
// seçiliyor. "Randy Sonrası" eskiden bu menüde YOKTU ama arka planda
// desteklendiği (randy-web'den miras) için bazı gruplarda aktifti - admin bu
// yüzden ekranda ham "post_randy" yazısı görüyor ama değiştirecek buton
// bulamıyordu. Artık burada.
async function buildRandyReqMenuMessage(group: { groupId: string; title: string | null; chatType?: string }) {
  const isChannel = group.chatType === 'channel'
  const defaults = await getRandyGroupDefaults(group.groupId)
  const req = defaults?.requirementType ?? 'none'
  const reqCount = defaults?.requiredMessageCount

  const rows = isChannel
    ? [[{ text: '✅ Şartsız (kanalda mesaj şartı olmaz)', callback_data: `randyreq:${group.groupId}:none` }]]
    : [
        [{ text: req === 'none' ? '✅ Şartsız' : 'Şartsız', callback_data: `randyreq:${group.groupId}:none` }],
        [
          { text: req === 'daily' ? '✅ Günlük' : 'Günlük', callback_data: `randyreq:${group.groupId}:daily` },
          { text: req === 'weekly' ? '✅ Haftalık' : 'Haftalık', callback_data: `randyreq:${group.groupId}:weekly` },
          { text: req === 'monthly' ? '✅ Aylık' : 'Aylık', callback_data: `randyreq:${group.groupId}:monthly` },
        ],
        [{ text: req === 'post_randy' ? '✅ Randy Sonrası' : '🔁 Randy Sonrası', callback_data: `randyreq:${group.groupId}:post_randy` }],
      ]

  return {
    text: [
      `📋 <b>Mesaj Şartı — ${group.title || group.groupId}</b>`,
      '',
      `Şu an: <b>${isChannel ? 'Şartsız' : `${REQUIREMENT_LABEL_TR[req] ?? req}${reqCount ? ` (${reqCount})` : ''}`}</b>`,
      '',
      'Katılım için kullanıcının o periyotta belirli sayıda mesaj atmış olması şartını buradan seçebilirsin.',
      '"Randy Sonrası" seçilirse, kullanıcının Randy BAŞLADIKTAN SONRA o kadar mesaj atmış olması gerekir (katılımdan önceki mesajlar sayılmaz).',
    ].join('\n'),
    reply_markup: {
      inline_keyboard: [
        ...rows,
        [{ text: '⬅️ Geri', callback_data: `admrandycfg:${group.groupId}` }],
      ],
    },
  }
}

// Puan ödülü alt menüsü - eskiden "Puan Ekle"/"Puanı Kaldır" ana menüde iki
// ayrı buton olarak duruyordu, şu an kaç puan olduğunu görmüyordun. Artık
// tek bir buton açıyor, güncel değeri gösteren kendi ekranı var.
async function buildRandyPointsMenuMessage(group: { groupId: string; title: string | null }) {
  const defaults = await getRandyGroupDefaults(group.groupId)
  const points = defaults?.pointsReward
  const pointsOnly = defaults?.pointsOnly ?? false

  return {
    text: [
      `💰 <b>Puan Ödülü — ${group.title || group.groupId}</b>`,
      '',
      `Şu an: <b>${points ? `${points} puan` : 'kapalı'}</b>`,
      `Sadece puan: <b>${pointsOnly ? 'Açık' : 'Kapalı'}</b>`,
      '',
      'Randy kazananlarına (site hesabı bağlıysa) otomatik eklenecek puan miktarı. "Puanı Kaldır" ödülü tamamen kapatır.',
      '',
      '"Sadece Puan" açıksa: bu Randy\'de fiziksel/harici bir ödül YOK demektir - kazanan mesajı "destekle iletişime geç" demez, sadece puanın eklendiğini söyler (site hesabı yoksa üye olmaya yönlendirir).',
    ].join('\n'),
    reply_markup: {
      inline_keyboard: [
        [{ text: '➕ Puan Ekle / Değiştir', callback_data: `randypts_add:${group.groupId}` }],
        [{ text: '🗑️ Puanı Kaldır (Kapat)', callback_data: `randypts_clear:${group.groupId}` }],
        [{ text: `${pointsOnly ? '☑️' : '⬜'} Sadece Puan (fiziksel ödül yok)`, callback_data: `randyptsonly:${group.groupId}` }],
        [{ text: '⬅️ Geri', callback_data: `admrandycfg:${group.groupId}` }],
      ],
    },
  }
}

// Kanal şartı alt menüsü - bilinen tüm kanallar tikli (☑️/⬜) liste olarak
// gösterilir, tıklayınca açılıp kapanır.
async function buildRandyChannelListMessage(group: { groupId: string; title: string | null }) {
  const required = await listRandyGroupDefaultChannels(group.groupId)
  const requiredIds = new Set(required.map((c) => c.channelId))
  const known = await listCrossBanChannels()

  const checkboxRows = known.map((c) => {
    const checked = requiredIds.has(c.channelId)
    const label = c.title || (c.username ? `@${c.username}` : c.channelId)
    return [{ text: `${checked ? '☑️' : '⬜'} ${label}`, callback_data: `rdefwctoggle:${group.groupId}:${c.channelId}` }]
  })

  return {
    text: [
      `📢 <b>Kanal Şartı — ${group.title || group.groupId}</b>`,
      '',
      known.length === 0
        ? 'Henüz kayıtlı kanal yok — aşağıdan yeni kanal ekleyebilirsin.'
        : 'Katılmak için tikli kanallara üye olmak gerekir. Tıklayarak açıp kapatabilirsin:',
    ].join('\n'),
    reply_markup: {
      inline_keyboard: [
        ...checkboxRows,
        [{ text: '➕ Yeni Kanal Ekle (listede yoksa)', callback_data: `rdefwcadd:${group.groupId}` }],
        [{ text: '⬅️ Geri', callback_data: `admrandycfg:${group.groupId}` }],
      ],
    },
  }
}

// ─── Komut girişi: /panel ───────────────────────────────────────────────────


export async function getAdminGroupsForTelegramId(telegramId: string) {
  const groups = await prisma.telegramGroup.findMany({ where: { isActive: true }, orderBy: { title: 'asc' } })

  // Sponsor onay kartlarının gönderildiği gruplar (tek amaçlı - topluluk
  // yönetimi için değil) bot menüsünde de görünmemeli, web admin panelinde
  // olduğu gibi.
  const sponsorApprovalGroups = await prisma.sponsor.findMany({
    where: { approvalGroupId: { not: null } },
    select: { approvalGroupId: true },
  })
  const sponsorGroupIds = new Set(sponsorApprovalGroups.map((s: { approvalGroupId: string | null }) => s.approvalGroupId))
  const visibleGroups = groups.filter((g: { groupId: string }) => !sponsorGroupIds.has(g.groupId))

  const adminGroups: typeof groups = []
  for (const g of visibleGroups) {
    const isAdmin = await checkTelegramAdmin(Number(g.groupId), Number(telegramId))
    if (isAdmin) adminGroups.push(g)
  }
  return adminGroups
}

export async function handleAdminPanelCommand(message: any) {
  const telegramId = String(message.from.id)
  const chatId = message.chat.id

  const adminGroups = await getAdminGroupsForTelegramId(telegramId)

  await prisma.botAdminSession.upsert({
    where: { telegramId },
    update: { groupId: null, mode: null, draftTitle: null, draftMessage: null },
    create: { telegramId },
  })

  const { text, reply_markup } = buildGroupListMessage(adminGroups)
  await sendTelegramMessage(chatId, text, { keyboard: reply_markup })
  return NextResponse.json({ ok: true })
}

// ─── Callback yönlendirme ───────────────────────────────────────────────────

export async function handleAdminPanelCallback(query: any): Promise<boolean> {
  const data: string = query.data
  const telegramId = String(query.from.id)
  const chatId = query.message.chat.id
  const messageId = query.message.message_id

  if (data === 'admgroups') {
    const adminGroups = await getAdminGroupsForTelegramId(telegramId)
    const { text, reply_markup } = buildGroupListMessage(adminGroups)
    await editTelegramMessage(chatId, messageId, text, reply_markup)
    await answerCallbackQuery(query.id)
    return true
  }

  if (data.startsWith('admgrp:')) {
    const groupId = data.replace('admgrp:', '')
    const isAdmin = await checkTelegramAdmin(Number(groupId), Number(telegramId))
    if (!isAdmin) {
      await answerCallbackQuery(query.id, '⛔ Bu grup için yetkin yok.', true)
      return true
    }
    const group = await prisma.telegramGroup.findUnique({ where: { groupId } })
    if (!group) {
      await answerCallbackQuery(query.id, '⛔ Grup bulunamadı.', true)
      return true
    }
    await prisma.botAdminSession.upsert({
      where: { telegramId },
      update: { groupId, mode: null, draftTitle: null, draftMessage: null },
      create: { telegramId, groupId },
    })
    const { text, reply_markup } = await buildGroupMenuMessage(group)
    await editTelegramMessage(chatId, messageId, text, reply_markup)
    await answerCallbackQuery(query.id)
    return true
  }

  if (data.startsWith('admbroadcast:')) {
    const groupId = data.replace('admbroadcast:', '')
    if (groupId !== 'all') {
      const isAdmin = await checkTelegramAdmin(Number(groupId), Number(telegramId))
      if (!isAdmin) {
        await answerCallbackQuery(query.id, '⛔ Bu grup için yetkin yok.', true)
        return true
      }
    }
    await prisma.botAdminSession.upsert({
      where: { telegramId },
      update: { mode: 'awaiting_broadcast', groupId: groupId === 'all' ? null : groupId, menuChatId: String(chatId), menuMessageId: String(messageId) },
      create: { telegramId, mode: 'awaiting_broadcast', groupId: groupId === 'all' ? null : groupId, menuChatId: String(chatId), menuMessageId: String(messageId) },
    })
    await editTelegramMessage(
      chatId,
      messageId,
      '✍️ Tüm kullanıcılara gönderilecek mesajı buraya yaz (emoji, kalın/italik yazı desteklenir).',
      cancelKeyboard(groupId === 'all' ? null : groupId)
    )
    await answerCallbackQuery(query.id)
    return true
  }

  if (data.startsWith('admcrossban:')) {
    const groupId = data.replace('admcrossban:', '')
    const isAdmin = await checkTelegramAdmin(Number(groupId), Number(telegramId))
    if (!isAdmin) {
      await answerCallbackQuery(query.id, '⛔ Bu grup için yetkin yok.', true)
      return true
    }
    const current = await isCrossBanEnabled(groupId)
    await setCrossBanEnabled(groupId, !current)
    const group = await prisma.telegramGroup.findUnique({ where: { groupId } })
    if (group) {
      const { text, reply_markup } = await buildGroupMenuMessage(group)
      await editTelegramMessage(chatId, messageId, text, reply_markup)
    }
    await answerCallbackQuery(query.id, !current ? '✅ Çapraz ban açıldı.' : '❌ Çapraz ban kapatıldı.')
    return true
  }

  // ─── Randy Grup Varsayılanları (randy-web mantığı - tamamen buton tabanlı) ──

  // "❌ İptal" butonu - her "yaz" ekranının altında bulunur, /iptal YAZMAYA
  // gerek bırakmadan bekleyen işlemi temizler ve ilgili menüye geri döner.
  if (data.startsWith('admcancel:')) {
    const groupId = data.replace('admcancel:', '')

    // ✅ FIX: İptal artık her zaman grubun ANA menüsüne değil, hangi alt
    // ekrandan geldiyse (örn. Randy Ayarları içindeki bir "yaz" istemi) ORAYA
    // geri dönüyor. Bunun için temizlemeden ÖNCE mevcut session modunu okuyoruz.
    const currentSession = await prisma.botAdminSession.findUnique({ where: { telegramId } })
    const wasInRandyConfig = currentSession?.mode?.startsWith('awaiting_randy_') ?? false

    await prisma.botAdminSession.update({ where: { telegramId }, data: { mode: null, draftTitle: null, draftMessage: null } }).catch(() => {})

    if (groupId === 'all') {
      const groups = await getAdminGroupsForTelegramId(telegramId)
      const { text, reply_markup } = buildGroupListMessage(groups)
      await editTelegramMessage(chatId, messageId, text, reply_markup)
      await answerCallbackQuery(query.id, '❌ İptal edildi')
      return true
    }

    const group = await prisma.telegramGroup.findUnique({ where: { groupId } })
    if (group) {
      if (wasInRandyConfig) {
        const { text, reply_markup } = await buildRandyConfigMessage(group)
        await editTelegramMessage(chatId, messageId, text, reply_markup)
      } else {
        const { text, reply_markup } = await buildGroupMenuMessage(group)
        await editTelegramMessage(chatId, messageId, text, reply_markup)
      }
    }
    await answerCallbackQuery(query.id, '❌ İptal edildi')
    return true
  }

  if (data.startsWith('admrandycfg:')) {
    const groupId = data.replace('admrandycfg:', '')
    const isAdmin = await checkTelegramAdmin(Number(groupId), Number(telegramId))
    if (!isAdmin) {
      await answerCallbackQuery(query.id, '⛔ Bu grup için yetkin yok.', true)
      return true
    }
    const group = await prisma.telegramGroup.findUnique({ where: { groupId } })
    if (!group) {
      await answerCallbackQuery(query.id, '⛔ Grup bulunamadı.', true)
      return true
    }
    const { text, reply_markup } = await buildRandyConfigMessage(group)
    await editTelegramMessage(chatId, messageId, text, reply_markup)
    await answerCallbackQuery(query.id)
    return true
  }

  if (data.startsWith('randyreqmenu:')) {
    const groupId = data.replace('randyreqmenu:', '')
    const isAdmin = await checkTelegramAdmin(Number(groupId), Number(telegramId))
    if (!isAdmin) {
      await answerCallbackQuery(query.id, '⛔ Bu grup için yetkin yok.', true)
      return true
    }
    const group = await prisma.telegramGroup.findUnique({ where: { groupId } })
    if (!group) {
      await answerCallbackQuery(query.id, '⛔ Grup bulunamadı.', true)
      return true
    }
    const { text, reply_markup } = await buildRandyReqMenuMessage(group)
    await editTelegramMessage(chatId, messageId, text, reply_markup)
    await answerCallbackQuery(query.id)
    return true
  }

  if (data.startsWith('randyptsmenu:')) {
    const groupId = data.replace('randyptsmenu:', '')
    const isAdmin = await checkTelegramAdmin(Number(groupId), Number(telegramId))
    if (!isAdmin) {
      await answerCallbackQuery(query.id, '⛔ Bu grup için yetkin yok.', true)
      return true
    }
    const group = await prisma.telegramGroup.findUnique({ where: { groupId } })
    if (!group) {
      await answerCallbackQuery(query.id, '⛔ Grup bulunamadı.', true)
      return true
    }
    const { text, reply_markup } = await buildRandyPointsMenuMessage(group)
    await editTelegramMessage(chatId, messageId, text, reply_markup)
    await answerCallbackQuery(query.id)
    return true
  }

  if (data.startsWith('randymsg:')) {
    const groupId = data.replace('randymsg:', '')
    const isAdmin = await checkTelegramAdmin(Number(groupId), Number(telegramId))
    if (!isAdmin) {
      await answerCallbackQuery(query.id, '⛔ Bu grup için yetkin yok.', true)
      return true
    }
    await prisma.botAdminSession.upsert({
      where: { telegramId },
      update: { mode: 'awaiting_randy_default_message', groupId, menuChatId: String(chatId), menuMessageId: String(messageId) },
      create: { telegramId, mode: 'awaiting_randy_default_message', groupId, menuChatId: String(chatId), menuMessageId: String(messageId) },
    })
    await editTelegramMessage(
      chatId,
      messageId,
      '✍️ Randy duyuru mesajını yaz (emoji, kalın/italik yazı desteklenir). Bu mesaj artık kalıcı - "/randy" yazınca hep bu mesaj kullanılacak.',
      cancelKeyboard(groupId)
    )
    await answerCallbackQuery(query.id)
    return true
  }

  if (data.startsWith('randyreq:')) {
    const [, groupId, reqType] = data.split(':')
    const isAdmin = await checkTelegramAdmin(Number(groupId), Number(telegramId))
    if (!isAdmin) {
      await answerCallbackQuery(query.id, '⛔ Bu grup için yetkin yok.', true)
      return true
    }
    if (reqType === 'none') {
      await setRandyGroupDefaults(groupId, { requirementType: 'none', requiredMessageCount: null })
      const group = await prisma.telegramGroup.findUnique({ where: { groupId } })
      if (group) {
        const { text, reply_markup } = await buildRandyReqMenuMessage(group)
        await editTelegramMessage(chatId, messageId, text, reply_markup)
      }
      await answerCallbackQuery(query.id, '✅ Şartsız yapıldı.')
      return true
    }
    // daily/weekly/monthly - kaç mesaj gerektiğini soralım
    await prisma.botAdminSession.upsert({
      where: { telegramId },
      update: { mode: `awaiting_randy_req_count:${reqType}`, groupId, menuChatId: String(chatId), menuMessageId: String(messageId) },
      create: { telegramId, mode: `awaiting_randy_req_count:${reqType}`, groupId, menuChatId: String(chatId), menuMessageId: String(messageId) },
    })
    await editTelegramMessage(chatId, messageId, `✍️ Kaç ${REQUIREMENT_LABEL_TR[reqType] || reqType} gerekiyor? Sadece sayı yaz.`, cancelKeyboard(groupId))
    await answerCallbackQuery(query.id)
    return true
  }

  if (data.startsWith('randywinner:')) {
    const groupId = data.replace('randywinner:', '')
    const isAdmin = await checkTelegramAdmin(Number(groupId), Number(telegramId))
    if (!isAdmin) {
      await answerCallbackQuery(query.id, '⛔ Bu grup için yetkin yok.', true)
      return true
    }
    await prisma.botAdminSession.upsert({
      where: { telegramId },
      update: { mode: 'awaiting_randy_default_winner', groupId, menuChatId: String(chatId), menuMessageId: String(messageId) },
      create: { telegramId, mode: 'awaiting_randy_default_winner', groupId, menuChatId: String(chatId), menuMessageId: String(messageId) },
    })
    await editTelegramMessage(chatId, messageId, '✍️ Varsayılan kazanan sayısını yaz (sadece sayı).', cancelKeyboard(groupId))
    await answerCallbackQuery(query.id)
    return true
  }

  if (data.startsWith('randypts_add:')) {
    const groupId = data.replace('randypts_add:', '')
    const isAdmin = await checkTelegramAdmin(Number(groupId), Number(telegramId))
    if (!isAdmin) {
      await answerCallbackQuery(query.id, '⛔ Bu grup için yetkin yok.', true)
      return true
    }
    await prisma.botAdminSession.upsert({
      where: { telegramId },
      update: { mode: 'awaiting_randy_default_points', groupId, menuChatId: String(chatId), menuMessageId: String(messageId) },
      create: { telegramId, mode: 'awaiting_randy_default_points', groupId, menuChatId: String(chatId), menuMessageId: String(messageId) },
    })
    await editTelegramMessage(chatId, messageId, '✍️ Kazanana verilecek puanı yaz (sadece sayı).', cancelKeyboard(groupId))
    await answerCallbackQuery(query.id)
    return true
  }

  if (data.startsWith('randypts_clear:')) {
    const groupId = data.replace('randypts_clear:', '')
    const isAdmin = await checkTelegramAdmin(Number(groupId), Number(telegramId))
    if (!isAdmin) {
      await answerCallbackQuery(query.id, '⛔ Bu grup için yetkin yok.', true)
      return true
    }
    await setRandyGroupDefaults(groupId, { pointsReward: null })
    const group = await prisma.telegramGroup.findUnique({ where: { groupId } })
    if (group) {
      const { text, reply_markup } = await buildRandyPointsMenuMessage(group)
      await editTelegramMessage(chatId, messageId, text, reply_markup)
    }
    await answerCallbackQuery(query.id, '✅ Puan ödülü kaldırıldı.')
    return true
  }

  if (data.startsWith('randyptsonly:')) {
    const groupId = data.replace('randyptsonly:', '')
    const isAdmin = await checkTelegramAdmin(Number(groupId), Number(telegramId))
    if (!isAdmin) {
      await answerCallbackQuery(query.id, '⛔ Bu grup için yetkin yok.', true)
      return true
    }
    const current = await getRandyGroupDefaults(groupId)
    const newValue = !(current?.pointsOnly ?? false)
    await setRandyGroupDefaults(groupId, { pointsOnly: newValue })
    const group = await prisma.telegramGroup.findUnique({ where: { groupId } })
    if (group) {
      const { text, reply_markup } = await buildRandyPointsMenuMessage(group)
      await editTelegramMessage(chatId, messageId, text, reply_markup)
    }
    await answerCallbackQuery(query.id, newValue ? '✅ Sadece Puan açıldı.' : '✅ Sadece Puan kapatıldı.')
    return true
  }

  if (data.startsWith('randywebreq:')) {
    const groupId = data.replace('randywebreq:', '')
    const isAdmin = await checkTelegramAdmin(Number(groupId), Number(telegramId))
    if (!isAdmin) {
      await answerCallbackQuery(query.id, '⛔ Bu grup için yetkin yok.', true)
      return true
    }
    const current = await getRandyGroupDefaults(groupId)
    const newValue = !(current?.requireWebsiteMembership ?? false)
    await setRandyGroupDefaults(groupId, { requireWebsiteMembership: newValue })
    const group = await prisma.telegramGroup.findUnique({ where: { groupId } })
    if (group) {
      const { text, reply_markup } = await buildRandyConfigMessage(group)
      await editTelegramMessage(chatId, messageId, text, reply_markup)
    }
    await answerCallbackQuery(query.id, newValue ? '✅ Website zorunluluğu açıldı.' : '✅ Website zorunluluğu kapatıldı.')
    return true
  }

  if (data.startsWith('rdefwctoggle:')) {
    const [, groupId, channelId] = data.split(':')
    const isAdmin = await checkTelegramAdmin(Number(groupId), Number(telegramId))
    if (!isAdmin) {
      await answerCallbackQuery(query.id, '⛔ Bu grup için yetkin yok.', true)
      return true
    }
    const existing = await listRandyGroupDefaultChannels(groupId)
    const isRequired = existing.some((c) => c.channelId === channelId)
    if (isRequired) {
      await removeRandyGroupDefaultChannel(groupId, channelId)
    } else {
      const known = await listCrossBanChannels()
      const ch = known.find((c) => c.channelId === channelId)
      await addRandyGroupDefaultChannel(groupId, channelId, ch?.username || null, ch?.title || null)
    }
    const group = await prisma.telegramGroup.findUnique({ where: { groupId } })
    if (group) {
      const { text, reply_markup } = await buildRandyChannelListMessage(group)
      await editTelegramMessage(chatId, messageId, text, reply_markup)
    }
    await answerCallbackQuery(query.id)
    return true
  }

  if (data.startsWith('rdefwcadd:')) {
    const groupId = data.replace('rdefwcadd:', '')
    const isAdmin = await checkTelegramAdmin(Number(groupId), Number(telegramId))
    if (!isAdmin) {
      await answerCallbackQuery(query.id, '⛔ Bu grup için yetkin yok.', true)
      return true
    }
    await prisma.botAdminSession.upsert({
      where: { telegramId },
      update: { mode: 'awaiting_randy_default_channel_add', groupId, menuChatId: String(chatId), menuMessageId: String(messageId) },
      create: { telegramId, mode: 'awaiting_randy_default_channel_add', groupId, menuChatId: String(chatId), menuMessageId: String(messageId) },
    })
    await editTelegramMessage(
      chatId,
      messageId,
      '✍️ Yeni kanal eklemek için o kanaldan bir mesajı buraya ilet (forward), ya da kanal ID\'sini yaz.',
      cancelKeyboard(groupId)
    )
    await answerCallbackQuery(query.id)
    return true
  }

  if (data.startsWith('randywc:')) {
    const groupId = data.replace('randywc:', '')
    const isAdmin = await checkTelegramAdmin(Number(groupId), Number(telegramId))
    if (!isAdmin) {
      await answerCallbackQuery(query.id, '⛔ Bu grup için yetkin yok.', true)
      return true
    }
    const group = await prisma.telegramGroup.findUnique({ where: { groupId } })
    if (group) {
      const { text, reply_markup } = await buildRandyChannelListMessage(group)
      await editTelegramMessage(chatId, messageId, text, reply_markup)
    }
    await answerCallbackQuery(query.id)
    return true
  }

  if (data.startsWith('admtagexcl:')) {
    const groupId = data.replace('admtagexcl:', '')
    const isAdmin = await checkTelegramAdmin(Number(groupId), Number(telegramId))
    if (!isAdmin) {
      await answerCallbackQuery(query.id, '⛔ Bu grup için yetkin yok.', true)
      return true
    }
    const { getExcludedUsers } = await import('../services/tagging-service')
    const excluded = await getExcludedUsers(groupId)
    const list = excluded.length === 0
      ? 'Şu an hariç tutulan kimse yok.'
      : excluded.map((u) => `• ${u.username ? `@${u.username}` : u.firstName || u.telegramId}`).join('\n')

    await editTelegramMessage(
      chatId,
      messageId,
      `🚫 <b>Etiketleme Hariç Listesi</b>\n\n${list}\n\nEklemek/çıkarmak için "✍️ Kullanıcı Ekle/Çıkar" butonuna bas.`,
      {
        inline_keyboard: [
          [{ text: '✍️ Kullanıcı Ekle/Çıkar', callback_data: `admtagexcladd:${groupId}` }],
          [{ text: '⬅️ Geri', callback_data: `admgrp:${groupId}` }],
        ],
      }
    )
    await answerCallbackQuery(query.id)
    return true
  }

  if (data.startsWith('admtagexcladd:')) {
    const groupId = data.replace('admtagexcladd:', '')
    const isAdmin = await checkTelegramAdmin(Number(groupId), Number(telegramId))
    if (!isAdmin) {
      await answerCallbackQuery(query.id, '⛔ Bu grup için yetkin yok.', true)
      return true
    }
    await prisma.botAdminSession.upsert({
      where: { telegramId },
      update: { mode: 'awaiting_tag_exclude', groupId, menuChatId: String(chatId), menuMessageId: String(messageId) },
      create: { telegramId, mode: 'awaiting_tag_exclude', groupId, menuChatId: String(chatId), menuMessageId: String(messageId) },
    })
    await editTelegramMessage(
      chatId,
      messageId,
      '✍️ Kullanıcı adı (@olmadan) ya da telegram ID yaz.\n\nHariç tutmak için başına hiçbir şey ekleme, tekrar dahil etmek için başına "-" koy (örn: <code>-ahmet</code>).',
      cancelKeyboard(groupId)
    )
    await answerCallbackQuery(query.id)
    return true
  }

  if (data.startsWith('admtag_new:')) {
    const groupId = data.replace('admtag_new:', '')
    const isAdmin = await checkTelegramAdmin(Number(groupId), Number(telegramId))
    if (!isAdmin) {
      await answerCallbackQuery(query.id, '⛔ Bu grup için yetkin yok.', true)
      return true
    }
    await prisma.botAdminSession.upsert({
      where: { telegramId },
      update: { mode: 'awaiting_tag_message', groupId, menuChatId: String(chatId), menuMessageId: String(messageId) },
      create: { telegramId, mode: 'awaiting_tag_message', groupId, menuChatId: String(chatId), menuMessageId: String(messageId) },
    })
    await editTelegramMessage(
      chatId,
      messageId,
      '✍️ Üyelere etiketle atılacak mesajı yaz (etiketlenebilir üyelerin hepsine 5\'erli gruplar halinde gönderilecek).',
      cancelKeyboard(groupId)
    )
    await answerCallbackQuery(query.id)
    return true
  }

  if (data.startsWith('admtag_stop:')) {
    const groupId = data.replace('admtag_stop:', '')
    await stopTaggingRun(groupId)
    await answerCallbackQuery(query.id, '🛑 Etiketleme durduruldu.', true)
    return true
  }

  if (data.startsWith('admweeklymenu:')) {
    const groupId = data.replace('admweeklymenu:', '')
    const isAdmin = await checkTelegramAdmin(Number(groupId), Number(telegramId))
    if (!isAdmin) {
      await answerCallbackQuery(query.id, '⛔ Bu grup için yetkin yok.', true)
      return true
    }
    const group = await prisma.telegramGroup.findUnique({ where: { groupId } })
    if (!group) {
      await answerCallbackQuery(query.id, '⛔ Grup bulunamadı.', true)
      return true
    }
    const { text, reply_markup } = await buildWeeklyMenuMessage(group)
    await editTelegramMessage(chatId, messageId, text, reply_markup)
    await answerCallbackQuery(query.id)
    return true
  }

  if (data.startsWith('admweeklyreward:')) {
    const [, groupId, rankStr] = data.split(':')
    const isAdmin = await checkTelegramAdmin(Number(groupId), Number(telegramId))
    if (!isAdmin) {
      await answerCallbackQuery(query.id, '⛔ Bu grup için yetkin yok.', true)
      return true
    }
    await prisma.botAdminSession.upsert({
      where: { telegramId },
      update: { mode: `awaiting_weekly_reward:${rankStr}`, groupId, menuChatId: String(chatId), menuMessageId: String(messageId) },
      create: { telegramId, mode: `awaiting_weekly_reward:${rankStr}`, groupId, menuChatId: String(chatId), menuMessageId: String(messageId) },
    })
    await editTelegramMessage(chatId, messageId, `✍️ ${rankStr}. sıraya verilecek ödülü yaz (örn. "500 puan"):`, cancelKeyboard(groupId))
    await answerCallbackQuery(query.id)
    return true
  }

  if (data.startsWith('admweeklytop:')) {
    const groupId = data.replace('admweeklytop:', '')
    const isAdmin = await checkTelegramAdmin(Number(groupId), Number(telegramId))
    if (!isAdmin) {
      await answerCallbackQuery(query.id, '⛔ Bu grup için yetkin yok.', true)
      return true
    }
    await prisma.botAdminSession.upsert({
      where: { telegramId },
      update: { mode: 'awaiting_weekly_top_count', groupId, menuChatId: String(chatId), menuMessageId: String(messageId) },
      create: { telegramId, mode: 'awaiting_weekly_top_count', groupId, menuChatId: String(chatId), menuMessageId: String(messageId) },
    })
    await editTelegramMessage(chatId, messageId, '✍️ Kaç kişiye ödül verilecek? Sadece sayı yaz (en fazla 5):', cancelKeyboard(groupId))
    await answerCallbackQuery(query.id)
    return true
  }

  if (data.startsWith('admweeklypin:')) {
    const groupId = data.replace('admweeklypin:', '')
    const isAdmin = await checkTelegramAdmin(Number(groupId), Number(telegramId))
    if (!isAdmin) {
      await answerCallbackQuery(query.id, '⛔ Bu grup için yetkin yok.', true)
      return true
    }
    const current = await getWeeklyRewardSettings(groupId)
    await setWeeklyRewardSettings(groupId, { autoPin: !(current?.autoPin ?? false) })
    const group = await prisma.telegramGroup.findUnique({ where: { groupId } })
    if (group) {
      const { text, reply_markup } = await buildWeeklyMenuMessage(group)
      await editTelegramMessage(chatId, messageId, text, reply_markup)
    }
    await answerCallbackQuery(query.id)
    return true
  }

  if (data.startsWith('admweekly:')) {
    const groupId = data.replace('admweekly:', '')
    const isAdmin = await checkTelegramAdmin(Number(groupId), Number(telegramId))
    if (!isAdmin) {
      await answerCallbackQuery(query.id, '⛔ Bu grup için yetkin yok.', true)
      return true
    }
    const current = await getWeeklyRewardSettings(groupId)
    await setWeeklyRewardSettings(groupId, { enabled: !(current?.enabled ?? false), autoPostSunday: true })
    const group = await prisma.telegramGroup.findUnique({ where: { groupId } })
    if (group) {
      const { text, reply_markup } = await buildWeeklyMenuMessage(group)
      await editTelegramMessage(chatId, messageId, text, reply_markup)
    }
    await answerCallbackQuery(query.id, !(current?.enabled ?? false) ? '✅ Her Pazar 20:00\'de otomatik duyurulacak.' : '❌ Kapatıldı.')
    return true
  }

  if (data.startsWith('admactivitymenu:')) {
    const groupId = data.replace('admactivitymenu:', '')
    const isAdmin = await checkTelegramAdmin(Number(groupId), Number(telegramId))
    if (!isAdmin) {
      await answerCallbackQuery(query.id, '⛔ Bu grup için yetkin yok.', true)
      return true
    }
    const group = await prisma.telegramGroup.findUnique({ where: { groupId } })
    if (!group) {
      await answerCallbackQuery(query.id, '⛔ Grup bulunamadı.', true)
      return true
    }
    const { text, reply_markup } = await buildActivityMenuMessage(group)
    await editTelegramMessage(chatId, messageId, text, reply_markup)
    await answerCallbackQuery(query.id)
    return true
  }

  if (data.startsWith('admactivityreward:')) {
    const [, groupId, rankStr] = data.split(':')
    const isAdmin = await checkTelegramAdmin(Number(groupId), Number(telegramId))
    if (!isAdmin) {
      await answerCallbackQuery(query.id, '⛔ Bu grup için yetkin yok.', true)
      return true
    }
    await prisma.botAdminSession.upsert({
      where: { telegramId },
      update: { mode: `awaiting_activity_reward:${rankStr}`, groupId, menuChatId: String(chatId), menuMessageId: String(messageId) },
      create: { telegramId, mode: `awaiting_activity_reward:${rankStr}`, groupId, menuChatId: String(chatId), menuMessageId: String(messageId) },
    })
    await editTelegramMessage(chatId, messageId, `✍️ ${rankStr}. sıraya verilecek ödülü yaz (örn. "300 puan"):`, cancelKeyboard(groupId))
    await answerCallbackQuery(query.id)
    return true
  }

  if (data.startsWith('admactivity:')) {
    const groupId = data.replace('admactivity:', '')
    const isAdmin = await checkTelegramAdmin(Number(groupId), Number(telegramId))
    if (!isAdmin) {
      await answerCallbackQuery(query.id, '⛔ Bu grup için yetkin yok.', true)
      return true
    }
    const contest = await getActivityContestSettings(groupId)
    if (contest?.isRunning) {
      const result = await stopActivityContestAndAnnounce(groupId)
      await answerCallbackQuery(query.id, result.ok ? '✅ Yarışma bitirildi ve sonuçlar duyuruldu!' : `⚠️ ${result.error}`, true)
    } else {
      const result = await startActivityContest(groupId)
      await answerCallbackQuery(query.id, result.ok ? '📈 Yarışma başladı! Mesaj sayımı başladı.' : `⚠️ ${result.error}`, true)
    }
    const group = await prisma.telegramGroup.findUnique({ where: { groupId } })
    if (group) {
      const { text, reply_markup } = await buildActivityMenuMessage(group)
      await editTelegramMessage(chatId, messageId, text, reply_markup)
    }
    return true
  }

  if (data.startsWith('admgptmenu:')) {
    const groupId = data.replace('admgptmenu:', '')
    const isAdmin = await checkTelegramAdmin(Number(groupId), Number(telegramId))
    if (!isAdmin) {
      await answerCallbackQuery(query.id, '⛔ Bu grup için yetkin yok.', true)
      return true
    }
    const group = await prisma.telegramGroup.findUnique({ where: { groupId } })
    if (!group) {
      await answerCallbackQuery(query.id, '⛔ Grup bulunamadı.', true)
      return true
    }
    const { text, reply_markup } = await buildGptMenuMessage(group)
    await editTelegramMessage(chatId, messageId, text, reply_markup)
    await answerCallbackQuery(query.id)
    return true
  }

  if (data.startsWith('admgptword:')) {
    const groupId = data.replace('admgptword:', '')
    const isAdmin = await checkTelegramAdmin(Number(groupId), Number(telegramId))
    if (!isAdmin) {
      await answerCallbackQuery(query.id, '⛔ Bu grup için yetkin yok.', true)
      return true
    }
    await prisma.botAdminSession.upsert({
      where: { telegramId },
      update: { mode: 'awaiting_gpt_trigger_word', groupId, menuChatId: String(chatId), menuMessageId: String(messageId) },
      create: { telegramId, mode: 'awaiting_gpt_trigger_word', groupId, menuChatId: String(chatId), menuMessageId: String(messageId) },
    })
    await editTelegramMessage(chatId, messageId, '✍️ Yeni tetikleyici kelimeyi yaz (örn. "harley"):', cancelKeyboard(groupId))
    await answerCallbackQuery(query.id)
    return true
  }

  if (data.startsWith('admgpt:')) {
    const groupId = data.replace('admgpt:', '')
    const isAdmin = await checkTelegramAdmin(Number(groupId), Number(telegramId))
    if (!isAdmin) {
      await answerCallbackQuery(query.id, '⛔ Bu grup için yetkin yok.', true)
      return true
    }
    const current = await getGptSettings(groupId)
    const newEnabled = !(current?.enabled ?? false)
    await setGptSettings(groupId, { enabled: newEnabled })
    const group = await prisma.telegramGroup.findUnique({ where: { groupId } })
    if (group) {
      const { text, reply_markup } = await buildGptMenuMessage(group)
      await editTelegramMessage(chatId, messageId, text, reply_markup)
    }
    const triggerWord = current?.triggerWord || 'harley'
    await answerCallbackQuery(query.id, newEnabled ? `✅ GPT sohbet açıldı ("${triggerWord}" kelimesi geçince cevap verir).` : '❌ GPT sohbet kapatıldı.')
    return true
  }

  if (data.startsWith('admgiveaway_new:')) {
    const groupId = data.replace('admgiveaway_new:', '')
    const isAdmin = await checkTelegramAdmin(Number(groupId), Number(telegramId))
    if (!isAdmin) {
      await answerCallbackQuery(query.id, '⛔ Bu grup için yetkin yok.', true)
      return true
    }
    const active = await getActiveClassicGiveaway(groupId)
    if (active) {
      await prisma.botAdminSession.upsert({
        where: { telegramId },
        update: { mode: null, groupId },
        create: { telegramId, groupId },
      })
      const status = await getClassicGiveawayStatus(groupId)
      const winnersText = status && status.winners.length > 0
        ? '\n\n🏆 Kazananlar:\n' + status.winners.map((w: { name: string }, i: number) => `${i + 1}. ${w.name}`).join('\n')
        : ''
      const slotsText = status && status.allSlots.length > 0
        ? '\n\n🕐 Tüm Kazanma Anları:\n' + status.allSlots.map((s: { slotNumber: number; winTime: Date; isWon: boolean; winnerName: string | null }) =>
            `${s.slotNumber}. ${s.winTime.toLocaleString('tr-TR')} - ${s.isWon ? `🏆 ${s.winnerName}` : '⏳ Bekleniyor'}`
          ).join('\n')
        : ''
      const statusText = status
        ? [
            `⚠️ Bu grupta zaten aktif bir klasik çekiliş var.`,
            '',
            `🎁 Ödül: ${active.prizeText}`,
            `📊 İlerleme: ${status.wonCount}/${status.totalSlots} kazanan bulundu`,
            `⏳ Kalan: ${status.remainingCount}`,
            `🕐 Bitiş: ${active.endsAt.toLocaleString('tr-TR')}`,
            winnersText,
            slotsText,
          ].filter(Boolean).join('\n')
        : '⚠️ Bu grupta zaten aktif bir klasik çekiliş var.'

      await editTelegramMessage(chatId, messageId, statusText, {
        inline_keyboard: [
          [{ text: '🏁 Bitir (kalanları hemen kazandır)', callback_data: `admgiveaway_end:${active.id}` }],
          [{ text: '🗑️ İptal Et', callback_data: `admgiveaway_cancel:${active.id}` }],
        ],
      })
      await answerCallbackQuery(query.id)
      return true
    }
    await prisma.botAdminSession.upsert({
      where: { telegramId },
      update: { mode: 'awaiting_giveaway_prize', groupId, menuChatId: String(chatId), menuMessageId: String(messageId) },
      create: { telegramId, mode: 'awaiting_giveaway_prize', groupId, menuChatId: String(chatId), menuMessageId: String(messageId) },
    })
    await editTelegramMessage(chatId, messageId, '✍️ Ödül metnini yaz (örn: "50 puan").', cancelKeyboard(groupId))
    await answerCallbackQuery(query.id)
    return true
  }

  if (data.startsWith('admgiveaway_end:')) {
    await endClassicGiveaway(data.replace('admgiveaway_end:', ''))
    await answerCallbackQuery(query.id, '✅ Çekiliş bitirildi (kalan slotlar kazanan beklemeden sona erdi).', true)
    return true
  }

  if (data.startsWith('admgiveaway_cancel:')) {
    await cancelClassicGiveaway(data.replace('admgiveaway_cancel:', ''))
    await answerCallbackQuery(query.id, '🗑️ Çekiliş iptal edildi.', true)
    return true
  }


  if (data.startsWith('admrandy_new:')) {
    const groupId = data.replace('admrandy_new:', '')
    const isAdmin = await checkTelegramAdmin(Number(groupId), Number(telegramId))
    if (!isAdmin) {
      await answerCallbackQuery(query.id, '⛔ Bu kanal için yetkin yok.', true)
      return true
    }

    const { startRandyFromDefaults, getRandyGroupDefaults } = await import('../services/randy-quick-draft-service')
    const defaults = await getRandyGroupDefaults(groupId)

    // ✅ FIX: Eskiden mesaj/kazanan sayısı ayarlanmamışsa burada çıkmaz
    // sokağa giriyordu ("önce ayarla" hatası verip başka bir menüye
    // yönlendiriyordu). Artık aynı ekranda hemen soruyor, admin ayrı bir
    // menüye gitmek zorunda kalmadan burada yazıp başlatabiliyor.
    if (!defaults?.message) {
      await prisma.botAdminSession.upsert({
        where: { telegramId },
        update: { mode: 'awaiting_randy_start_message', groupId, menuChatId: String(chatId), menuMessageId: String(messageId) },
        create: { telegramId, mode: 'awaiting_randy_start_message', groupId, menuChatId: String(chatId), menuMessageId: String(messageId) },
      })
      await editTelegramMessage(
        chatId,
        messageId,
        '✍️ Bu Randy için duyuru mesajını yaz (emoji, kalın/italik yazı desteklenir):',
        { inline_keyboard: [[{ text: '❌ İptal', callback_data: 'admcancel' }]] }
      )
      return true
    }

    if (!defaults.winnerCount || defaults.winnerCount < 1) {
      await prisma.botAdminSession.upsert({
        where: { telegramId },
        update: { mode: 'awaiting_randy_start_winner', groupId, menuChatId: String(chatId), menuMessageId: String(messageId) },
        create: { telegramId, mode: 'awaiting_randy_start_winner', groupId, menuChatId: String(chatId), menuMessageId: String(messageId) },
      })
      await editTelegramMessage(
        chatId,
        messageId,
        '🔢 Kazanan sayısını yaz (örn. 5):',
        { inline_keyboard: [[{ text: '❌ İptal', callback_data: 'admcancel' }]] }
      )
      return true
    }

    const result = await startRandyFromDefaults(groupId)
    if (!result.success) {
      await answerCallbackQuery(query.id, `⚠️ ${result.error}`, true)
      return true
    }
    await answerCallbackQuery(query.id, '✅ Randy başlatıldı!')
    return true
  }

  if (data.startsWith('admrandy_end:')) {
    const randyId = data.replace('admrandy_end:', '')
    const result = await endRandy(randyId)
    await answerCallbackQuery(query.id, result.success ? '✅ Randy sonlandırıldı ve kazananlar duyuruldu!' : `⚠️ ${result.error}`, true)
    return true
  }

  return false
}

// ─── Bekleyen mesaj yakalama (DM'de admin oturumu varken) ──────────────────

export async function handlePendingAdminMessage(message: any): Promise<boolean> {
  const telegramId = String(message.from.id)
  const text: string = (message.text || '').trim()

  const session = await prisma.botAdminSession.findUnique({ where: { telegramId } })
  if (!session || !session.mode) return false

  // ✅ Artık /iptal yazmaya gerek yok - her ekranın altında "❌ İptal" butonu
  // var (admcancel: callback'i). Temiz menü: admin'in panel akışı sırasında
  // yazdığı mesaj (sayı, kanal ID'si vb.) işlendikten hemen sonra silinir -
  // sohbet, tek bir güncel menü ekranından ibaret kalır. Telegram botların
  // özel sohbette KENDİLERİNE gelen mesajları silmesine izin veriyor (bkz.
  // Bot API: "Bots can delete incoming messages in private chats").
  const cleanupIncomingMessage = () => {
    deleteTelegramMessage(message.chat.id, message.message_id).catch(() => {})
  }

  // ✅ Tüm bot menüsünde tek kural: yeni mesaj göndermek yerine, oturumun
  // bildiği menü mesajını (session.menuChatId/menuMessageId) yerinde
  // güncelle. Menü bilgisi bir sebeple yoksa (çok eski bir oturum vb.)
  // en son çare olarak yeni mesaj gönderilir.
  const updateMenu = async (text: string, keyboard?: any) => {
    if (session.menuChatId && session.menuMessageId) {
      await editTelegramMessage(session.menuChatId, Number(session.menuMessageId), text, keyboard)
    } else {
      await sendTelegramMessage(message.chat.id, text, keyboard ? { keyboard } : undefined)
    }
  }


  // ─── Randy Grup Varsayılanları - sayı/kanal yakalama ────────────────────

  if (session.mode === 'awaiting_tag_exclude') {
    if (!session.groupId) return true
    cleanupIncomingMessage()
    const { setUserTaggableByUsernameOrId, getExcludedUsers } = await import('../services/tagging-service')
    const isRemoving = text.startsWith('-')
    const input = isRemoving ? text.slice(1).trim() : text.trim()

    const result = await setUserTaggableByUsernameOrId(session.groupId, input, isRemoving)
    if (!result.ok) {
      await sendTelegramMessage(message.chat.id, '⚠️ Kullanıcı bulunamadı. Doğru kullanıcı adı/ID yazdığından emin ol ve tekrar dene.')
      return true
    }
    await prisma.botAdminSession.update({ where: { telegramId }, data: { mode: null } })

    // ✅ Temiz menü: yeni bir "✅ kaydedildi" mesajı göndermek yerine, aynı
    // menü mesajını güncel listeyle yerinde düzenliyoruz.
    if (session.menuChatId && session.menuMessageId) {
      const excluded = await getExcludedUsers(session.groupId)
      const list = excluded.length === 0
        ? 'Şu an hariç tutulan kimse yok.'
        : excluded.map((u) => `• ${u.username ? `@${u.username}` : u.firstName || u.telegramId}`).join('\n')
      await editTelegramMessage(
        session.menuChatId,
        Number(session.menuMessageId),
        `🚫 <b>Etiketleme Hariç Listesi</b>\n\n✅ ${result.matchedName} ${isRemoving ? 'tekrar dahil edildi' : 'hariç tutuldu'}\n\n${list}\n\nEklemek/çıkarmak için "✍️ Kullanıcı Ekle/Çıkar" butonuna bas.`,
        {
          inline_keyboard: [
            [{ text: '✍️ Kullanıcı Ekle/Çıkar', callback_data: `admtagexcladd:${session.groupId}` }],
            [{ text: '⬅️ Geri', callback_data: `admgrp:${session.groupId}` }],
          ],
        }
      )
    }
    return true
  }

  if (session.mode?.startsWith('awaiting_weekly_reward:')) {
    const rank = parseInt(session.mode.split(':')[1], 10)
    if (!session.groupId || !rank) return true
    const rewardText = text.trim()
    if (!rewardText) {
      await sendTelegramMessage(message.chat.id, '⚠️ Lütfen bir ödül metni yaz.')
      return true
    }
    cleanupIncomingMessage()
    await setWeeklyReward(session.groupId, rank, rewardText)
    await prisma.botAdminSession.update({ where: { telegramId }, data: { mode: null } })
    const group = await prisma.telegramGroup.findUnique({ where: { groupId: session.groupId } })
    if (group && session.menuChatId && session.menuMessageId) {
      const { text: menuText, reply_markup } = await buildWeeklyMenuMessage(group)
      await editTelegramMessage(session.menuChatId, Number(session.menuMessageId), menuText, reply_markup)
    }
    return true
  }

  if (session.mode?.startsWith('awaiting_activity_reward:')) {
    const rank = parseInt(session.mode.split(':')[1], 10)
    if (!session.groupId || !rank) return true
    const rewardText = text.trim()
    if (!rewardText) {
      await sendTelegramMessage(message.chat.id, '⚠️ Lütfen bir ödül metni yaz.')
      return true
    }
    cleanupIncomingMessage()
    await setActivityReward(session.groupId, rank, rewardText)
    await prisma.botAdminSession.update({ where: { telegramId }, data: { mode: null } })
    const group = await prisma.telegramGroup.findUnique({ where: { groupId: session.groupId } })
    if (group && session.menuChatId && session.menuMessageId) {
      const { text: menuText, reply_markup } = await buildActivityMenuMessage(group)
      await editTelegramMessage(session.menuChatId, Number(session.menuMessageId), menuText, reply_markup)
    }
    return true
  }

  if (session.mode === 'awaiting_weekly_top_count') {
    const count = parseInt(text, 10)
    if (!count || count < 1 || count > 5) {
      await sendTelegramMessage(message.chat.id, '⚠️ 1 ile 5 arasında bir sayı yaz.')
      return true
    }
    if (!session.groupId) return true
    cleanupIncomingMessage()
    await setWeeklyRewardSettings(session.groupId, { topCount: count })
    await prisma.botAdminSession.update({ where: { telegramId }, data: { mode: null } })
    const group = await prisma.telegramGroup.findUnique({ where: { groupId: session.groupId } })
    if (group && session.menuChatId && session.menuMessageId) {
      const { text: menuText, reply_markup } = await buildWeeklyMenuMessage(group)
      await editTelegramMessage(session.menuChatId, Number(session.menuMessageId), menuText, reply_markup)
    }
    return true
  }

  if (session.mode === 'awaiting_gpt_trigger_word') {
    if (!session.groupId) return true
    const word = text.trim()
    if (!word || word.length > 30) {
      await sendTelegramMessage(message.chat.id, '⚠️ Lütfen 1-30 karakter arası bir kelime yaz.')
      return true
    }
    cleanupIncomingMessage()
    await setGptSettings(session.groupId, { triggerWord: word.toLowerCase() })
    await prisma.botAdminSession.update({ where: { telegramId }, data: { mode: null } })
    const group = await prisma.telegramGroup.findUnique({ where: { groupId: session.groupId } })
    if (group && session.menuChatId && session.menuMessageId) {
      const { text: menuText, reply_markup } = await buildGptMenuMessage(group)
      await editTelegramMessage(session.menuChatId, Number(session.menuMessageId), menuText, reply_markup)
    }
    return true
  }

  if (session.mode === 'awaiting_randy_start_message') {
    if (!session.groupId) return true
    const messageContent = message.text || message.caption || ''
    if (!messageContent.trim()) {
      await sendTelegramMessage(message.chat.id, '⚠️ Lütfen bir metin mesajı yaz.')
      return true
    }
    cleanupIncomingMessage()
    const messageEntities = message.entities || message.caption_entities || null
    const { setRandyGroupDefaults, getRandyGroupDefaults, startRandyFromDefaults } = await import('../services/randy-quick-draft-service')
    await setRandyGroupDefaults(session.groupId, {
      message: messageContent,
      messageEntitiesJson: messageEntities && messageEntities.length > 0 ? JSON.stringify(messageEntities) : null,
    })

    const defaults = await getRandyGroupDefaults(session.groupId)
    if (!defaults?.winnerCount || defaults.winnerCount < 1) {
      // Mesaj tamam, sıra kazanan sayısında - aynı akışta devam
      await prisma.botAdminSession.update({ where: { telegramId }, data: { mode: 'awaiting_randy_start_winner' } })
      await updateMenu('🔢 Kazanan sayısını yaz (örn. 5):', { inline_keyboard: [[{ text: '❌ İptal', callback_data: 'admcancel' }]] })
      return true
    }

    await prisma.botAdminSession.update({ where: { telegramId }, data: { mode: null } })
    const result = await startRandyFromDefaults(session.groupId)
    await updateMenu(result.success ? '✅ Randy başlatıldı!' : `⚠️ ${result.error}`)
    return true
  }

  if (session.mode === 'awaiting_randy_start_winner') {
    if (!session.groupId) return true
    const count = parseInt(text, 10)
    if (!count || count < 1) {
      await sendTelegramMessage(message.chat.id, '⚠️ Geçerli bir sayı yaz.')
      return true
    }
    cleanupIncomingMessage()
    const { setRandyGroupDefaults, startRandyFromDefaults } = await import('../services/randy-quick-draft-service')
    await setRandyGroupDefaults(session.groupId, { winnerCount: count })
    await prisma.botAdminSession.update({ where: { telegramId }, data: { mode: null } })
    const result = await startRandyFromDefaults(session.groupId)
    await updateMenu(result.success ? '✅ Randy başlatıldı!' : `⚠️ ${result.error}`)
    return true
  }

  if (session.mode === 'awaiting_randy_default_message') {
    if (!session.groupId) return true
    const messageContent = message.text || message.caption || ''
    if (!messageContent.trim()) {
      await sendTelegramMessage(message.chat.id, '⚠️ Lütfen bir metin mesajı yaz.')
      return true
    }
    cleanupIncomingMessage()
    const messageEntities = message.entities || message.caption_entities || null
    await setRandyGroupDefaults(session.groupId, {
      message: messageContent,
      messageEntitiesJson: messageEntities && messageEntities.length > 0 ? JSON.stringify(messageEntities) : null,
    })
    await prisma.botAdminSession.update({ where: { telegramId }, data: { mode: null } })
    const group = await prisma.telegramGroup.findUnique({ where: { groupId: session.groupId } })
    if (group && session.menuChatId && session.menuMessageId) {
      const { text: menuText, reply_markup } = await buildRandyConfigMessage(group)
      await editTelegramMessage(session.menuChatId, Number(session.menuMessageId), menuText, reply_markup)
    }
    return true
  }

  if (session.mode?.startsWith('awaiting_randy_req_count:')) {
    const reqType = session.mode.split(':')[1]
    const count = parseInt(text, 10)
    if (!count || count < 1) {
      await sendTelegramMessage(message.chat.id, '⚠️ Geçerli bir sayı yaz.')
      return true
    }
    if (!session.groupId) return true
    cleanupIncomingMessage()
    await setRandyGroupDefaults(session.groupId, { requirementType: reqType, requiredMessageCount: count })
    await prisma.botAdminSession.update({ where: { telegramId }, data: { mode: null, groupId: session.groupId } })
    const group = await prisma.telegramGroup.findUnique({ where: { groupId: session.groupId } })
    if (group && session.menuChatId && session.menuMessageId) {
      const { text: menuText, reply_markup } = await buildRandyReqMenuMessage(group)
      await editTelegramMessage(session.menuChatId, Number(session.menuMessageId), menuText, reply_markup)
    }
    return true
  }

  if (session.mode === 'awaiting_randy_default_winner') {
    const count = parseInt(text, 10)
    if (!count || count < 1) {
      await sendTelegramMessage(message.chat.id, '⚠️ Geçerli bir sayı yaz.')
      return true
    }
    if (!session.groupId) return true
    cleanupIncomingMessage()
    await setRandyGroupDefaults(session.groupId, { winnerCount: count })
    await prisma.botAdminSession.update({ where: { telegramId }, data: { mode: null } })
    const group = await prisma.telegramGroup.findUnique({ where: { groupId: session.groupId } })
    if (group && session.menuChatId && session.menuMessageId) {
      const { text: menuText, reply_markup } = await buildRandyConfigMessage(group)
      await editTelegramMessage(session.menuChatId, Number(session.menuMessageId), menuText, reply_markup)
    }
    return true
  }

  if (session.mode === 'awaiting_randy_default_points') {
    const points = parseInt(text, 10)
    if (!points || points < 1) {
      await sendTelegramMessage(message.chat.id, '⚠️ Geçerli bir sayı yaz.')
      return true
    }
    if (!session.groupId) return true
    cleanupIncomingMessage()
    await setRandyGroupDefaults(session.groupId, { pointsReward: points })
    await prisma.botAdminSession.update({ where: { telegramId }, data: { mode: null } })
    const group = await prisma.telegramGroup.findUnique({ where: { groupId: session.groupId } })
    if (group && session.menuChatId && session.menuMessageId) {
      const { text: menuText, reply_markup } = await buildRandyPointsMenuMessage(group)
      await editTelegramMessage(session.menuChatId, Number(session.menuMessageId), menuText, reply_markup)
    }
    return true
  }

  if (session.mode === 'awaiting_randy_default_channel_add') {
    if (!session.groupId) return true
    let channelId: string | null = null
    let channelTitle: string | null = null
    let channelUsername: string | null = null

    if (message.forward_from_chat?.id) {
      channelId = String(message.forward_from_chat.id)
      channelTitle = message.forward_from_chat.title || null
      channelUsername = message.forward_from_chat.username || null
    } else if (/^-?\d+$/.test(text)) {
      channelId = text
    }

    if (!channelId) {
      await sendTelegramMessage(message.chat.id, '⚠️ Bir kanaldan mesaj forward et, ya da kanal ID\'sini (sayı) yaz.')
      return true
    }

    cleanupIncomingMessage()
    await addCrossBanChannel(channelId, channelTitle, channelUsername).catch(() => {})
    await addRandyGroupDefaultChannel(session.groupId, channelId, channelUsername, channelTitle)
    await prisma.botAdminSession.update({ where: { telegramId }, data: { mode: null } })

    // ✅ Temiz menü: yeni mesaj göndermek yerine aynı menüyü yerinde güncelle
    const group = await prisma.telegramGroup.findUnique({ where: { groupId: session.groupId } })
    if (group && session.menuChatId && session.menuMessageId) {
      const { text: menuText, reply_markup } = await buildRandyChannelListMessage(group)
      await editTelegramMessage(session.menuChatId, Number(session.menuMessageId), menuText, reply_markup)
    }
    return true
  }

  if (session.mode === 'awaiting_broadcast') {
    cleanupIncomingMessage()
    await prisma.botAdminSession.update({ where: { telegramId }, data: { mode: null } })
    const result = await sendBroadcastToAllUsers({
      message: text,
      entities: message.entities || undefined,
      adminTelegramId: telegramId,
      adminUsername: message.from.username,
    })
    if (!result.success) {
      await sendTelegramMessage(message.chat.id, `⚠️ Mesaj gönderilemedi: ${result.error}`)
    } else {
      await sendTelegramMessage(
        message.chat.id,
        `✅ Mesaj gönderildi!\n\n👥 Hedef: ${result.totalUsers} kullanıcı\n📬 Gönderilen: ${result.queuedCount}\n⏭️ Atlanan: ${result.skippedCount}`
      )
    }
    return true
  }

  if (session.mode === 'awaiting_giveaway_prize') {
    cleanupIncomingMessage()
    await prisma.botAdminSession.update({ where: { telegramId }, data: { mode: 'awaiting_giveaway_duration', draftMessage: text } })
    await updateMenu('⏱️ Çekiliş kaç saat sürsün? Sadece sayı yaz (örn: 24)', cancelKeyboard(session.groupId))
    return true
  }

  if (session.mode === 'awaiting_giveaway_duration') {
    const hours = parseInt(text, 10)
    if (!hours || hours < 1) {
      await sendTelegramMessage(message.chat.id, '⚠️ Geçerli bir saat sayısı yaz (örn: 24)')
      return true
    }
    await prisma.botAdminSession.update({ where: { telegramId }, data: { mode: 'awaiting_giveaway_winners', draftTitle: String(hours) } })
    cleanupIncomingMessage()
    await updateMenu('🏆 Kaç kişi kazansın? Sadece sayı yaz (örn: 1)', cancelKeyboard(session.groupId))
    return true
  }

  if (session.mode === 'awaiting_giveaway_winners') {
    const winnerCount = parseInt(text, 10)
    if (!winnerCount || winnerCount < 1) {
      await sendTelegramMessage(message.chat.id, '⚠️ Geçerli bir sayı yaz (örn: 1)')
      return true
    }
    if (!session.groupId || !session.draftMessage || !session.draftTitle) {
      await prisma.botAdminSession.update({ where: { telegramId }, data: { mode: null } })
      await sendTelegramMessage(message.chat.id, '⚠️ Bir şeyler ters gitti, /panel yazıp yeniden dene.')
      return true
    }

    const result = await createClassicGiveaway({
      groupId: session.groupId,
      creatorTelegramId: telegramId,
      prizeText: session.draftMessage,
      durationHours: parseInt(session.draftTitle, 10),
      winnerCount,
    })

    cleanupIncomingMessage()
    await prisma.botAdminSession.update({ where: { telegramId }, data: { mode: null, draftMessage: null, draftTitle: null } })

    // ✅ İşlem bitince (başarılı ya da başarısız) otomatik olarak bir önceki
    // grup menüsüne dön - yeni bir "tamam" mesajı biriktirmek yerine.
    const group = await prisma.telegramGroup.findUnique({ where: { groupId: session.groupId } })
    const backToMenu = async (statusLine: string) => {
      if (group) {
        const { text: menuText, reply_markup } = await buildGroupMenuMessage(group)
        await updateMenu(`${statusLine}\n\n${menuText}`, reply_markup)
      } else {
        await updateMenu(statusLine)
      }
    }

    if (!result.ok) {
      await backToMenu(`⚠️ Çekiliş başlatılamadı: ${result.error}`)
      return true
    }

    const announcement = await sendTelegramMessage(
      session.groupId,
      `🎁 <b>Klasik Çekiliş Başladı!</b>\n\n🏆 Ödül: ${result.giveaway.prizeText}\n👥 Kazanan sayısı: ${winnerCount}\n⏱️ Süre: ${session.draftTitle} saat\n\nBelirlenen rastgele anlarda mesaj atan ilk kişi(ler) ödülü kazanır. Şansını dene, mesaj atmaya devam et!`
    )
    if (announcement?.message_id) {
      await pinChatMessage(session.groupId, announcement.message_id).catch(() => {})
    }
    await backToMenu('✅ Klasik çekiliş gruba duyuruldu!')
    return true
  }

  if (session.mode === 'awaiting_tag_message') {
    cleanupIncomingMessage()
    await prisma.botAdminSession.update({ where: { telegramId }, data: { mode: null } })
    if (!session.groupId) {
      await sendTelegramMessage(message.chat.id, '⚠️ Bir şeyler ters gitti, /panel yazıp yeniden dene.')
      return true
    }
    const menuChatId = session.menuChatId || message.chat.id
    const menuMessageId = session.menuMessageId ? Number(session.menuMessageId) : null

    const showStatus = async (text: string, keyboard?: any) => {
      if (menuMessageId) {
        await editTelegramMessage(menuChatId, menuMessageId, text, keyboard)
      } else {
        await sendTelegramMessage(message.chat.id, text, keyboard ? { keyboard } : undefined)
      }
    }

    await showStatus('🏷️ Etiketleme başladı, bu biraz sürebilir...', {
      inline_keyboard: [[{ text: '🛑 Durdur', callback_data: `admtag_stop:${session.groupId}` }]],
    })
    const result = await runTagging(session.groupId, text, { entities: message.entities || undefined })
    const group = await prisma.telegramGroup.findUnique({ where: { groupId: session.groupId } })
    const resultText = result.total === 0
      ? 'ℹ️ Etiketlenecek üye bulunamadı (grupta henüz mesaj atan kimse yok).'
      : `✅ Etiketleme ${result.stopped ? 'durduruldu' : 'tamamlandı'}!\n\n📨 Gönderilen: ${result.sent}/${result.total}`

    if (group) {
      const { text: menuText, reply_markup } = await buildGroupMenuMessage(group)
      await showStatus(`${resultText}\n\n${menuText}`, reply_markup)
    } else {
      await showStatus(resultText)
    }
    return true
  }


  return false
}
