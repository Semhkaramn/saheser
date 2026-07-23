import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTurkeyToday, getTurkeyDateAgo } from '@/lib/utils'
import { requirePermission } from '@/lib/admin-middleware'
import { getCachedData } from '@/lib/enhanced-cache'

/**
 * ========== ADMİN İSTATİSTİK API ==========
 *
 * Bu endpoint TÜM KULLANICILARI GETİRİR:
 * - Sitede kayıtlı kullanıcılar (User tablosu)
 * - Sadece Telegram'da olan kullanıcılar (TelegramGroupUser tablosu, linkedUserId = null)
 * - Birleşmiş hesaplar (hem User hem TelegramGroupUser)
 *
 * VARSAYILAN DAVRANŞ: HİÇBİR FİLTRE UYGULANMADAN TÜM KULLANICILAR GÖSTERİLİR
 * Filtreler sadece kullanıcı tarafından açıkça seçildiğinde uygulanır.
 */
export async function GET(request: NextRequest) {
  const authCheck = await requirePermission(request, 'canAccessUsers')
  if (authCheck.error) return authCheck.error

  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''
    const sortBy = searchParams.get('sortBy') || 'createdAt' // rank, points, messages, createdAt
    const sortOrder = searchParams.get('sortOrder') || 'desc' // asc, desc
    const bannedFilter = searchParams.get('banned') // 'true', 'false', or null (TÜM KULLANICILAR)
    const messageFilter = searchParams.get('hasMessages') // 'true', 'false', or null (TÜM KULLANICILAR)
    // ⚠️ FIX: "userType" (site/telegram/linked) eskiden sadece frontend'de,
    // veri geldikten SONRA filtreleniyordu - ama sayfalama sayıları (toplam
    // kaç kayıt var) bu filtre uygulanmadan ÖNCEki haliyle hesaplanıyordu.
    // Bu da "arama/filtre sonucunda hiçbir şey çıkmıyor gibi" hissine yol
    // açan sayfa/sonuç tutarsızlıklarına sebep oluyordu. Artık filtre
    // tamamen backend'de, sorgunun kendisinde uygulanıyor.
    const userType = searchParams.get('userType') || 'all' // all, site, telegram, linked
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

    console.log('📊 Statistics API called with params:', { search, sortBy, sortOrder, bannedFilter, messageFilter, userType, page, limit })

    const today = getTurkeyToday()
    const weekAgo = getTurkeyDateAgo(7)
    const monthAgo = getTurkeyDateAgo(30)

    // ========== TÜM KULLANICILARI BİRLEŞTİR (Site + Telegram) ==========

    // "telegram" (sadece Telegram'da olanlar) seçiliyse, site kullanıcıları
    // hiç sorgulanmasın - sonuç zaten hepsi ekarte edilecekti.
    const skipSiteUsers = userType === 'telegram'
    // "site" ya da "linked" seçiliyse, sadece-Telegram kullanıcıları hiç
    // sorgulanmasın.
    const skipTelegramOnly = userType === 'site' || userType === 'linked'

    // 1. Tüm User kayıtlarını çek (site kullanıcıları)
    const userWhereClause: any = {}
    if (search) {
      userWhereClause.OR = [
        { siteUsername: { contains: search, mode: 'insensitive' } },
        { telegramUsername: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { telegramId: { contains: search } }
      ]
    }
    if (bannedFilter === 'true') userWhereClause.isBanned = true
    if (bannedFilter === 'false') userWhereClause.isBanned = false
    // "linked" (hem site hem Telegram'a bağlı) seçiliyse, telegramGroupUser
    // ilişkisi olmayan site kullanıcılarını ekarte et.
    if (userType === 'linked') userWhereClause.telegramGroupUser = { isNot: null }

    // 🚀 CRITICAL FIX: Pagination at DB level to prevent memory explosion
    // Calculate pagination for site users
    const totalSiteUsersCount = skipSiteUsers ? 0 : await prisma.user.count({ where: userWhereClause })

    // Eğer mesaja göre sıralama isteniyorsa ayrı bir yaklaşım kullanmalıyız
    const isMessageSort = sortBy === 'messages'

    const siteUsers = skipSiteUsers ? [] : await prisma.user.findMany({
      where: userWhereClause,
      include: {
        rank: {
          select: {
            name: true,
            icon: true,
            color: true,
            minXp: true
          }
        },
        telegramGroupUser: {
          select: {
            id: true,
            telegramId: true,
            username: true,
            firstName: true,
            lastName: true,
            messageCount: true,
            hadStart: true
          }
        },
        _count: {
          select: {
            purchases: true,
            wheelSpins: true
          }
        }
      },
      // Mesaja göre sıralama için tüm kayıtları çekip sonra sıralamamız gerekiyor
      take: isMessageSort ? undefined : limit,
      skip: isMessageSort ? undefined : (page - 1) * limit,
      orderBy: sortBy === 'createdAt' ? { createdAt: sortOrder as 'asc' | 'desc' } :
               sortBy === 'points' ? { points: sortOrder as 'asc' | 'desc' } :
               sortBy === 'xp' ? { xp: sortOrder as 'asc' | 'desc' } : { createdAt: 'desc' }
    })

    console.log(`✅ Found ${siteUsers.length}/${totalSiteUsersCount} site users (page ${page})`)

    // 2. linkedUserId null olan Telegram kullanıcılarını çek (sadece Telegram'da olanlar)
    const telegramOnlyWhereClause: any = { linkedUserId: null }
    if (search) {
      telegramOnlyWhereClause.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { telegramId: { contains: search } }
      ]
    }
    // Sadece-Telegram kullanıcıların banlanma durumu yok (isBanned her zaman
    // false) - "sadece banlıları göster" seçiliyse bunları tamamen ekarte et.
    if (bannedFilter === 'true') telegramOnlyWhereClause.id = 'never-matches'

    const totalTelegramOnlyCount = skipTelegramOnly ? 0 : await prisma.telegramGroupUser.count({ where: telegramOnlyWhereClause })

    const telegramOnlyUsers = skipTelegramOnly ? [] : await prisma.telegramGroupUser.findMany({
      where: telegramOnlyWhereClause,
      take: isMessageSort ? undefined : Math.max(0, limit - siteUsers.length),
      skip: isMessageSort ? undefined : Math.max(0, (page - 1) * limit - totalSiteUsersCount),
      orderBy: sortBy === 'messages'
        ? { messageCount: sortOrder as 'asc' | 'desc' }
        : { firstSeenAt: sortOrder as 'asc' | 'desc' }
    })

    console.log(`✅ Found ${telegramOnlyUsers.length}/${totalTelegramOnlyCount} telegram-only users (page ${page})`)

    // Calculate actual total for pagination
    const actualTotal = totalSiteUsersCount + totalTelegramOnlyCount

    // 3. Site kullanıcılarını formatla
    type CombinedUser = {
      id: string
      userId: string | null
      telegramId: string | null
      siteUsername: string | null
      email: string | null
      username: string | null
      firstName: string | null
      lastName: string | null
      avatar: string | null
      points: number
      xp: number
      totalMessages: number
      dailySpinsLeft: number
      isBanned: boolean
      banReason: string | null | undefined
      bannedAt: string | null | undefined
      bannedBy: string | null | undefined
      createdAt: string
      hadStart: boolean
      isRegistered: boolean
      hasTelegram: boolean
      rank: any
      _count: {
        purchases: number
        wheelSpins: number
        messages: number
      }
    }

    let combinedUsers: CombinedUser[] = siteUsers.map(user => {
      const tgUser = user.telegramGroupUser
      return {
        id: user.id, // User ID
        userId: user.id,
        telegramId: user.telegramId || tgUser?.telegramId || null,
        siteUsername: user.siteUsername,
        email: user.email,
        username: tgUser?.username || null,
        firstName: user.firstName || tgUser?.firstName || null,
        lastName: user.lastName || tgUser?.lastName || null,
        avatar: user.avatar || null,
        points: user.points,
        xp: user.xp,
        totalMessages: tgUser?.messageCount || 0,
        dailySpinsLeft: user.dailySpinsLeft,
        isBanned: user.isBanned,
        banReason: user.banReason,
        bannedAt: user.bannedAt?.toISOString(),
        bannedBy: user.bannedBy,
        createdAt: user.createdAt.toISOString(),
        hadStart: tgUser?.hadStart || false,
        isRegistered: true, // Site kullanıcısı
        hasTelegram: !!tgUser, // Telegram'a bağlı mı?
        rank: user.rank,
        _count: {
          purchases: user._count.purchases,
          wheelSpins: user._count.wheelSpins,
          messages: tgUser?.messageCount || 0
        }
      }
    })

    // 4. Sadece Telegram kullanıcılarını ekle
    const telegramOnlyFormatted = telegramOnlyUsers.map(tgUser => ({
      id: tgUser.id, // TelegramGroupUser ID
      userId: null,
      telegramId: tgUser.telegramId,
      siteUsername: null,
      email: null,
      username: tgUser.username,
      firstName: tgUser.firstName,
      lastName: tgUser.lastName,
      avatar: null,
      points: 0,
      xp: 0,
      totalMessages: tgUser.messageCount,
      dailySpinsLeft: 0,
      isBanned: false,
      banReason: null,
      bannedAt: null,
      bannedBy: null,
      createdAt: tgUser.firstSeenAt.toISOString(),
      hadStart: tgUser.hadStart,
      isRegistered: false, // Sadece Telegram
      hasTelegram: true,
      rank: null,
      _count: {
        purchases: 0,
        wheelSpins: 0,
        messages: tgUser.messageCount
      }
    }))

    // 5. Birleştir
    combinedUsers = [...combinedUsers, ...telegramOnlyFormatted]

    console.log(`📝 Total combined users on this page: ${combinedUsers.length}`)

    // ========== SIRALAMALI PAGINATION ==========
    let sortedUsers = combinedUsers

    // Mesaj sayısına göre sıralama için in-memory sorting gerekli
    if (sortBy === 'messages') {
      sortedUsers = combinedUsers.sort((a, b) => {
        const aMessages = a.totalMessages || 0
        const bMessages = b.totalMessages || 0
        return sortOrder === 'desc' ? bMessages - aMessages : aMessages - bMessages
      })
    } else if (sortBy === 'points') {
      sortedUsers = combinedUsers.sort((a, b) => {
        return sortOrder === 'desc' ? b.points - a.points : a.points - b.points
      })
    } else if (sortBy === 'xp') {
      sortedUsers = combinedUsers.sort((a, b) => {
        return sortOrder === 'desc' ? b.xp - a.xp : a.xp - b.xp
      })
    }

    // Mesaj sıralaması için DB level pagination yoksa burada yapalım
    const totalCount = actualTotal
    const totalPages = Math.ceil(totalCount / limit)
    const paginatedUsers = isMessageSort
      ? sortedUsers.slice((page - 1) * limit, page * limit)
      : sortedUsers

    console.log(`📄 Pagination: page ${page}/${totalPages}, showing ${paginatedUsers.length}/${totalCount} users`)
    // ========== YENİ BİTİŞ ==========

    // Get overall statistics
    const [
      totalSiteUsers,
      totalTelegramUsers,
      totalLinkedUsers,
      bannedUsers,
      hadStartUsers,
      usersWithMessages,
      totalMessagesAggregate,
      dailyMessagesAggregate,
      weeklyMessagesAggregate,
      monthlyMessagesAggregate
    ] = await Promise.all([
      // ✅ CACHE: Total counts nadiren değişir, 5 dakika cache
      getCachedData(
        'stats:total_site_users',
        async () => await prisma.user.count(),
        { ttl: 300 }
      ),
      getCachedData(
        'stats:total_telegram_users',
        async () => await prisma.telegramGroupUser.count(),
        { ttl: 300 }
      ),
      getCachedData(
        'stats:total_linked_users',
        async () => await prisma.telegramGroupUser.count({ where: { linkedUserId: { not: null } } }),
        { ttl: 300 }
      ),
      getCachedData(
        'stats:banned_users',
        async () => await prisma.user.count({ where: { isBanned: true } }),
        { ttl: 300 }
      ),
      // ✅ OPTIMIZE: HadStart kullanıcı sayısını doğrudan count ile al + cache
      getCachedData(
        'stats:had_start_users',
        async () => await prisma.telegramGroupUser.count({ where: { hadStart: true } }),
        { ttl: 300 }
      ),
      // Gerçekten mesaj yazan kullanıcı sayısı (messageCount > 0) + cache
      getCachedData(
        'stats:users_with_messages',
        async () => await prisma.telegramGroupUser.count({ where: { messageCount: { gt: 0 } } }),
        { ttl: 300 }
      ),
      // Toplam mesaj sayısı - TelegramGroupUser.messageCount toplamı
      prisma.telegramGroupUser.aggregate({
        _sum: { messageCount: true }
      }),
      // Günlük mesaj sayısı toplamı
      prisma.telegramGroupUser.aggregate({
        _sum: { dailyMessageCount: true }
      }),
      // Haftalık mesaj sayısı toplamı
      prisma.telegramGroupUser.aggregate({
        _sum: { weeklyMessageCount: true }
      }),
      // Aylık mesaj sayısı toplamı
      prisma.telegramGroupUser.aggregate({
        _sum: { monthlyMessageCount: true }
      })
    ])

    const totalMessages = totalMessagesAggregate._sum.messageCount || 0
    const dailyMessages = dailyMessagesAggregate._sum.dailyMessageCount || 0
    const weeklyMessages = weeklyMessagesAggregate._sum.weeklyMessageCount || 0
    const monthlyMessages = monthlyMessagesAggregate._sum.monthlyMessageCount || 0

    console.log('📊 Statistics summary:', {
      totalSiteUsers,
      totalTelegramUsers,
      totalLinkedUsers,
      bannedUsers,
      hadStartUsers,
      usersWithMessages,
      returnedUsers: paginatedUsers.length,
      totalCount,
      totalPages,
      messages: {
        total: totalMessages,
        daily: dailyMessages,
        weekly: weeklyMessages,
        monthly: monthlyMessages
      }
    })

    return NextResponse.json({
      users: paginatedUsers,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      },
      stats: {
        totalSiteUsers, // Toplam site kullanıcısı
        totalTelegramUsers, // Toplam telegram grup kullanıcısı
        totalLinkedUsers, // Site hesabına bağlı telegram kullanıcısı
        totalUnlinkedUsers: totalTelegramUsers - totalLinkedUsers, // Siteye kayıtlı olmayan telegram kullanıcısı
        bannedUsers,
        hadStartUsers,
        usersWithMessages, // Gerçekten mesaj yazan telegram kullanıcısı (messageCount > 0)
        messages: {
          total: totalMessages, // Toplam mesaj sayısı
          daily: dailyMessages, // Günlük mesaj sayısı
          weekly: weeklyMessages, // Haftalık mesaj sayısı
          monthly: monthlyMessages // Aylık mesaj sayısı
        },
        siteMessages: {
          total: 0, // Artık site mesaj takibi yok
          daily: 0,
          weekly: 0,
          monthly: 0
        }
      }
    })
  } catch (error) {
    console.error('❌ Get statistics error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
