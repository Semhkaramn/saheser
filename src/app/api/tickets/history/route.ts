import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET - Geçmiş bilet etkinliklerini listele (tamamlanmış etkinlikler)
export async function GET(req: NextRequest) {
  try {
    // Login gerektirmez - herkes geçmiş biletleri görebilir

    const events = await prisma.ticketEvent.findMany({
      where: {
        status: "completed",
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
          },
        },
      },
      orderBy: {
        completedAt: "desc",
      },
    });

    return NextResponse.json({ events });
  } catch (error) {
    console.error("Geçmiş bilet etkinlikleri listeleme hatası:", error);
    return NextResponse.json(
      { error: "Geçmiş bilet etkinlikleri listelenemedi" },
      { status: 500 }
    );
  }
}
