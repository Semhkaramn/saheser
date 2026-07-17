import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params

    // userId aslında TelegramGroupUser ID'si de olabilir
    // Önce User olarak dene
    let user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        rank: true,
      }
    })

    // Eğer user bulunamadıysa, bu bir TelegramGroupUser ID'si olabilir
    let telegramUser = null
    let actualUserId = userId

    if (!user) {
      // TelegramGroupUser olarak dene
      telegramUser = await prisma.telegramGroupUser.findUnique({
        where: { id: userId },
        include: {
          linkedUser: {
            include: {
              rank: true
            }
          }
        }
      })

      if (!telegramUser) {
        return NextResponse.json(
          { error: 'Kullanıcı bulunamadı' },
          { status: 404 }
        )
      }

      // TelegramGroupUser için linkedUser varsa onu kullan
      if (telegramUser.linkedUser) {
        user = telegramUser.linkedUser
        actualUserId = telegramUser.linkedUser.id
      }
    } else {
      // User için TelegramGroupUser bilgisini al
      if (user.telegramId) {
        telegramUser = await prisma.telegramGroupUser.findUnique({
          where: { telegramId: user.telegramId }
        })
      }
    }

    // Siteye kayıtlı kullanıcı varsa, tüm detayları al
    let wheelSpins: any[] = []
    let pointHistory: any[] = []
    let purchases: any[] = []
    let taskHistory: any[] = []
    let eventParticipations: any[] = []
    let eventWins: any[] = []
    let sponsorInfos: any[] = []
    let ticketRequests: any[] = []
    let ticketNumbers: any[] = []
    let promocodeUsages: any[] = []

    if (user) {
      // User bilgileri varsa (kayıtlı kullanıcı)
      [wheelSpins, pointHistory, purchases, taskHistory, eventParticipations, eventWins, sponsorInfos, ticketRequests, ticketNumbers, promocodeUsages] = await Promise.all([
        prisma.wheelSpin.findMany({
          where: { userId: actualUserId },
          include: {
            prize: {
              select: {
                name: true,
                points: true,
                color: true
              }
            }
          },
          orderBy: { spunAt: 'desc' },
          take: 50
        }),
        prisma.pointHistory.findMany({
          where: { userId: actualUserId },
          orderBy: { createdAt: 'desc' },
          take: 100
        }),
        prisma.userPurchase.findMany({
          where: { userId: actualUserId },
          include: {
            item: {
              select: {
                name: true,
                description: true,
                imageUrl: true,
                category: true
              }
            }
          },
          orderBy: { purchasedAt: 'desc' },
          take: 50
        }),
        prisma.userTaskReward.findMany({
          where: {
            userId: actualUserId
          },
          include: {
            task: {
              select: {
                title: true,
                description: true,
                category: true,
                taskType: true,
                xpReward: true,
                pointsReward: true
              }
            }
          },
          orderBy: { claimedAt: 'desc' },
          take: 100
        }),
        // Etkinlik katılımları
        prisma.eventParticipant.findMany({
          where: { userId: actualUserId },
          include: {
            event: {
              select: {
                id: true,
                title: true,
                description: true,
                endDate: true,
                status: true,
                sponsor: {
                  select: {
                    name: true,
                    logoUrl: true
                  }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 50
        }),
        // Etkinlik kazançları
        prisma.eventWinner.findMany({
          where: { userId: actualUserId },
          include: {
            event: {
              select: {
                id: true,
                title: true,
                description: true,
                sponsor: {
                  select: {
                    name: true,
                    logoUrl: true
                  }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 50
        }),
        // Sponsor bilgileri
        prisma.userSponsorInfo.findMany({
          where: { userId: actualUserId },
          include: {
            sponsor: {
              select: {
                id: true,
                name: true,
                logoUrl: true,
                identifierType: true
              }
            }
          },
          orderBy: { updatedAt: 'desc' },
          take: 50
        }),
        // Bilet talepleri
        prisma.ticketRequest.findMany({
          where: { userId: actualUserId },
          include: {
            event: {
              select: {
                id: true,
                title: true,
                sponsor: {
                  select: {
                    name: true
                  }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 50
        }),
        // Bilet numaraları
        prisma.ticketNumber.findMany({
          where: { userId: actualUserId },
          include: {
            event: {
              select: {
                id: true,
                title: true
              }
            },
            prizeWins: {
              include: {
                prize: {
                  select: {
                    prizeAmount: true
                  }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 50
        }),
        // Promocode kullanımları
        prisma.promocodeUsage.findMany({
          where: { userId: actualUserId },
          include: {
            promocode: {
              select: {
                code: true,
                description: true,
                points: true
              }
            }
          },
          orderBy: { usedAt: 'desc' },
          take: 50
        })
      ])
    }

    // Mesaj sayısı - TelegramGroupUser'dan al
    const totalMessages = telegramUser?.messageCount || 0

    // XP history from point history
    const xpHistory = pointHistory.filter(ph =>
      ph.type?.includes('xp') || ph.type === 'message_reward'
    )

    // Sponsor bilgilerini düzenle
    const sponsorInfo = {
      totalSponsors: sponsorInfos.length,
      sponsors: sponsorInfos
    }

    // İstatistik özeti
    const activityStats = {
      totalPurchases: purchases.length,
      pendingPurchases: purchases.filter(p => p.status === 'pending').length,
      completedPurchases: purchases.filter(p => p.status === 'completed').length,
      totalEventParticipations: eventParticipations.length,
      totalEventWins: eventWins.length,
      prizeAddedWins: eventWins.filter(ew => ew.status === 'prize_added').length,
      totalWheelSpins: wheelSpins.length,
      totalTasksCompleted: taskHistory.length,
      totalSponsorsRegistered: sponsorInfos.length,
      totalTicketRequests: ticketRequests.length,
      approvedTicketRequests: ticketRequests.filter(tr => tr.status === 'approved').length,
      totalPromocodesUsed: promocodeUsages.length
    }

    // ========== MULTİ HESAP TESPİTİ (SADECE IP BAZLI) ==========
    type MultiAccountMatch = {
      type: 'ip'
      value: string
      users: Array<{
        id: string
        siteUsername: string | null
        telegramId: string | null
        telegramUsername: string | null
        firstName: string | null
        points: number
        createdAt: Date
      }>
    }

    const multiAccountMatches: MultiAccountMatch[] = []

    if (user) {
      // Aynı IP adresinden giriş yapan kullanıcıları bul
      const userIPs = await prisma.userActivityLog.findMany({
        where: {
          userId: user.id,
          ipAddress: { not: null }
        },
        select: { ipAddress: true },
        distinct: ['ipAddress'],
        take: 20
      })

      for (const ipRecord of userIPs) {
        if (!ipRecord.ipAddress) continue

        const sameIPUserIds = await prisma.userActivityLog.findMany({
          where: {
            ipAddress: ipRecord.ipAddress,
            userId: { not: user.id }
          },
          select: { userId: true },
          distinct: ['userId'],
          take: 20
        })

        if (sameIPUserIds.length > 0) {
          const sameIPUsers = await prisma.user.findMany({
            where: {
              id: { in: sameIPUserIds.map(u => u.userId) }
            },
            select: {
              id: true,
              siteUsername: true,
              telegramId: true,
              telegramUsername: true,
              firstName: true,
              points: true,
              createdAt: true
            }
          })

          if (sameIPUsers.length > 0) {
            multiAccountMatches.push({
              type: 'ip',
              value: ipRecord.ipAddress,
              users: sameIPUsers
            })
          }
        }
      }
    }

    return NextResponse.json({
      user: user || {
        // Kayıtsız kullanıcı için telegram bilgilerini göster
        id: telegramUser?.id,
        siteUsername: null,
        username: telegramUser?.username,
        firstName: telegramUser?.firstName,
        lastName: telegramUser?.lastName,
        points: 0,
        xp: 0,
        totalMessages: telegramUser?.messageCount || 0,
        createdAt: telegramUser?.firstSeenAt,
        isRegistered: false
      },
      telegramUser,
      wheelSpins,
      pointHistory,
      xpHistory,
      purchases,
      taskHistory,
      eventParticipations,
      eventWins,
      sponsorInfo,
      ticketRequests,
      ticketNumbers,
      promocodeUsages,
      activityStats,
      messageStats: {
        daily: telegramUser?.dailyMessageCount || 0,
        weekly: telegramUser?.weeklyMessageCount || 0,
        monthly: telegramUser?.monthlyMessageCount || 0,
        total: totalMessages,
        recent: []
      },
      telegramMessageStats: {
        daily: telegramUser?.dailyMessageCount || 0,
        weekly: telegramUser?.weeklyMessageCount || 0,
        monthly: telegramUser?.monthlyMessageCount || 0,
        total: totalMessages,
        recent: []
      },
      multiAccountMatches // ✅ Multi hesap eşleşmeleri (sadece IP bazlı)
    })
  } catch (error) {
    console.error('Get user statistics error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
