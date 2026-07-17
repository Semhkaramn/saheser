import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET - Kullanıcının biletlerini listele
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);

    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("eventId");
    const status = searchParams.get("status"); // 'active' veya 'completed'

    const where: any = {
      userId: session.userId,
    };

    if (eventId) {
      where.eventId = eventId;
    }

    if (status) {
      // "active" status sorgusu "waiting_draw" status'unu da içermeli
      where.event = status === 'active'
        ? { status: { in: ['active', 'waiting_draw'] } }
        : { status: status };
    }

    // 🚀 OPTIMIZATION: Limit to 200 most recent tickets
    const tickets = await prisma.ticketNumber.findMany({
      where,
      include: {
        event: {
          include: {
            sponsor: true,
            prizes: true,
          },
        },
        request: true,
        prizeWins: {
          include: {
            prize: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 200, // Max 200 tickets per user
    });

    // Etkinliklere göre grupla
    type TicketWithRelations = typeof tickets[0];
    const groupedByEvent: Record<string, {
      event: TicketWithRelations['event'];
      tickets: TicketWithRelations[];
      totalTickets: number;
      wonPrizes: Array<{ ticketNumber: number; prize: TicketWithRelations['prizeWins'][0]['prize'] }>;
    }> = {};

    for (const ticket of tickets) {
      if (!groupedByEvent[ticket.eventId]) {
        groupedByEvent[ticket.eventId] = {
          event: ticket.event,
          tickets: [],
          totalTickets: 0,
          wonPrizes: [],
        };
      }

      groupedByEvent[ticket.eventId].tickets.push(ticket);
      groupedByEvent[ticket.eventId].totalTickets += 1;

      if (ticket.prizeWins.length > 0) {
        for (const win of ticket.prizeWins) {
          groupedByEvent[ticket.eventId].wonPrizes.push({
            ticketNumber: ticket.ticketNumber,
            prize: win.prize,
          });
        }
      }
    }

    // Tarih sırasına göre sırala (yeni->eski)
    const sortedGroups = Object.values(groupedByEvent).sort((a, b) => {
      return new Date(b.event.createdAt).getTime() - new Date(a.event.createdAt).getTime();
    });

    return NextResponse.json({
      tickets,
      groupedByEvent: sortedGroups,
    });
  } catch (error) {
    console.error("Biletlerim listeleme hatası:", error);
    return NextResponse.json(
      { error: "Biletler listelenemedi" },
      { status: 500 }
    );
  }
}
