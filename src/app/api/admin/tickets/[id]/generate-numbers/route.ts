import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin-middleware";
import { prisma } from "@/lib/prisma";

type Params = {
  params: Promise<{ id: string }>;
};

const TICKET_NUMBER_START = 1000;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a;
}

// POST - Katılımcıların yatırım tutarına göre bilet numaralarını oluştur.
//
// Her katılımcının hakkı = floor(yatırım tutarı / bilet fiyatı).
// Tüm katılımcıların hakları toplanıp tek bir "slot" havuzu oluşturulur
// (örn: A 3 slot, B 2 slot -> [A,A,A,B,B]), bu havuz KARIŞTIRILIR, sonra
// 1000'den başlayarak sırayla numaralandırılır. Böylece aynı kullanıcının
// numaraları da rastgele dağılmış olur (ardışık değil) - istenen tablo
// görünümü tam olarak budur.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { admin, error } = await requirePermission(req, 'canAccessTickets');
    if (error) return error;

    const { id: eventId } = await params;

    const event = await prisma.ticketEvent.findUnique({ where: { id: eventId } });
    if (!event) {
      return NextResponse.json({ error: "Bilet etkinliği bulunamadı" }, { status: 404 });
    }

    // Henüz bilet numarası verilmemiş, yatırım tutarı girilmiş katılımcılar
    const requests = await prisma.ticketRequest.findMany({
      where: { eventId, status: "approved", investmentAmount: { gt: 0 } },
      include: { ticketNumbers: true },
    });

    const pendingRequests = requests.filter((r) => r.ticketNumbers.length === 0);
    if (pendingRequests.length === 0) {
      return NextResponse.json(
        { error: "Numara oluşturulacak, yatırımı girilmiş yeni katılımcı yok" },
        { status: 400 }
      );
    }

    // Mevcut en yüksek bilet numarasını bul (birden fazla kez çalıştırılabilsin diye)
    const maxTicket = await prisma.ticketNumber.findFirst({
      where: { eventId },
      orderBy: { ticketNumber: "desc" },
    });
    const startNumber = Math.max((maxTicket?.ticketNumber || 0) + 1, TICKET_NUMBER_START);

    // Slot havuzunu oluştur: her katılımcı hakkı kadar tekrar eder
    type Slot = { requestId: string; userId: string };
    let slots: Slot[] = [];
    const skipped: string[] = [];

    for (const r of pendingRequests) {
      const ticketCount = Math.floor(r.investmentAmount / event.ticketPrice);
      if (ticketCount < 1) {
        skipped.push(r.id);
        continue;
      }
      for (let i = 0; i < ticketCount; i++) {
        slots.push({ requestId: r.id, userId: r.userId });
      }
    }

    if (slots.length === 0) {
      return NextResponse.json(
        { error: "Hiçbir katılımcının yatırımı bilet fiyatını karşılamıyor" },
        { status: 400 }
      );
    }

    // ✅ FIX: Artık toplam bilet sayısıyla (totalTickets) sınırlandırmıyoruz.
    // Kullanıcı ne kadar yatırım yaptıysa o kadar bilet hakkı var - "stok"
    // mantığı yok. totalTickets sadece bilgilendirme amaçlı kalıyor.
    slots = shuffle(slots);

    const ticketNumbersData = slots.map((slot, i) => ({
      eventId,
      requestId: slot.requestId,
      userId: slot.userId,
      ticketNumber: startNumber + i,
    }));

    const result = await prisma.$transaction(async (tx) => {
      await tx.ticketNumber.createMany({ data: ticketNumbersData });

      const newSoldCount = event.soldTickets + ticketNumbersData.length;
      const updatedEvent = await tx.ticketEvent.update({
        where: { id: eventId },
        data: { soldTickets: newSoldCount },
      });

      return updatedEvent;
    });

    // Kullanıcılara bildirim (kimin kaç/ hangi numara aldığını grupla)
    const byUser = new Map<string, number[]>();
    for (const t of ticketNumbersData) {
      if (!byUser.has(t.userId)) byUser.set(t.userId, []);
      byUser.get(t.userId)!.push(t.ticketNumber);
    }

    const { sendTelegramMessage } = await import("@/lib/telegram/core");
    const { renderTemplateByKey } = await import("@/lib/message-templates");
    for (const [userId, numbers] of byUser) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { telegramId: true } });
      if (user?.telegramId) {
        const message = await renderTemplateByKey("bilet_numara_atandi", {
          etkinlikAdi: event.title,
          numaralar: numbers.join(", "),
        });
        await sendTelegramMessage(Number(user.telegramId), message).catch(() => {});
      }
    }

    return NextResponse.json({
      success: true,
      generatedCount: ticketNumbersData.length,
      skippedRequestIds: skipped,
      event: result,
    });
  } catch (error) {
    console.error("Bilet numarası oluşturma hatası:", error);
    return NextResponse.json({ error: "Bilet numaraları oluşturulamadı" }, { status: 500 });
  }
}
