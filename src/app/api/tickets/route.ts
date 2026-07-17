import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTurkeyDate } from "@/lib/utils";

// GET - Aktif bilet etkinliklerini listele (herkes görebilir)
export async function GET(req: NextRequest) {
  try {
    // Login gerektirmez - herkes aktif biletleri görebilir, ama giriş yapmışsa
    // "bu etkinliğe zaten katıldım mı" bilgisini de ekleyelim (buton durumu için)
    const session = await getSession(req);
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'active';
    const eventId = searchParams.get('eventId');

    // Eğer eventId varsa, sadece o etkinliği getir (slug ya da id ile - eski linkler de çalışsın)
    if (eventId) {
      const event = await prisma.ticketEvent.findFirst({
        where: {
          OR: [{ slug: eventId }, { id: eventId }],
          sponsor: { isActive: true },
        },
        include: {
          sponsor: true,
          prizes: {
            orderBy: { order: "asc" },
            include: {
              winners: {
                include: {
                  ticketNumber: {
                    include: {
                      user: {
                        select: {
                          siteUsername: true,
                          email: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          _count: {
            select: {
              ticketNumbers: true,
              requests: true,
            },
          },
        },
      });

      if (!event) {
        return NextResponse.json({ events: [] });
      }

      // waiting_draw durumundaki etkinlikler için benzersiz kullanıcı sayısını hesapla
      let eventWithStats: any = event;
      if (event.status === 'waiting_draw') {
        const uniqueUsers = await prisma.ticketNumber.groupBy({
          by: ['userId'],
          where: {
            eventId: event.id,
          },
        });

        eventWithStats = {
          ...event,
          uniqueParticipants: uniqueUsers.length,
        };
      }

      if (session?.userId) {
        const myRequest = await prisma.ticketRequest.findFirst({
          where: { eventId: event.id, userId: session.userId },
          select: { id: true },
        });
        eventWithStats = { ...eventWithStats, userJoined: Boolean(myRequest) };
      }

      return NextResponse.json({ events: [eventWithStats] });
    }

    // "active" status sorgusu sadece "active" durumundakileri getirmeli
    const statusCondition = { status: status };

    const events = await prisma.ticketEvent.findMany({
      where: {
        ...statusCondition,
        sponsor: { isActive: true },
        // ⚠️ FIX: "Süresiz" (endDate: null) biletler bu filtre olmadan
        // "active" listesinden hiç görünmüyordu - null karşılaştırması
        // SQL'de her zaman false döner. Süresiz olanları da dahil ediyoruz.
        ...(status === 'active' ? {
          OR: [
            { endDate: { gte: new Date() } },
            { endDate: null },
          ],
        } : {}),
      },
      include: {
        sponsor: true,
        prizes: {
          orderBy: { order: "asc" },
        },
        _count: {
          select: {
            ticketNumbers: true,
            requests: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // ✅ OPTIMIZE: waiting_draw durumundaki etkinlikler için benzersiz kullanıcı sayısını tek sorguda hesapla
    const waitingDrawEvents = events.filter(e => e.status === 'waiting_draw');
    const waitingDrawEventIds = waitingDrawEvents.map(e => e.id);

    // Tek sorguda tüm waiting_draw event'lerin unique user count'larını al
    let uniqueUserCounts: Record<string, number> = {};
    if (waitingDrawEventIds.length > 0) {
      const uniqueUsers = await prisma.ticketNumber.groupBy({
        by: ['eventId', 'userId'],
        where: {
          eventId: { in: waitingDrawEventIds }
        }
      });

      // Event ID'ye göre grupla ve say
      uniqueUserCounts = uniqueUsers.reduce((acc, item) => {
        acc[item.eventId] = (acc[item.eventId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
    }

    // Events'e unique participant count'ları ekle
    let eventsWithStats: any[] = events.map(event => {
      if (event.status === 'waiting_draw') {
        return {
          ...event,
          uniqueParticipants: uniqueUserCounts[event.id] || 0,
        };
      }
      return event;
    });

    // Giriş yapmış kullanıcı için, listedeki etkinliklerden hangilerine
    // zaten katıldığını tek sorguda bul (buton "Katıl"/"Katıldınız" ayrımı için)
    if (session?.userId && events.length > 0) {
      const myRequests = await prisma.ticketRequest.findMany({
        where: { userId: session.userId, eventId: { in: events.map((e) => e.id) } },
        select: { eventId: true },
      });
      const joinedEventIds = new Set(myRequests.map((r) => r.eventId));
      eventsWithStats = eventsWithStats.map((e) => ({ ...e, userJoined: joinedEventIds.has(e.id) }));
    }

    return NextResponse.json({ events: eventsWithStats });
  } catch (error) {
    console.error("Bilet etkinlikleri listeleme hatası:", error);
    return NextResponse.json(
      { error: "Bilet etkinlikleri listelenemedi" },
      { status: 500 }
    );
  }
}
