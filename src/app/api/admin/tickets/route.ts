import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin-middleware";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { generateUniqueSlug } from "@/lib/slug";

// GET - Aktif bilet etkinliklerini listele
export async function GET(req: NextRequest) {
  try {
    const { admin, error } = await requirePermission(req, 'canAccessTickets');
    if (error) return error;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "active";

    // 🚀 OPTIMIZED: Add limit to prevent memory issues (even though events are typically few)
    const events = await prisma.ticketEvent.findMany({
      where: {
        status: status,
      },
      include: {
        sponsor: true,
        prizes: {
          orderBy: { order: "asc" },
        },
        _count: {
          select: {
            requests: true,
            ticketNumbers: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100, // Max 100 events (plenty for admin panel)
    });

    return NextResponse.json({ events });
  } catch (error) {
    console.error("Bilet etkinlikleri listeleme hatası:", error);
    return NextResponse.json(
      { error: "Bilet etkinlikleri listelenemedi" },
      { status: 500 }
    );
  }
}

// POST - Yeni bilet etkinliği oluştur
export async function POST(req: NextRequest) {
  try {
    const { admin, error } = await requirePermission(req, 'canAccessTickets');
    if (error) return error;

    const eventSchema = z.object({
      title: z.string().min(1, "Başlık gerekli"),
      description: z.string().optional(),
      sponsorId: z.string().min(1, "Sponsor seçimi gerekli"),
      totalTickets: z.number().min(1, "En az 1 bilet olmalı").nullable(),
      ticketPrice: z.number().min(1, "Bilet fiyatı 0'dan büyük olmalı"),
      endDate: z.string().min(1).nullable(),
      imageUrl: z.string().nullable().optional(),
      requireApprovedSponsor: z.boolean().optional(),
      prizes: z.array(
        z.object({
          prizeAmount: z.number().min(1),
          winnerCount: z.number().min(1),
        })
      ).min(1, "En az 1 ödül tanımlanmalı"),
    });

    const body = await req.json();
    const data = eventSchema.parse(body);

    // Detay sayfası URL'i başlıktan türetilen bir slug kullanıyor
    const slug = await generateUniqueSlug(data.title, async (candidate) => {
      const existing = await prisma.ticketEvent.findUnique({ where: { slug: candidate } })
      return !!existing
    })

    // Bilet etkinliğini oluştur
    // endDate string'i Türkiye saatinde gelir, UTC'ye çevirmek için +03:00 offset ekliyoruz
    const event = await prisma.ticketEvent.create({
      data: {
        title: data.title,
        slug,
        description: data.description,
        sponsorId: data.sponsorId,
        totalTickets: data.totalTickets,
        ticketPrice: data.ticketPrice,
        endDate: data.endDate ? new Date(data.endDate + '+03:00') : null,
        imageUrl: data.imageUrl || null,
        requireApprovedSponsor: data.requireApprovedSponsor ?? false,
        prizes: {
          create: data.prizes.map((prize, index) => ({
            prizeAmount: prize.prizeAmount,
            winnerCount: prize.winnerCount,
            order: index,
          })),
        },
      },
      include: {
        sponsor: true,
        prizes: true,
      },
    });

    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    console.error("Bilet etkinliği oluşturma hatası:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Geçersiz veri", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Bilet etkinliği oluşturulamadı" },
      { status: 500 }
    );
  }
}
