import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendTelegramMessage, checkTelegramAdmin } from '../core'
import { getDynamicSettings } from '@/lib/site-config'
import {
  getRollState,
  startRoll,
  saveStep,
  startBreak,
  resumeRoll,
  stopRoll,
  getStatusList,
  getStepList,
  lockRoll,
  unlockRoll
} from '@/lib/roll-system'
import { ROLL } from '../taslaklar'
import { isAnonymousAdmin, canAnonymousAdminUseCommands, isTelegramServiceAccount } from '../utils/anonymous-admin'

/**
 * Roll sistemi komutları handler
 *
 * 🚀 ULTRA OPTIMIZATION:
 * - Activity group kontrolü WEBHOOK'ta yapılıyor (burada YOK)
 *
 * 🔒 ANONİM ADMİN DESTEĞİ:
 * - Anonim adminler (GroupAnonymousBot) komut kullanabilir
 * - sender_chat üzerinden admin yetkisi kontrol edilir
 *
 * @param message Telegram message objesi
 */
export async function handleRollCommand(message: any) {
  const chatId = message.chat.id
  const chatType = message.chat.type
  const messageText = message.text.trim()

  // 🔒 SİSTEM HESAPLARI KONTROLÜ

  // 1️⃣ Telegram Servis Hesabı (bağlı kanal - ID: 777000)
  // Bu hesaptan gelen roll komutlarını yoksay
  if (isTelegramServiceAccount(message)) {
    console.log(`📢 Telegram servis hesabından roll komutu - yoksayıldı`)
    return NextResponse.json({ ok: true })
  }

  // 2️⃣ Anonim Admin (GroupAnonymousBot - ID: 1087968824)
  const isAnonymous = isAnonymousAdmin(message)
  const userId = isAnonymous ? null : String(message.from.id)

  // Sadece grup/supergroup'ta çalışır
  if (chatType !== 'group' && chatType !== 'supergroup') {
    return NextResponse.json({ ok: true })
  }

  const groupId = String(chatId)
  const text = messageText.trim()

  // Roll aktif mi kontrolü (DB'den cached)
  const settings = await getDynamicSettings()
  const rollEnabled = settings.rollEnabled ?? true

  if (!rollEnabled) {
    // Roll sistemi devre dışı - komutları ignore et
    return NextResponse.json({ ok: true })
  }

  // Büyük/küçük harf duyarsız kontrol için
  const lowerText = text.toLowerCase()

  /**
   * 🔒 Admin kontrolü helper fonksiyonu
   * Anonim adminler için sender_chat kontrolü yapar
   */
  const checkIsAdmin = async (): Promise<boolean> => {
    // Anonim admin ise ve aynı gruptan mesaj gönderiyorsa admin kabul et
    if (isAnonymous) {
      return canAnonymousAdminUseCommands(message)
    }
    // Normal kullanıcı için Telegram API kontrolü
    return userId ? await checkTelegramAdmin(chatId, Number(userId)) : false
  }

  // "liste" komutu - Sadece adminler kullanabilir
  if (lowerText === 'liste') {
    const isAdmin = await checkIsAdmin()
    if (!isAdmin) return NextResponse.json({ ok: true })

    const statusMsg = await getStatusList(groupId)
    await sendTelegramMessage(chatId, statusMsg)
    return NextResponse.json({ ok: true })
  }

  // Roll komutları - Sadece adminler (büyük/küçük harf duyarsız)
  if (lowerText.startsWith('roll ') || lowerText === 'roll') {
    const isAdmin = await checkIsAdmin()

    const parts = lowerText.split(' ')

    if (parts.length === 1) {
      // Sadece "roll" yazılmış - sessiz kal
      return NextResponse.json({ ok: true })
    }

    // Komut zaten lowerText'ten geldiği için tekrar toLowerCase() gerekmez
    const command = parts.slice(1).join(' ')

    // roll <sayı> - Roll başlat
    if (/^\d+$/.test(command)) {
      if (!isAdmin) return NextResponse.json({ ok: true })

      const duration = Number.parseInt(command)
      await startRoll(groupId, duration)

      await sendTelegramMessage(chatId, ROLL.BASLADI(duration))
      return NextResponse.json({ ok: true })
    }

    // roll adım - Adım kaydet ve duraklat
    if (command === 'adım' || command === 'adim') {
      if (!isAdmin) return NextResponse.json({ ok: true })

      const result = await saveStep(groupId)

      if (!result.success) {
        await sendTelegramMessage(chatId, result.message)
        return NextResponse.json({ ok: true })
      }

      const stepList = await getStepList(groupId)
      await sendTelegramMessage(chatId, ROLL.ADIM_KAYDEDILDI(result.stepNumber, stepList))
      return NextResponse.json({ ok: true })
    }

    // roll mola - Mola başlat
    if (command === 'mola') {
      if (!isAdmin) return NextResponse.json({ ok: true })

      const state = await getRollState(groupId)

      if (state.status === 'stopped') {
        await sendTelegramMessage(chatId, ROLL.MOLA_BASLATILMAZ)
        return NextResponse.json({ ok: true })
      }

      if (state.status === 'break' || state.status === 'locked_break') {
        await sendTelegramMessage(chatId, ROLL.ZATEN_MOLADA)
        return NextResponse.json({ ok: true })
      }

      // Kilitli durumda mola başlatılırsa özel mesaj
      const wasLocked = state.status === 'locked'

      await startBreak(groupId)

      if (wasLocked) {
        await sendTelegramMessage(chatId, ROLL.MOLA_BASLADI_KILITLI)
      } else {
        await sendTelegramMessage(chatId, ROLL.MOLA_BASLADI)
      }
      return NextResponse.json({ ok: true })
    }

    // roll devam - Moladan devam et
    if (command === 'devam') {
      if (!isAdmin) return NextResponse.json({ ok: true })

      const state = await getRollState(groupId)

      if (state.status !== 'break' && state.status !== 'paused' && state.status !== 'locked_break') {
        await sendTelegramMessage(chatId, ROLL.MOLA_YOK)
        return NextResponse.json({ ok: true })
      }

      // locked_break durumunda devam edilirse kilit devam eder
      const wasLockedBreak = state.status === 'locked_break'

      const returnedStatus = await resumeRoll(groupId)

      if (wasLockedBreak || returnedStatus === 'locked') {
        await sendTelegramMessage(chatId, ROLL.DEVAM_EDIYOR_KILITLI(state.activeDuration))
      } else {
        await sendTelegramMessage(chatId, ROLL.DEVAM_EDIYOR(state.activeDuration))
      }
      return NextResponse.json({ ok: true })
    }

    // roll kilit - Roll'u kilitle
    if (command === 'kilit') {
      if (!isAdmin) return NextResponse.json({ ok: true })

      const state = await getRollState(groupId)

      if (state.status === 'stopped') {
        await sendTelegramMessage(chatId, ROLL.ROLL_AKTIF_DEGIL)
        return NextResponse.json({ ok: true })
      }

      if (state.status === 'locked' || state.status === 'locked_break') {
        await sendTelegramMessage(chatId, ROLL.ZATEN_KILITLI)
        return NextResponse.json({ ok: true })
      }

      // Molada kilit başlatılırsa özel mesaj
      const wasBreak = state.status === 'break'

      await lockRoll(groupId)

      if (wasBreak) {
        await sendTelegramMessage(chatId, ROLL.KILITLENDI_MOLADA)
      } else {
        await sendTelegramMessage(chatId, ROLL.KILITLENDI)
      }
      return NextResponse.json({ ok: true })
    }

    // roll aç - Roll kilidini aç
    if (command === 'aç' || command === 'ac') {
      if (!isAdmin) return NextResponse.json({ ok: true })

      const state = await getRollState(groupId)

      if (state.status !== 'locked' && state.status !== 'locked_break') {
        await sendTelegramMessage(chatId, ROLL.KILITLI_DEGIL)
        return NextResponse.json({ ok: true })
      }

      const previousStatus = await unlockRoll(groupId)
      await sendTelegramMessage(chatId, ROLL.KILIT_ACILDI(previousStatus || 'active'))
      return NextResponse.json({ ok: true })
    }

    // roll bitir - Roll'u sonlandır
    if (command === 'bitir') {
      if (!isAdmin) return NextResponse.json({ ok: true })

      const state = await getRollState(groupId)

      if (state.status === 'stopped') {
        await sendTelegramMessage(chatId, ROLL.ZATEN_DURDURULMUS)
        return NextResponse.json({ ok: true })
      }

      const stepList = await getStepList(groupId)
      await stopRoll(groupId)
      await sendTelegramMessage(chatId, ROLL.SONLANDIRILDI(stepList))
      return NextResponse.json({ ok: true })
    }

    // Bilinmeyen roll komutu
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ ok: true })
}
