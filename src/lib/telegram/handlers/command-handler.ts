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
    await sendTelegramMessage(
      chatId,
      'ℹ️ Kullanım: birinin mesajına reply yaparak ".inf" yaz, ya da ".inf 123456789" (ID) veya ".inf kullaniciadi" şeklinde kullan.'
    )
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
  }

  const [siteUser, randyParticipationCount, randyWinCount, classicWinCount] = await Promise.all([
    prisma.user.findUnique({ where: { telegramId: resolvedTelegramId }, include: { rank: true } }),
    prisma.randyParticipant.count({ where: { telegramId: resolvedTelegramId } }),
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
