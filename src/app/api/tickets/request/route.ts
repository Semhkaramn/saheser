import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram/core";
import { z } from "zod";
import { logTicketRequest, extractRequestInfo } from "@/lib/services/activity-log-service";
import { renderTemplateByKey } from "@/lib/message-templates";

// POST - Bilete katıl (randy-web'deki gibi): onaylı sponsor bilgisi varsa TEK
// TIKLA katılım. Form doldurma, yatırım tutarı girme YOK.
//
// Bilet numarası burada VERİLMEZ. Akış şöyle:
// 1. Etkinlik "aktif"ken kullanıcılar sadece katılır (bu route).
// 2. Admin etkinliği "beklemede"ye alır (yeni katılım durur).
// 3. Admin her katılımcının GERÇEK yatırım tutarını girer.
// 4. Admin "bilet numaralarını oluştur"a basar: yatırım/bilet fiyatına göre
//    herkese kaç bilet düşeceği hesaplanır, 1000'den başlayan numara havuzu
//    karıştırılıp katılımcılara dağıtılır.
// 5. Admin ödülleri bilet numarasıyla eşleştirip biteti sonlandırır.
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req);

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, telegramId: true, emailVerified: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
    }

    if (!user.telegramId || !user.emailVerified) {
      return NextResponse.json(
        {
          error: "Bilete katılmak için Telegram bağlantısı ve email doğrulaması gereklidir",
          requiresVerification: true,
          needsTelegram: !user.telegramId,
          needsEmail: !user.emailVerified,
        },
        { status: 403 }
      );
    }

    const schema = z.object({ eventId: z.string().min(1, "Etkinlik ID gerekli") });
    const { eventId } = schema.parse(await req.json());

    const event = await prisma.ticketEvent.findUnique({
      where: { id: eventId },
      include: { sponsor: true },
    });

    if (!event) {
      return NextResponse.json({ error: "Bilet etkinliği bulunamadı" }, { status: 404 });
    }
    if (event.status !== "active") {
      return NextResponse.json({ error: "Bu etkinlik artık yeni katılıma kapalı" }, { status: 400 });
    }
    // endDate null ise ("Süresiz") hiç süre kontrolü yapılmaz - sadece bilet
    // biterse ya da admin elle bitirirse katılım kapanır.
    if (event.endDate && new Date(event.endDate) < new Date()) {
      return NextResponse.json({ error: "Bu etkinliğin süresi dolmuş" }, { status: 400 });
    }

    // Zaten katılmış mı?
    const existing = await prisma.ticketRequest.findFirst({
      where: { eventId, userId: session.userId },
    });
    if (existing) {
      return NextResponse.json({ error: "Bu etkinliğe zaten katıldınız" }, { status: 400 });
    }

    // Sponsor bilgisi her zaman GİRİLMİŞ olmalı (etkinliklerdeki gibi).
    // "ONAYLANMIŞ" olması ise artık admin'in etkinlik bazında açıp
    // kapatabildiği bir şart (requireApprovedSponsor) - eskiden bu her zaman
    // zorunluydu, esneklik yoktu.
    const sponsorInfo = await prisma.userSponsorInfo.findUnique({
      where: { userId_sponsorId: { userId: session.userId, sponsorId: event.sponsorId } },
    });

    if (!sponsorInfo) {
      return NextResponse.json(
        { error: "Önce sponsor bilgilerinizi kaydetmelisiniz", needsSponsorInfo: true },
        { status: 400 }
      );
    }
    if (event.requireApprovedSponsor && sponsorInfo.status !== "approved") {
      return NextResponse.json(
        {
          error:
            sponsorInfo.status === "pending"
              ? "Sponsor bilginiz henüz onaylanmadı, lütfen bekleyin"
              : "Sponsor bilginiz onaylanmadı, lütfen bilgilerinizi kontrol edip tekrar deneyin",
          sponsorStatus: sponsorInfo.status,
        },
        { status: 400 }
      );
    }

    // Sadece katılımcı olarak kaydet - yatırım tutarı ve bilet numarası YOK henüz
    const ticketRequest = await prisma.ticketRequest.create({
      data: {
        eventId,
        userId: session.userId,
        sponsorInfo: sponsorInfo.identifier,
        investmentAmount: 0,
        investmentDate: new Date(),
        status: "approved",
      },
    });

    // Activity log
    const requestInfo = extractRequestInfo(req);
    await logTicketRequest(
      session.userId,
      ticketRequest.id,
      event.title,
      sponsorInfo.identifier,
      0,
      requestInfo
    );

    // Kullanıcıya bildirim
    if (user.telegramId) {
      const message = await renderTemplateByKey("bilet_katilim", { etkinlikAdi: event.title });
      await sendTelegramMessage(Number(user.telegramId), message).catch(() => {});
    }

    return NextResponse.json({ request: ticketRequest }, { status: 201 });
  } catch (error) {
    console.error("Bilet katılım hatası:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Geçersiz veri", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Bilete katılınamadı" }, { status: 500 });
  }
}
