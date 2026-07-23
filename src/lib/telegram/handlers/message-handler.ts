import { NextResponse } from 'next/server'
import { checkUserBan } from '../utils/ban-check'
import { processMessageReward } from '@/lib/services/points-service'
import { getRollState } from '@/lib/roll-system'
import { trackUserMessage } from '@/lib/roll-system'
import { prisma } from '@/lib/prisma'
import { getRedisClient } from '../utils/redis-client'
import { RANDY, formatWinnerList } from '../taslaklar'
import { isAnonymousAdmin, canAnonymousAdminUseCommands, isSystemMessage, isTelegramServiceAccount } from '../utils/anonymous-admin'
import { handlePendingAdminMessage } from './admin-panel-handler'
import { SiteConfig } from '@/lib/site-config'
import { checkAndAwardClassicWinner } from '../services/classic-giveaway-service'
import { maybeSendGptReply } from '../services/gpt-service'
import { trackActivityContestMessage } from '../services/activity-rewards-service'
import { sendTelegramMessage, pinChatMessage, checkTelegramAdmin as checkTgAdmin, setChatPermissions } from '../core'

// Randy cache için singleton - null durumunu da cache'le
let activeRandyCache: { id: string; targetGroupId: string; timestamp: number } | { isNull: true; timestamp: number } | null = null
const RANDY_CACHE_TTL = 300000 // 🚀 OPTIMIZATION: 300 saniye (5 dakika)

/**
 * Aktif Randy'yi cache ile al (targetGroupId ile birlikte)
 * 🚀 OPTIMIZATION: Memory cache'te null durumunu da sakla - gereksiz Redis yazımını önle
 */
async function getActiveRandyWithCache(): Promise<{ id: string; targetGroupId: string } | null> {
  const redis = getRedisClient()
  const now = Date.now()

  // Memory cache kontrolü (null durumu dahil)
  if (activeRandyCache && now - activeRandyCache.timestamp < RANDY_CACHE_TTL) {
    if ('isNull' in activeRandyCache) {
      return null // Memory cache'te null var
    }
    return { id: activeRandyCache.id, targetGroupId: activeRandyCache.targetGroupId }
  }

  // Redis cache kontrolü
  if (redis) {
    try {
      const cached = await redis.get<string>('active_randy_post_messages')
      if (cached && cached !== 'null') {
        try {
          const parsedCache = JSON.parse(cached)
          activeRandyCache = { ...parsedCache, timestamp: now }
          return { id: parsedCache.id, targetGroupId: parsedCache.targetGroupId }
        } catch {
          // Eski format (sadece ID), yeni formata geçiş için cache'i temizle
          await redis.del('active_randy_post_messages')
        }
      }
      if (cached === 'null') {
        // 🚀 FIX: Memory cache'e de null kaydet - bir sonraki request'te Redis'e gitme
        activeRandyCache = { isNull: true, timestamp: now }
        return null
      }
    } catch (error) {
      console.warn('Redis cache error in Randy check:', error)
    }
  }

  // DB'den çek
  const activeRandy = await prisma.randy.findFirst({
    where: {
      status: 'active',
      requirementType: 'post_randy_messages'
    },
    select: { id: true, targetGroupId: true }
  })

  if (!activeRandy) {
    // 🚀 FIX: Memory cache'e null kaydet
    activeRandyCache = { isNull: true, timestamp: now }
    // Redis'e null kaydet (300 saniye - 5 dakika)
    if (redis) {
      try {
        await redis.setex('active_randy_post_messages', 300, 'null')
      } catch (error) {
        console.warn('Failed to cache Randy status:', error)
      }
    }
    return null
  }

  // Cache'le (300 saniye - 5 dakika)
  const cacheData = { id: activeRandy.id, targetGroupId: activeRandy.targetGroupId }
  activeRandyCache = { ...cacheData, timestamp: now }
  if (redis) {
    try {
      await redis.setex('active_randy_post_messages', 300, JSON.stringify(cacheData))
    } catch (error) {
      console.warn('Failed to cache Randy:', error)
    }
  }

  return activeRandy
}

/**
 * Randy cache'ini temizle (admin Randy start/end yaptığında)
 */
export async function invalidateRandyCache(): Promise<void> {
  const redis = getRedisClient()
  // Memory cache'i temizle (null dahil tüm durumlar)
  activeRandyCache = null
  if (redis) {
    try {
      await redis.del('active_randy_post_messages')
    } catch (error) {
      console.warn('Failed to invalidate Randy cache:', error)
    }
  }
}

/**
 * Randy sonrası mesaj tracking (cache ile optimize edilmiş)
 * ✅ Sadece Randy'nin targetGroupId'sinde mesaj yazarsa sayılır
 */
async function trackRandyPostMessage(
  userId: string,
  username: string | null,
  firstName: string | null,
  lastName: string | null,
  chatId: string
) {
  try {
    // Aktif Randy var mı kontrol et (cache'den)
    const activeRandy = await getActiveRandyWithCache()

    if (!activeRandy) {
      return
    }

    // ✅ CRITICAL: Randy'nin targetGroupId'si ile chatId eşleşmiyorsa mesaj sayma!
    // Randy aktif grupta değilse mesaj şartı olmaz
    // Not: replace kullanarak tüm - karakterlerini kaldır ve mutlak değer karşılaştırması yap
    const normalizedChatId = chatId.replace(/-/g, '')
    const normalizedTargetGroupId = activeRandy.targetGroupId.replace(/-/g, '')

    if (normalizedChatId !== normalizedTargetGroupId) {
      console.log(`⏭️ Randy mesaj sayılmadı - Farklı grup: chatId=${chatId} (${normalizedChatId}), targetGroupId=${activeRandy.targetGroupId} (${normalizedTargetGroupId})`)
      return // Farklı grup - mesaj sayılmaz
    }

    console.log(`📝 Randy mesaj tracking: userId=${userId}, chatId=${chatId}, randyId=${activeRandy.id}`)

    // Kullanıcı bu Randy için kayıt var mı?
    const participant = await prisma.randyParticipant.findUnique({
      where: {
        randyId_telegramId: {
          randyId: activeRandy.id,
          telegramId: userId
        }
      }
    })

    if (participant) {
      // Zaten kayıt var, mesaj sayısını artır
      const updated = await prisma.randyParticipant.update({
        where: {
          randyId_telegramId: {
            randyId: activeRandy.id,
            telegramId: userId
          }
        },
        data: {
          postRandyMessageCount: {
            increment: 1
          }
        }
      })
      console.log(`✅ Randy mesaj sayısı artırıldı: userId=${userId}, yeni sayı=${updated.postRandyMessageCount}`)
    } else {
      // Kayıt yok, oluştur (sadece mesaj tracking için, kullanıcı bilgileri NULL)
      // Kullanıcı butona basınca bilgiler doldurulacak
      await prisma.randyParticipant.create({
        data: {
          randyId: activeRandy.id,
          telegramId: userId,
          username: null,  // NULL = sadece tracking için
          firstName: null, // NULL = sadece tracking için
          lastName: null,
          postRandyMessageCount: 1
        }
      })
      console.log(`✅ Randy yeni katılımcı oluşturuldu: userId=${userId}, mesaj sayısı=1`)
    }
  } catch (error) {
    console.error('Randy mesaj tracking hatası:', error)
  }
}

/**
 * Admin Reply ile Randy Sonlandırma Kontrolü
 */
async function checkAdminRandyEnd(message: any, chatType: string, userId: string | null): Promise<boolean> {
  if (!message.reply_to_message) {
    return false
  }

  const repliedMessageId = message.reply_to_message.message_id
  const chatId = message.chat.id

  console.log(`🔍 Checking reply to message ${repliedMessageId} in ${chatType}`)

  // Bu mesaj bir Randy mesajına reply mi?
  const randy = await prisma.randy.findFirst({
    where: {
      messageId: repliedMessageId,
      status: 'active'
    },
    include: {
      participants: true
    }
  })

  if (!randy) {
    return false
  }

  console.log(`✅ Found Randy ${randy.id} for reply, checking admin status...`)

  let isAdmin = false

  // Kanal tip kontrolü - duyuru kanallarında özel durum
  if (chatType === 'channel') {
    // Duyuru kanallarında getChatMember çalışmayabilir
    // chatId ile randy.targetGroupId eşleşiyorsa ve kanal sahibi/admin mesaj gönderebiliyorsa admin kabul et
    console.log(`📢 Channel detected - targetGroupId: ${randy.targetGroupId}, chatId: ${chatId}`)
    isAdmin = String(chatId) === randy.targetGroupId
  } else if (userId) {
    // Normal grup/supergroup için admin kontrolü (userId olmalı)
    const { checkTelegramAdmin } = await import('@/lib/telegram/core')
    isAdmin = await checkTelegramAdmin(Number(chatId), Number(userId))
  }

  console.log(`👤 User ${userId || 'channel'} admin status: ${isAdmin} (chatType: ${chatType})`)

  if (!isAdmin) {
    return false
  }

  console.log(`🎯 Admin ${userId || 'channel'} is ending Randy ${randy.id} via reply`)

  // ✅ FIX: Artık kendi (eski, hatalı) sonlandırma mantığını tekrar etmiyor -
  // merkezi endRandy() fonksiyonunu çağırıyor. Eskiden burada AYRI bir kopya
  // kod vardı ve o kopyada iki bloklayıcı hata vardı: (1) hiç katılımcı
  // yoksa sessizce hiçbir şey yapmıyordu, (2) katılımcı sayısı ayarlanan
  // kazanan sayısından azsa YİNE hiçbir şey yapmıyordu ("adminler ne yazarsa
  // yazsın bitirebilmeli" isteğinin karşılanamamasının sebebi buydu). Artık
  // merkezi fonksiyon her durumda (0 katılımcı dahil) düzgün çalışıyor.
  const { endRandy } = await import('@/lib/telegram/services/randy-bot-service')
  await endRandy(randy.id)

  return true
}


/**
 * Normal mesaj handler (puan kazanma sistemi)
 *
 * 🚀 ULTRA OPTIMIZATION:
 * - Activity group kontrolü WEBHOOK'ta yapılıyor (burada YOK)
 * - Filter sistemi KALDIRILDI
 * - Tüm kontroller PARALEL
 *
 * 🔒 ANONİM ADMİN DESTEĞİ:
 * - Anonim adminler (GroupAnonymousBot) veritabanına kaydedilmez
 * - Anonim adminler puan kazanmaz
 * - Anonim adminler roll listesine eklenmez
 *
 * @param message Telegram message objesi
 */
export async function handleMessage(message: any) {
  const chatId = message.chat.id
  const chatType = message.chat.type
  const messageText = message.text || ''
  // ⚠️ FIX: Eskiden SADECE düz yazı mesajları sayılıyordu - biri sticker,
  // GIF, foto, video ya da sesli mesaj atarsa (yazı eklemeden) hiç
  // puan/mesaj sayımına girmiyordu. Bunları da geçerli bir mesaj olarak
  // sayıyoruz - "uzunluk" ölçülemeyeceği için ayrı bir bayrakla işaretliyoruz.
  const isMediaMessage = !!(
    message.sticker || message.animation || message.photo || message.video ||
    message.voice || message.video_note || message.document || message.audio
  )

  // 🤖 BOT ADMİN PANELİ - private chat'te bekleyen bir mod varsa (toplu mesaj
  // yazımı, Randy mesajı/kazanan sayısı) önce onu işle, normal akışa girme
  if (chatType === 'private') {
    const handled = await handlePendingAdminMessage(message)
    if (handled) {
      return NextResponse.json({ ok: true })
    }
  }

  // 🔒 SİSTEM MESAJI KONTROLÜ - En başta yap
  // Telegram servis hesabı (777000), anonim adminler ve kanal mesajları
  // Bunlar puan kazanmaz, roll listesine eklenmez, veritabanına kaydedilmez

  // 1️⃣ Telegram Servis Hesabı (bağlı kanallardan gelen mesajlar)
  // Bu hesap "Telegram" adıyla görünür - ID: 777000
  if (isTelegramServiceAccount(message)) {
    console.log(`📢 Telegram servis hesabı mesajı tespit edildi (bağlı kanal) - chatId=${chatId}, from.first_name=${message.from?.first_name}`)
    // Bağlı kanal mesajları - puan, roll, mesaj sayısı YOK
    return NextResponse.json({ ok: true })
  }

  // 2️⃣ Anonim Admin Kontrolü (GroupAnonymousBot - ID: 1087968824)
  if (isAnonymousAdmin(message)) {
    console.log(`👤 Anonim admin mesajı tespit edildi - chatId=${chatId}, sender_chat=${message.sender_chat?.title || message.sender_chat?.id}`)
    // Sadece admin Randy end kontrolü yap (anonim admin de Randy sonlandırabilir)
    if (canAnonymousAdminUseCommands(message)) {
      const adminRandyEnded = await checkAdminRandyEnd(message, chatType, null)
      if (adminRandyEnded) {
        return NextResponse.json({ ok: true })
      }
    }
    // Anonim admin - puan, roll, mesaj sayısı YOK
    return NextResponse.json({ ok: true })
  }

  // 3️⃣ Kanal Adına Gönderilen Mesajlar (sender_chat var ama anonim admin değil)
  // Örn: Duyuru kanalından reply yapılarak Randy bitirme
  if (message.sender_chat) {
    console.log(`📣 Kanal mesajı tespit edildi - chatId=${chatId}, sender_chat=${message.sender_chat?.title || message.sender_chat?.id}`)

    // ✅ Kanal adına yapılan reply ile Randy bitirme kontrolü
    // Kanal admini kanaldan reply yaparak Randy bitirebilir
    if (message.reply_to_message) {
      console.log(`📣 Kanal reply mesajı - Randy end kontrolü yapılıyor`)
      const adminRandyEnded = await checkAdminRandyEnd(message, chatType, null)
      if (adminRandyEnded) {
        return NextResponse.json({ ok: true })
      }
    }

    // Kanal mesajları - puan, roll, mesaj sayısı YOK
    return NextResponse.json({ ok: true })
  }

  const userId = message.from?.id ? String(message.from.id) : null

  console.log(
    `📨 Message from ${userId} in ${chatType} chat (${chatId}): "${messageText.substring(0, 50)}"`
  )

  // Kanallarda from alanı olmayabilir
  if (!userId && chatType !== 'channel') {
    return NextResponse.json({ ok: true })
  }

  // 🌙☀️ "İyi geceler Harley" / "Günaydın Harley" - SADECE adminler grubun
  // tüm mesaj/medya/sticker izinlerini açıp kapatabilir. Admin değilse hiçbir
  // tepki verilmez (sessizce yok sayılır) - normal üye yazarsa hiçbir şey
  // olmamalı.
  if ((chatType === 'group' || chatType === 'supergroup') && userId) {
    // Büyük/küçük harf farkı hiç önemli değil (Türkçe kurallarına göre küçük
    // harfe çevriliyor), fazladan boşluk/ünlem gibi ufak farklar da sorun
    // olmasın diye normalize ediyoruz.
    const normalized = messageText
      .trim()
      .toLocaleLowerCase('tr')
      .replace(/\s+/g, ' ')
      .replace(/[!.?]+$/, '')
    const isGoodNight = normalized === 'iyi geceler harley'
    const isGoodMorning = normalized === 'günaydın harley' || normalized === 'gunaydin harley'

    if (isGoodNight || isGoodMorning) {
      const isAdmin = await checkTgAdmin(Number(chatId), Number(userId))
      if (isAdmin) {
        if (isGoodNight) {
          // Tüm izinler kapansın - hiç kimse (admin hariç) mesaj/medya/sticker
          // gönderemesin.
          await setChatPermissions(chatId, {
            can_send_messages: false,
            can_send_audios: false,
            can_send_documents: false,
            can_send_photos: false,
            can_send_videos: false,
            can_send_video_notes: false,
            can_send_voice_notes: false,
            can_send_polls: false,
            can_send_other_messages: false,
            can_add_web_page_previews: false,
            can_react_to_messages: true,
          })
          await sendTelegramMessage(chatId, '🌙 Sohbet kapandı.')
        } else {
          // Sadece mesaj + gif/sticker (can_send_other_messages kapsıyor) açık,
          // gerisi (belge, ses, anket vb.) kapalı kalıyor.
          await setChatPermissions(chatId, {
            can_send_messages: true,
            can_send_other_messages: true,
            can_send_audios: false,
            can_send_documents: false,
            can_send_photos: false,
            can_send_videos: false,
            can_send_video_notes: false,
            can_send_voice_notes: false,
            can_send_polls: false,
            can_add_web_page_previews: false,
            can_react_to_messages: true,
          })
          await sendTelegramMessage(chatId, '☀️ Sohbet açıldı.')
        }
      }
      // Admin değilse (ya da işlem yapıldıysa) burada dur - normal akışa girme
      return NextResponse.json({ ok: true })
    }
  }

  // 1️⃣ Private chat'te puan verilmez
  if (chatType === 'private') {
    console.log('💬 Private chat - no points')
    return NextResponse.json({ ok: true })
  }

  // 1.5️⃣ Resmi aktivite grubu DIŞINDA, bot paneline kayıtlı ikincil bir grup mu?
  // Puan/roll sistemi burada ÇALIŞMAZ; sadece klasik çekiliş ve GPT sohbet gibi
  // grup-bazlı bot özellikleri burada işletilir.
  const activeGroupId = SiteConfig.activityGroupId
  const isOfficialActivityGroup =
    !activeGroupId || String(chatId).replace('-', '') === activeGroupId.replace('-', '')

  if (!isOfficialActivityGroup) {
    if (userId) {
      const banStatus = await checkUserBan(userId)
      if (!banStatus.isBanned) {
        const adminRandyEnded = await checkAdminRandyEnd(message, chatType, userId)
        if (adminRandyEnded) {
          return NextResponse.json({ ok: true })
        }

        const isAdmin = await checkTgAdmin(Number(chatId), Number(userId))
        await trackActivityContestMessage(String(chatId), userId, message.from?.username || null, message.from?.first_name || null, messageText)
        const awarded = await checkAndAwardClassicWinner(
          String(chatId),
          userId,
          message.from?.username || null,
          message.from?.first_name || null,
          isAdmin
        )
        if (awarded) {
          const winnerName = message.from?.username ? `@${message.from.username}` : (message.from?.first_name || 'Kullanıcı')
          const sent = await sendTelegramMessage(
            chatId,
            `🎉 Tebrikler ${winnerName}!\n\n🎁 Ödül: ${awarded.prizeText}`
          )
          if (awarded.pinWinnerMessage && sent?.message_id) {
            await pinChatMessage(chatId, sent.message_id).catch(() => {})
          }
        }
        // ⚠️ FIX: GPT cevabı eskiden "!isAdmin" şartının içindeydi - yani
        // adminler (özelliği ayarlayıp test eden kişiler) tetikleyici
        // kelimeyi yazsa bile bottan hiç cevap alamıyordu. "Admin kendi
        // çekilişini kazanamaz" kuralı sadece yukarıdaki ödül mantığı için
        // geçerli olmalıydı, GPT sohbetiyle alakası yok.
        await maybeSendGptReply(String(chatId), messageText, message)
      }
    }
    return NextResponse.json({ ok: true })
  }

  // 2️⃣ PARALEL KONTROLLER - Promise.all ile tüm kontrolleri aynı anda yap
  // Ban kontrolü + Roll state + Randy kontrolü aynı anda
  const [banStatus, rollState, adminRandyEnded] = await Promise.all([
    userId ? checkUserBan(userId) : Promise.resolve({ isBanned: false }),
    getRollState(String(chatId)),
    checkAdminRandyEnd(message, chatType, userId)
  ])

  // Ban kontrolü sonucu
  if (banStatus.isBanned) {
    console.log(`🚫 Banned user: ${userId}`)
    return NextResponse.json({ ok: true })
  }

  // Admin Randy sonlandırdıysa çık
  if (adminRandyEnded) {
    return NextResponse.json({ ok: true })
  }

  // Eğer userId yoksa (kanal mesajları), puan sistemi çalışmaz
  if (!userId) {
    console.log('⏭️ No userId (channel message) - skipping reward system')
    return NextResponse.json({ ok: true })
  }

  // 3️⃣ PARALEL İŞLEMLER - Roll tracking + Randy tracking + Puan sistemi
  // Hepsini aynı anda başlat
  const parallelTasks: Promise<any>[] = []

  // Roll tracking (eğer roll aktifse)
  // ⚠️ Bot ve Admin kontrolü: Botlar ve grup adminleri roll listesine eklenmez
  // ✅ FIX: locked_break durumu da eklendi
  if (rollState.status === 'active' || rollState.status === 'locked' || rollState.status === 'locked_break') {
    const isBot = message.from?.is_bot === true

    if (!isBot) {
      // Admin kontrolü yap
      const { checkTelegramAdmin } = await import('@/lib/telegram/core')
      const isAdmin = await checkTelegramAdmin(chatId, Number(userId))

      if (!isAdmin) {
        // Bot değil ve admin değil - roll listesine ekle
        parallelTasks.push(
          trackUserMessage(
            String(chatId),
            userId,
            message.from?.username || null,
            message.from?.first_name || null
          )
        )
      }
    }
  }

  // Randy sonrası mesaj tracking
  parallelTasks.push(
    trackRandyPostMessage(
      userId,
      message.from?.username || null,
      message.from?.first_name || null,
      message.from?.last_name || null,
      String(chatId)
    )
  )

  // Puan kazanma sistemi
  parallelTasks.push(
    processMessageReward({
      userId,
      username: message.from?.username,
      firstName: message.from?.first_name,
      lastName: message.from?.last_name,
      messageText,
      isMediaMessage,
      chatId
    })
  )

  // Tüm işlemleri paralel çalıştır
  const results = await Promise.all(parallelTasks)

  // Son result puan sistemi sonucu
  const rewardResult = results[results.length - 1]

  if (!rewardResult.success) {
    console.log(`❌ No reward: ${rewardResult.reason}`)
  } else {
    console.log(
      `✅ Reward given: ${rewardResult.pointsAdded} points, ${rewardResult.xpAdded} XP`
    )
  }

  // Klasik çekiliş / GPT sohbet - resmi aktivite grubunda da çalışabilir
  const isAdminForExtras = await checkTgAdmin(Number(chatId), Number(userId))
  await trackActivityContestMessage(String(chatId), userId, message.from?.username || null, message.from?.first_name || null, messageText)
  const awarded = await checkAndAwardClassicWinner(
    String(chatId),
    userId,
    message.from?.username || null,
    message.from?.first_name || null,
    isAdminForExtras
  )
  if (awarded) {
    const winnerName = message.from?.username ? `@${message.from.username}` : (message.from?.first_name || 'Kullanıcı')
    const sent = await sendTelegramMessage(chatId, `🎉 Tebrikler ${winnerName}!\n\n🎁 Ödül: ${awarded.prizeText}`)
    if (awarded.pinWinnerMessage && sent?.message_id) {
      await pinChatMessage(chatId, sent.message_id).catch(() => {})
    }
  }
  // ⚠️ FIX: Aynı hata burada da vardı - GPT cevabı admin olmayan şartına
  // bağlıydı, adminler hiç cevap alamıyordu.
  await maybeSendGptReply(String(chatId), messageText, message)

  return NextResponse.json({ ok: true })
}
