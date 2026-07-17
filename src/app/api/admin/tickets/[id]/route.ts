import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin-middleware";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

type Params = {
  params: Promise<{ id: string }>;
};

// PUT - Bilet etkinliğinin durumunu değiştir (örn: active -> reviewing "beklemede")
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { error } = await requirePermission(req, 'canAccessTickets');
    if (error) return error;

    const { id } = await params;
    const schema = z.object({
      status: z.enum(["active", "reviewing", "waiting_draw", "completed", "cancelled"]),
    });
    const { status } = schema.parse(await req.json());

    const event = await prisma.ticketEvent.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json({ success: true, event });
  } catch (error) {
    console.error("Bilet etkinliği durum güncelleme hatası:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Geçersiz veri", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Durum güncellenemedi" }, { status: 500 });
  }
}

// GET - Bilet etkinliği detayı
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { admin, error } = await requirePermission(req, 'canAccessTickets');
    if (error) return error;

    const { id } = await params;

    const event = await prisma.ticketEvent.findUnique({
      where: { id },
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
        requests: {
          include: {
            ticketNumbers: true,
            user: {
              select: {
                siteUsername: true,
                email: true,
              },
            },
          },
        },
        ticketNumbers: {
          orderBy: { ticketNumber: "asc" },
          include: {
            request: {
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
    });

    if (!event) {
      return NextResponse.json(
        { error: "Bilet etkinliği bulunamadı" },
        { status: 404 }
      );
    }

    // Kullanıcı bazında bilet sayılarını hesapla
    const userTicketCounts = await prisma.ticketNumber.groupBy({
      by: ['userId'],
      where: { eventId: id },
      _count: { id: true },
    });

    // Her kullanıcı için detaylı bilgi çek
    const userDetails = await Promise.all(
      userTicketCounts.map(async (uc) => {
        const user = await prisma.user.findUnique({
          where: { id: uc.userId },
          select: {
            siteUsername: true,
            email: true,
          },
        });

        // Bu kullanıcının bu etkinlik için yaptığı talepleri bul
        const requests = await prisma.ticketRequest.findMany({
          where: {
            eventId: id,
            userId: uc.userId,
            status: 'approved',
          },
          select: {
            sponsorInfo: true,
          },
        });

        // Bu kullanıcının tüm bilet numaralarını al
        const userTicketNumbers = await prisma.ticketNumber.findMany({
          where: {
            eventId: id,
            userId: uc.userId,
          },
          select: {
            ticketNumber: true,
          },
          orderBy: {
            ticketNumber: 'asc',
          },
        });

        return {
          userId: uc.userId,
          siteUsername: user?.siteUsername,
          email: user?.email,
          ticketCount: uc._count.id,
          sponsorInfo: requests[0]?.sponsorInfo || 'N/A',
          ticketNumbers: userTicketNumbers.map(tn => tn.ticketNumber),
        };
      })
    );

    // Toplam istatistikler
    const approvedRequests = event.requests.filter(r => r.status === 'approved');
    const totalInvestment = approvedRequests.reduce((sum, r) => sum + r.investmentAmount, 0);

    // Format ticket numbers with user info
    const formattedTicketNumbers = event.ticketNumbers.map(tn => ({
      id: tn.id,
      ticketNumber: tn.ticketNumber,
      userId: tn.userId,
      username: tn.request?.user?.siteUsername || tn.request?.user?.email || 'N/A',
      sponsorInfo: tn.request?.sponsorInfo || 'N/A',
    }));

    return NextResponse.json({
      event,
      userTicketCounts: userDetails,
      ticketNumbers: formattedTicketNumbers,
      stats: {
        totalInvestment,
        totalParticipants: userDetails.length,
      },
    });
  } catch (error) {
    console.error("Bilet etkinliği detay hatası:", error);
    return NextResponse.json(
      { error: "Bilet etkinliği getirilemedi" },
      { status: 500 }
    );
  }
}

// DELETE - Bilet etkinliğini sil
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { admin, error } = await requirePermission(req, 'canAccessTickets');
    if (error) return error;

    const { id } = await params;

    await prisma.ticketEvent.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Bilet etkinliği silme hatası:", error);
    return NextResponse.json(
      { error: "Bilet etkinliği silinemedi" },
      { status: 500 }
    );
  }
}
