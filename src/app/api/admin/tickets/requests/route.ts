import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin-middleware";
import { prisma } from "@/lib/prisma";

// GET - Bilet taleplerini listele (Admin)
export async function GET(req: NextRequest) {
  try {
    const { admin, error } = await requirePermission(req, 'canAccessTickets');
    if (error) return error;

    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("eventId") || "";
    const status = searchParams.get("status") || "";

    const where: any = {};
    if (eventId) {
      where.eventId = eventId;
    }
    if (status) {
      where.status = status;
    }

    // 🚀 OPTIMIZATION: Limit to prevent memory issues under high load
    const requests = await prisma.ticketRequest.findMany({
      where,
      include: {
        event: {
          include: {
            sponsor: true,
          },
        },
        user: {
          select: {
            siteUsername: true,
            email: true,
          },
        },
        ticketNumbers: {
          orderBy: { ticketNumber: "asc" },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 200, // Max 200 most recent requests
    });

    return NextResponse.json({ requests });
  } catch (error) {
    console.error("Bilet talepleri listeleme hatası:", error);
    return NextResponse.json(
      { error: "Bilet talepleri listelenemedi" },
      { status: 500 }
    );
  }
}
