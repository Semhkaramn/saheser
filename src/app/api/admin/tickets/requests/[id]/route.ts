import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin-middleware";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

type Params = {
  params: Promise<{ id: string }>;
};

// PUT - Katılımcının gerçek yatırım tutarını gir/güncelle.
//
// Bilet numarası zaten oluşturulmuşsa da tutar değiştirilebilir (yanlış
// yazılmış olabilir) - ama bu durumda o katılımcının ESKİ bilet numaraları
// otomatik olarak SİLİNİR (etkinliğin satılan bilet sayısından düşülür).
// Yeni tutara göre doğru sayıda bilet, admin "Bilet Numaralarını Oluştur"a
// tekrar bastığında verilir. Bu, hatalı girilen bir tutarın düzeltilebilmesi
// için gerekli - numaraları "kilitli" tutmak yerine tutarsızlık oluşursa
// eski numaraları iptal edip yeniden dağıtıma açıyoruz.
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { error } = await requirePermission(req, 'canAccessTickets');
    if (error) return error;

    const { id } = await params;
    const schema = z.object({ investmentAmount: z.number().min(0) });
    const { investmentAmount } = schema.parse(await req.json());

    const request = await prisma.ticketRequest.findUnique({
      where: { id },
      include: { ticketNumbers: true },
    });

    if (!request) {
      return NextResponse.json({ error: "Katılımcı bulunamadı" }, { status: 404 });
    }

    const hadNumbers = request.ticketNumbers.length > 0;

    const updated = await prisma.$transaction(async (tx) => {
      if (hadNumbers) {
        // Eski bilet numaralarını iptal et, satılan bilet sayısından düş
        await tx.ticketNumber.deleteMany({ where: { requestId: id } });
        await tx.ticketEvent.update({
          where: { id: request.eventId },
          data: { soldTickets: { decrement: request.ticketNumbers.length } },
        });
      }

      return tx.ticketRequest.update({
        where: { id },
        data: { investmentAmount },
      });
    });

    return NextResponse.json({
      success: true,
      request: updated,
      previousTicketNumbersCancelled: hadNumbers ? request.ticketNumbers.map((t) => t.ticketNumber) : [],
    });
  } catch (error) {
    console.error("Yatırım tutarı güncelleme hatası:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Geçersiz veri", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Güncellenemedi" }, { status: 500 });
  }
}

// DELETE - Katılımcıyı etkinlikten çıkar. Bilet numarası varsa onlar da
// silinir ve satılan bilet sayısından düşülür (hatalı katılımı tamamen
// geri almak için).
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { error } = await requirePermission(req, 'canAccessTickets');
    if (error) return error;

    const { id } = await params;
    const request = await prisma.ticketRequest.findUnique({
      where: { id },
      include: { ticketNumbers: true },
    });

    if (!request) {
      return NextResponse.json({ error: "Katılımcı bulunamadı" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      if (request.ticketNumbers.length > 0) {
        await tx.ticketNumber.deleteMany({ where: { requestId: id } });
        await tx.ticketEvent.update({
          where: { id: request.eventId },
          data: { soldTickets: { decrement: request.ticketNumbers.length } },
        });
      }
      await tx.ticketRequest.delete({ where: { id } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Katılımcı silme hatası:", error);
    return NextResponse.json({ error: "Silinemedi" }, { status: 500 });
  }
}
