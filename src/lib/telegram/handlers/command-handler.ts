import { NextResponse } from 'next/server'
import { handleStartCommand } from '../commands/start-command'
import { handleMeCommand } from '../commands/me-command'
import { handleLeaderboardCommand } from '../commands/leaderboard-command'
import { handleRollCommand } from './roll-handler'
import { handleAdminPanelCommand } from './admin-panel-handler'
import { handleRandyGroupCommand, handleNumberGroupCommand } from '../services/randy-quick-draft-service'
import { runTagging, stopTaggingRun } from '../services/tagging-service'
import { checkTelegramAdmin, sendTelegramMessage, deleteTelegramMessage } from '../core'

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
