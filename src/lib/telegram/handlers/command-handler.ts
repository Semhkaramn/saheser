import { NextResponse } from 'next/server'
import { handleStartCommand } from '../commands/start-command'
import { handleMeCommand } from '../commands/me-command'
import { handleLeaderboardCommand } from '../commands/leaderboard-command'
import { handleRollCommand } from './roll-handler'
import { handleAdminPanelCommand } from './admin-panel-handler'
import { handleRandyGroupCommand, handleNumberGroupCommand } from '../services/randy-quick-draft-service'
import { runTagging, stopTaggingRun } from '../services/tagging-service'
import { checkTelegramAdmin, sendTelegramMessage, deleteTelegramMessage } from '../core'
import { prisma } from '@/lib/prisma'
import { ISTATISTIK, formatMention } from '../taslaklar'
import { invalidateCache } from '@/lib/enhanced-cache'
import { logActivity } from '@/lib/services/activity-log-service'

/**
 * Komut handler (/ ile başlayan mesajlar)
 *
 * 🚀 ULTRA OPTIMIZATION:
 * - Activity group kontrolü WEBHOOK'ta yapılıyor (burada YOK)
 * - Filter sistemi KALDIRILDI
 *
 * @param message Telegram message objesi
 */
export async function handleCommand(message: any) {
  const text = message.text.trim()
  const command = text.split(' ')[0].toLowerCase()

  switch (command) {
    case '/start':
      return await handleStartCommand(message)

    // .me, !me, /me - kullanıcı istatistikleri
    case '.ben':
    case '!ben':
    case '/ben':
      return await handleMeCommand(message)

    // .günlük - Günlük mesaj sıralaması (sadece adminler)
    case '.günlük':
    case '.gunluk':
      return await handleLeaderboardCommand(message, 'daily')

    // .haftalık - Haftalık mesaj sıralaması (sadece adminler)
    case '.haftalık':
    case '.haftalik':
      return await handleLeaderboardCommand(message, 'weekly')

    // .aylık - Aylık mesaj sıralaması (sadece adminler)
    case '.aylık':
    case '.aylik':
      return await handleLeaderboardCommand(message, 'monthly')

    // .aktiflik - Çalışan aktiflik yarışmasının anlık sıralamasını gösterir
    // (yarışmayı BİTİRMEZ, sadece görüntüler) - sadece adminler
    case '.aktiflik': {
      if (message.chat.type !== 'group' && message.chat.type !== 'supergroup') {
        return NextResponse.json({ ok: true })
      }
      const isAdmin = await checkTelegramAdmin(message.chat.id, message.from.id)
      if (!isAdmin) return NextResponse.json({ ok: true })

      const { getActivityContestLeaderboard } = await import('../services/activity-rewards-service')
      const status = await getActivityContestLeaderboard(String(message.chat.id))
      const statusLabel = status.isRunning ? '🟢 Aktif' : status.hasData ? '🟡 Son Sıralama' : '⚪ Başlatılmadı'
      const lines = [
        `<b>🏆 Aktiflik Durumu</b>: ${statusLabel}`,
        status.startedAt ? `Başlama: ${new Date(status.startedAt).toLocaleString('tr-TR')}` : '',
        '',
      ]
      if (status.leaderboard.length === 0) {
        lines.push('Henüz veri yok.')
      } else {
        for (const row of status.leaderboard) {
          const name = row.firstName || row.username || row.telegramId
          const rewardText = row.reward ? ` — 🎁 ${row.reward}` : ''
          lines.push(`${row.rank}. ${name} — ${row.messageCount} mesaj${rewardText}`)
        }
      }
      await sendTelegramMessage(message.chat.id, lines.filter(Boolean).join('\n'))
      return NextResponse.json({ ok: true })
    }

    // .inf / !inf / /inf - admin bir kullanıcının istatistiğini görsün.
    // Üç şekilde kullanılabilir: birinin mesajına REPLY yaparak ".inf" yaz,
    // ".inf 123456789" (Telegram ID), ya da ".inf kullaniciadi" (TG kullanıcı adı).
    case '.inf':
    case '!inf':
    case '/inf':
      return await handleInfoCommand(message)

    // Roll komutları için roll handler'ı kullan
    case 'roll':
    case 'liste':
      return await handleRollCommand(message)

    // Bot admin paneli - sadece private chat'te anlamlı
    case '/panel':
      if (message.chat.type === 'private') {
        return await handleAdminPanelCommand(message)
      }
      return NextResponse.json({ ok: true })

    // Grupta hızlı Randy başlatma (randy-web mantığı): /randy mesaj bekler,
    // /number ile kazanan sayısı girilip canlıya alınır. Sadece grupta ve
    // sadece grup adminleri kullanabilir.
    case '/randy': {
      if (message.chat.type !== 'group' && message.chat.type !== 'supergroup') {
        return NextResponse.json({ ok: true })
      }
      const isAdmin = await checkTelegramAdmin(message.chat.id, message.from.id)
      const reply = await handleRandyGroupCommand(String(message.chat.id), isAdmin)
      if (reply) await sendTelegramMessage(message.chat.id, reply)
      // ✅ Komut mesajı grubu kirletmesin diye işlendikten sonra siliniyor
      await deleteTelegramMessage(message.chat.id, message.message_id).catch(() => {})
      return NextResponse.json({ ok: true })
    }

    case '/number': {
      if (message.chat.type !== 'group' && message.chat.type !== 'supergroup') {
        return NextResponse.json({ ok: true })
      }
      const isAdmin = await checkTelegramAdmin(message.chat.id, message.from.id)
      const reply = await handleNumberGroupCommand(String(message.chat.id), isAdmin, text)
      if (reply) await sendTelegramMessage(message.chat.id, reply)
      // ✅ Komut mesajı grubu kirletmesin diye işlendikten sonra siliniyor
      await deleteTelegramMessage(message.chat.id, message.message_id).catch(() => {})
      return NextResponse.json({ ok: true })
    }

    // /etiket <mesaj> - Bilinen tüm üyeleri 5'erli gruplar halinde etiketler
    // (hariç tutulanlar hariç). Premium emoji dahil biçimlendirme korunur.
    case '/etiket': {
      if (message.chat.type !== 'group' && message.chat.type !== 'supergroup') {
        return NextResponse.json({ ok: true })
      }
      const isAdmin = await checkTelegramAdmin(message.chat.id, message.from.id)
      if (!isAdmin) return NextResponse.json({ ok: true })

      const tagMessage = text.slice('/etiket'.length).trim()
      if (!tagMessage) {
        await sendTelegramMessage(message.chat.id, '📝 Kullanım: <code>/etiket mesajınız</code>\n\nÖrn: <code>/etiket Selam!</code>')
        return NextResponse.json({ ok: true })
      }
      runTagging(String(message.chat.id), tagMessage, { batchSize: 5, entities: message.entities || undefined })
        .then((r) => {
          if (r.total === 0) sendTelegramMessage(message.chat.id, 'ℹ️ Etiketlenecek üye bulunamadı.')
        })
        .catch(() => {})
      return NextResponse.json({ ok: true })
    }

    // /naber - Bilinen tüm üyeleri TEK TEK, her seferinde havuzdan rastgele
    // farklı bir ilgi çekici cümleyle etiketler (mesaj yazmana gerek yok).
    case '/naber': {
      if (message.chat.type !== 'group' && message.chat.type !== 'supergroup') {
        return NextResponse.json({ ok: true })
      }
      const isAdmin = await checkTelegramAdmin(message.chat.id, message.from.id)
      if (!isAdmin) return NextResponse.json({ ok: true })

      runTagging(String(message.chat.id), null, { batchSize: 1, useRandomPhrasePool: true })
        .then((r) => {
          if (r.total === 0) sendTelegramMessage(message.chat.id, 'ℹ️ Etiketlenecek üye bulunamadı.')
        })
        .catch(() => {})
      return NextResponse.json({ ok: true })
    }

    // /ekle <miktar> (reply ile) veya /ekle <@kullanici|id> <miktar> - puan ekler
    case '/ekle':
      return await handlePointsAdjustCommand(message, text, 'add')

    // /sil <miktar> (reply ile) veya /sil <@kullanici|id> <miktar> - puan siler
    case '/sil':
      return await handlePointsAdjustCommand(message, text, 'remove')

    // /dur - Çalışan /etiket veya /naber işlemini durdurur
    case '/dur': {
      if (message.chat.type !== 'group' && message.chat.type !== 'supergroup') {
        return NextResponse.json({ ok: true })
      }
      const isAdmin = await checkTelegramAdmin(message.chat.id, message.from.id)
      if (!isAdmin) return NextResponse.json({ ok: true })

      await stopTaggingRun(String(message.chat.id))
      await sendTelegramMessage(message.chat.id, '⏹️ Etiketleme durduruldu.')
      return NextResponse.json({ ok: true })
    }

    default:
      // Bilinmeyen komut - sessiz kal
      return NextResponse.json({ ok: true })
  }
}

/**
 * .inf / !inf / /inf komutu - SADECE adminler kullanabilir. Bir üyenin
 * istatistiğini üç şekilde görebilir:
 * 1) Birinin mesajına REPLY yaparak ".inf" yaz
 * 2) ".inf 123456789" (Telegram ID)
 * 3) ".inf kullaniciadi" (Telegram kullanıcı adı, @ olsun olmasın fark etmez)
 */
async function handleInfoCommand(message: any) {
  const chatId = message.chat.id
  const chatType = message.chat.type

  if (chatType !== 'group' && chatType !== 'supergroup') {
    return NextResponse.json({ ok: true })
  }

  const isAdmin = await checkTelegramAdmin(chatId, message.from.id)
  if (!isAdmin) return NextResponse.json({ ok: true })

  const text = String(message.text || '').trim()
  const argument = text.split(/\s+/).slice(1).join(' ').replace(/^@/, '').trim()

  let targetTelegramId: string | null = null
  let targetUsername: string | null = null
  let targetFirstName: string | null = null

  if (message.reply_to_message?.from) {
    targetTelegramId = String(message.reply_to_message.from.id)
    targetUsername = message.reply_to_message.from.username || null
    targetFirstName = message.reply_to_message.from.first_name || null
  } else if (argument) {
    if (/^\d+$/.test(argument)) {
      targetTelegramId = argument
    } else {
      targetUsername = argument
    }
  }

  if (!targetTelegramId && !targetUsername) {
    return NextResponse.json({ ok: true })
  }

  const telegramUser = await prisma.telegramGroupUser.findFirst({
    where: targetTelegramId ? { telegramId: targetTelegramId } : { username: { equals: targetUsername!, mode: 'insensitive' } },
  })

  if (!telegramUser) {
    await sendTelegramMessage(chatId, '❌ Bu kullanıcı için hiç kayıt bulunamadı (hiç mesaj atmamış olabilir).')
    return NextResponse.json({ ok: true })
  }

  const resolvedTelegramId = telegramUser.telegramId
  const firstName = targetFirstName || telegramUser.firstName || 'Kullanıcı'

  const stats = {
    dailyMessageCount: telegramUser.dailyMessageCount,
    weeklyMessageCount: telegramUser.weeklyMessageCount,
    monthlyMessageCount: telegramUser.monthlyMessageCount,
    messageCount: telegramUser.messageCount,
      stickerCount: telegramUser.stickerCount,
      gifCount: telegramUser.gifCount,
      photoCount: telegramUser.photoCount,
      videoCount: telegramUser.videoCount,
      voiceCount: telegramUser.voiceCount,
      documentCount: telegramUser.documentCount,
  }

  const [siteUser, randyParticipationCount, randyWinCount, classicWinCount] = await Promise.all([
    prisma.user.findUnique({ where: { telegramId: resolvedTelegramId }, include: { rank: true } }),
    prisma.randyParticipant.count({
      where: {
        telegramId: resolvedTelegramId,
        OR: [{ username: { not: null } }, { firstName: { not: null } }],
      },
    }),
    prisma.randyWinner.count({ where: { telegramId: resolvedTelegramId } }),
    prisma.classicGiveawayWinTime.count({ where: { winnerTelegramId: resolvedTelegramId } }),
  ])

  const siteStats = siteUser
    ? {
        points: siteUser.points,
        xp: siteUser.xp,
        rankName: siteUser.rank?.name || null,
        dailySpinsLeft: siteUser.dailySpinsLeft,
        isBanned: siteUser.isBanned,
      }
    : null

  const randyStats = { participated: randyParticipationCount, won: randyWinCount }

  const mention = formatMention(resolvedTelegramId, telegramUser.username, firstName)
  let text2 = `${mention}\n\n${ISTATISTIK.FORMAT(firstName, stats, siteStats, randyStats)}`
  text2 += `\n\n<b>🎲 Klasik Çekiliş</b>\n🏆 Kazandığı: ${classicWinCount}`

  await sendTelegramMessage(chatId, text2)
  return NextResponse.json({ ok: true })
}

/**
 * /ekle ve /sil komutları - SADECE grup adminleri kullanabilir. Bir üyeye
 * puan eklemek/silmek için üç kullanım şekli desteklenir:
 * 1) Üyenin mesajına REPLY yapıp "/ekle 1000" ya da "/sil 1000" yazmak
 * 2) "/ekle @kullaniciadi 1000" (Telegram kullanıcı adı, @ olsun olmasın)
 * 3) "/ekle 123456789 1000" (Telegram ID)
 */
async function handlePointsAdjustCommand(message: any, text: string, mode: 'add' | 'remove') {
  const chatId = message.chat.id
  const chatType = message.chat.type

  if (chatType !== 'group' && chatType !== 'supergroup') {
    return NextResponse.json({ ok: true })
  }

  const isAdmin = await checkTelegramAdmin(chatId, message.from.id)
  if (!isAdmin) return NextResponse.json({ ok: true })

  // 🛡️ IDEMPOTENCY FIX: Telegram bazen aynı update'i webhook'a birden fazla
  // kez gönderiyor (yanıt gecikirse ya da ağ sorunu olursa yeniden dener).
  // Bu daha önce "puan aynı kalıyor" gibi görünen sorunların asıl nedeniydi:
  // aynı /ekle ya da /sil komutu iki kez işlenip biri diğerini geri alıyordu
  // gibi görünüyordu. Aynı mesaj (chatId + message_id) daha önce işlendiyse
  // artık burada durdurulur, ikinci kez puan eklenip/silinmez.
  const dedupeKey = `tgcmd:${chatId}:${message.message_id}`
  const alreadyProcessed = await prisma.pointHistory.findFirst({ where: { relatedId: dedupeKey } })
  if (alreadyProcessed) {
    return NextResponse.json({ ok: true })
  }

  const args = text.split(/\s+/).slice(1).filter(Boolean)
  const usage = mode === 'add'
    ? '📝 Kullanım:\n• Birine reply yapıp <code>/ekle 1000</code>\n• <code>/ekle @kullaniciadi 1000</code>\n• <code>/ekle 123456789 1000</code>'
    : '📝 Kullanım:\n• Birine reply yapıp <code>/sil 1000</code>\n• <code>/sil @kullaniciadi 1000</code>\n• <code>/sil 123456789 1000</code>'

  let targetTelegramId: string | null = null
  let targetUsername: string | null = null
  let targetFirstName: string | null = null
  let amountStr: string | null = null

  if (message.reply_to_message?.from) {
    targetTelegramId = String(message.reply_to_message.from.id)
    targetUsername = message.reply_to_message.from.username || null
    targetFirstName = message.reply_to_message.from.first_name || null
    amountStr = args[0] || null
  } else if (args.length >= 2) {
    const rawTarget = args[0].replace(/^@/, '').trim()
    if (/^\d+$/.test(rawTarget)) {
      targetTelegramId = rawTarget
    } else {
      targetUsername = rawTarget
    }
    amountStr = args[1] || null
  }

  if (!amountStr || (!targetTelegramId && !targetUsername)) {
    await sendTelegramMessage(chatId, usage)
    return NextResponse.json({ ok: true })
  }

  const amount = parseInt(amountStr.replace(/\D/g, ''), 10)
  if (!Number.isFinite(amount) || amount <= 0) {
    await sendTelegramMessage(chatId, usage)
    return NextResponse.json({ ok: true })
  }

  // Hedef üyeyi bul (önce TelegramGroupUser üzerinden gerçek telegramId'ye ulaş)
  const telegramGroupUser = await prisma.telegramGroupUser.findFirst({
    where: targetTelegramId ? { telegramId: targetTelegramId } : { username: { equals: targetUsername!, mode: 'insensitive' } },
  })

  const resolvedTelegramId = telegramGroupUser?.telegramId || targetTelegramId
  if (!resolvedTelegramId) {
    await sendTelegramMessage(chatId, '❌ Bu kullanıcı için hiç kayıt bulunamadı (hiç mesaj atmamış olabilir).')
    return NextResponse.json({ ok: true })
  }

  const siteUser = await prisma.user.findUnique({ where: { telegramId: resolvedTelegramId } })
  if (!siteUser) {
    await sendTelegramMessage(chatId, '❌ Bu kullanıcı sitede kayıtlı değil, puan eklenemez/silinemez.')
    return NextResponse.json({ ok: true })
  }

  const firstName = targetFirstName || telegramGroupUser?.firstName || siteUser.firstName || 'Kullanıcı'
  const displayName = targetUsername || telegramGroupUser?.username || siteUser.telegramUsername
    ? `@${targetUsername || telegramGroupUser?.username || siteUser.telegramUsername}`
    : firstName

  const balanceBefore = siteUser.points
  const delta = mode === 'add' ? amount : -Math.min(amount, balanceBefore)
  const balanceAfter = balanceBefore + delta

  const updatedUser = await prisma.user.update({
    where: { id: siteUser.id },
    data: { points: { increment: delta } },
  })

  await prisma.pointHistory.create({
    data: {
      userId: siteUser.id,
      amount: delta,
      type: mode === 'add' ? 'admin_add' : 'admin_remove',
      description: mode === 'add'
        ? `Grup admini tarafından ${delta} puan eklendi (Telegram komutu)`
        : `Grup admini tarafından ${Math.abs(delta)} puan silindi (Telegram komutu)`,
      relatedId: dedupeKey,
      adminUsername: message.from.username ? `@${message.from.username}` : (message.from.first_name || 'Admin'),
      balanceBefore,
      balanceAfter,
    },
  })

  await logActivity({
    userId: siteUser.id,
    actionType: mode === 'add' ? 'admin_points_add' : 'admin_points_remove',
    actionTitle: mode === 'add' ? `Admin ${delta} puan ekledi` : `Admin ${Math.abs(delta)} puan sildi`,
    actionDescription: `Telegram grup komutu ile (${message.from.username ? `@${message.from.username}` : message.from.first_name || 'Admin'})`,
    oldValue: String(balanceBefore),
    newValue: String(balanceAfter),
    metadata: { chatId: String(chatId), viaCommand: mode === 'add' ? '/ekle' : '/sil' },
  }).catch(() => {})

  invalidateCache.leaderboard()

  const emoji = mode === 'add' ? '✅' : '🗑️'
  const verb = mode === 'add' ? 'eklendi' : 'silindi'
  const yon = mode === 'add' ? 'üyeye' : 'üyeden'
  await sendTelegramMessage(
    chatId,
    `${emoji} ${displayName} adlı ${yon} <b>${Math.abs(delta)}</b> puan ${verb}.\n📊 Önceki bakiye: ${balanceBefore} → Yeni bakiye: <b>${updatedUser.points}</b> puan`
  )
  return NextResponse.json({ ok: true })
}
