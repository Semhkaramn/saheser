import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET - Kullanıcının bilet taleplerini listele
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);

    // 🚀 OPTIMIZATION: Limit to 100 most recent requests
    const requests = await prisma.ticketRequest.findMany({
      where: {
        userId: session.userId,
      },
      include: {
        event: {
          include: {
            sponsor: true,
            prizes: true,
          },
        },
        ticketNumbers: {
          orderBy: { ticketNumber: "asc" },
        },
      },
      orderBy: [
        { status: "asc" }, // pending önce
        { createdAt: "desc" },
      ],
      take: 100, // Max 100 requests per user
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
