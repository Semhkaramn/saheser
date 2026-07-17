import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin-middleware";
import { prisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram/core";
import { getTurkeyDate } from "@/lib/utils";
import { z } from "zod";

type Params = {
  params: Promise<{ id: string }>;
};

// POST - Bilet etkinliğini bitir ve kazananları belirle
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { admin, error } = await requirePermission(req, 'canAccessTickets');
    if (error) return error;

    const { id } = await params;

    const schema = z.object({
      action: z.enum(["prepare_draw", "complete_draw"]).optional(), // Yeni: İşlem türü
      winners: z.array(
        z.object({
          prizeId: z.string(),
          ticketNumbers: z.array(z.number()),
        })
      ).optional(),
    });

    const body = await req.json().catch(() => ({}));
    const data = schema.parse(body);

    const event = await prisma.ticketEvent.findUnique({
      where: { id },
      include: {
        prizes: {
          orderBy: { order: "asc" },
        },
        ticketNumbers: {
          include: {
            request: {
              include: {
                user: true,
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

    if (event.status !== "active" && event.status !== "waiting_draw" && event.status !== "reviewing") {
      return NextResponse.json(
        { error: "Bu etkinlik zaten tamamlanmış" },
        { status: 400 }
      );
    }

    // Eğer action "prepare_draw" ise veya winners belirtilmemişse, sadece çekiliş için hazırla
    if (data.action === "prepare_draw" || (!data.winners || data.winners.length === 0)) {
      await prisma.ticketEvent.update({
        where: { id },
        data: {
          status: "waiting_draw",
        },
      });

      // Tüm bilet numaralarını döndür
      return NextResponse.json({
        success: true,
        message: "Çekiliş için hazır, kazananları seçebilirsiniz",
        status: "waiting_draw",
        ticketNumbers: event.ticketNumbers.map(tn => ({
          id: tn.id,
          ticketNumber: tn.ticketNumber,
          userId: tn.userId,
          username: tn.request.user?.siteUsername || tn.request.user?.email,
          sponsorInfo: tn.request.sponsorInfo,
        })),
      });
    }

    // Kazanan bilet numaralarını doğrula ve kaydet
    const winnerRecords: Array<{
      prizeId: string;
      ticketNumberId: string;
      userId: string;
    }> = [];

    // Aynı biletin birden fazla ödül kazanmasını engellemek için kullanılan biletleri takip et
    const usedTicketNumbers = new Set<number>();

    for (const winnerGroup of data.winners) {
      const prize = event.prizes.find((p) => p.id === winnerGroup.prizeId);
      if (!prize) {
        return NextResponse.json(
          { error: `Ödül bulunamadı: ${winnerGroup.prizeId}` },
          { status: 400 }
        );
      }

      if (winnerGroup.ticketNumbers.length !== prize.winnerCount) {
        return NextResponse.json(
          { error: `Ödül ${prize.prizeAmount} TL için ${prize.winnerCount} kazanan seçilmeli` },
          { status: 400 }
        );
      }

      for (const ticketNum of winnerGroup.ticketNumbers) {
        // Aynı bilet numarası daha önce başka bir ödül için kullanıldı mı kontrol et
        if (usedTicketNumbers.has(ticketNum)) {
          return NextResponse.json(
            { error: `Bilet #${ticketNum} zaten başka bir ödül için seçilmiş. Aynı bilet birden fazla ödül kazanamaz.` },
            { status: 400 }
          );
        }

        const ticketNumber = event.ticketNumbers.find(
          (t) => t.ticketNumber === ticketNum
        );

        if (!ticketNumber) {
          return NextResponse.json(
            { error: `Geçersiz bilet numarası: ${ticketNum}` },
            { status: 400 }
          );
        }

        // Bileti kullanılanlar listesine ekle
        usedTicketNumbers.add(ticketNum);

        winnerRecords.push({
          prizeId: winnerGroup.prizeId,
          ticketNumberId: ticketNumber.id,
          userId: ticketNumber.userId,
        });
      }
    }

    // Transaction ile güncelleme
    await prisma.$transaction(async (tx) => {
      // Kazananları kaydet
      await tx.ticketPrizeWinner.createMany({
        data: winnerRecords,
      });

      // Etkinliği tamamla
      await tx.ticketEvent.update({
        where: { id },
        data: {
          status: "completed",
          completedAt: getTurkeyDate(),
        },
      });
    });

    // Kazananlara bildirim gönder
    const userWinnings: Record<string, Array<{ ticketNumber: number; prizeAmount: number }>> = {};

    for (const winner of winnerRecords) {
      const ticketNumber = event.ticketNumbers.find((t) => t.id === winner.ticketNumberId);
      const prize = event.prizes.find((p) => p.id === winner.prizeId);

      if (!ticketNumber || !prize) continue;

      if (!userWinnings[winner.userId]) {
        userWinnings[winner.userId] = [];
      }

      userWinnings[winner.userId].push({
        ticketNumber: ticketNumber.ticketNumber,
        prizeAmount: prize.prizeAmount
      });
    }

    // Her kullanıcıya bildirim gönder
    for (const [userId, winnings] of Object.entries(userWinnings)) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (user?.telegramId) {
        // Her bilet ve ödülü listele
        const prizeDetails = winnings.map(w =>
          `🎟️ #${w.ticketNumber} → 💰 ${w.prizeAmount} TL`
        ).join('\n');

        const message = `🎉 TEBRİKLER! Bilet Etkinliğinde Kazandınız!\n\n📌 Etkinlik: ${event.title}\n\n${prizeDetails}`;
        await sendTelegramMessage(Number(user.telegramId), message);

        // Rate limiting: Telegram API 30 msg/sec limit
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    return NextResponse.json({
      success: true,
      event,
      winnerCount: winnerRecords.length,
    });
  } catch (error) {
    console.error("Bilet etkinliği tamamlama hatası:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Geçersiz veri", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Bilet etkinliği tamamlanamadı" },
      { status: 500 }
    );
  }
}
