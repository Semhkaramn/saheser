import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-middleware";

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAdmin(req);

    // Admin kontrolü - hata varsa döndür
    if (authResult.error) {
      return authResult.error;
    }

    const body = await req.json();
    const {
      format = 'csv',
      includeSponsors = false,
      includePurchases = false,
      includeWheelSpins = false,
      includeEventParticipations = false,
      includeTicketRequests = false,
    } = body;

    // Tüm kullanıcıları al - Timeout ile
    // İlişkisel verileri ayrı sorgularla alalım (daha güvenilir)
    const baseSelect = {
      id: true,
      siteUsername: true,
      email: true,
      emailVerified: true,
      telegramId: true,
      telegramUsername: true,
      firstName: true,
      lastName: true,
      points: true,
      xp: true,
      // totalMessages artık TelegramGroupUser tablosunda - ilişki ile alalım
      telegramGroupUser: {
        select: {
          messageCount: true,
        },
      },
      isBanned: true,
      banReason: true,
      createdAt: true,
      updatedAt: true,
    };

    // İlişkisel veri seçeneklerini dinamik olarak ekle
    const selectWithRelations: any = { ...baseSelect };

    if (includeSponsors) {
      selectWithRelations.sponsorInfos = {
        select: {
          sponsor: { select: { name: true } },
          identifier: true,
        },
      };
    }

    if (includePurchases) {
      selectWithRelations.purchases = {
        select: {
          id: true,
          status: true,
          createdAt: true,
          item: { select: { name: true, price: true } },
        },
        take: 100, // Son 100 satın alma ile sınırla
      };
    }

    if (includeWheelSpins) {
      selectWithRelations.wheelSpins = {
        select: {
          id: true,
        },
      };
    }

    if (includeEventParticipations) {
      selectWithRelations.eventParticipations = {
        select: {
          event: { select: { title: true } },
          createdAt: true,
        },
        take: 50, // Son 50 etkinlik ile sınırla
      };
    }

    if (includeTicketRequests) {
      selectWithRelations.ticketRequests = {
        select: {
          event: { select: { title: true } },
          investmentAmount: true,
          status: true,
          createdAt: true,
        },
        take: 50, // Son 50 bilet ile sınırla
      };
    }

    const users = await prisma.user.findMany({
      select: selectWithRelations,
      orderBy: { createdAt: 'desc' },
      take: 10000, // Maksimum 10000 kullanıcı (güvenlik sınırı)
    });

    // CSV formatında hazırla
    if (format === 'csv') {
      const headers = [
        'ID',
        'Site Kullanıcı Adı',
        'Email',
        'Email Doğrulandı',
        'Telegram ID',
        'Telegram Kullanıcı Adı',
        'Ad',
        'Soyad',
        'Puan',
        'XP',
        'Toplam Mesaj',
        'Banlı',
        'Ban Nedeni',
        'Kayıt Tarihi',
      ];

      if (includeSponsors) headers.push('Sponsor Bilgileri');
      if (includePurchases) headers.push('Satın Almalar');
      if (includeWheelSpins) headers.push('Çark Çevirmeleri');
      if (includeEventParticipations) headers.push('Etkinlik Katılımları');
      if (includeTicketRequests) headers.push('Bilet Talepleri');

      const rows = users.map((user: any) => {
        const row = [
          user.id,
          user.siteUsername || '',
          user.email || '',
          user.emailVerified ? 'Evet' : 'Hayır',
          user.telegramId || '',
          user.telegramUsername || '',
          user.firstName || '',
          user.lastName || '',
          user.points,
          user.xp,
          user.telegramGroupUser?.messageCount ?? 0,
          user.isBanned ? 'Evet' : 'Hayır',
          user.banReason || '',
          new Date(user.createdAt).toLocaleDateString('tr-TR'),
        ];

        if (includeSponsors) {
          const sponsorInfo = user.sponsorInfos
            ?.map((s: any) => `${s.sponsor.name}: ${s.identifier}`)
            .join('; ') || '';
          row.push(sponsorInfo);
        }

        if (includePurchases) {
          const purchases = user.purchases
            ?.map((p: any) => `${p.item.name} (${p.status})`)
            .join('; ') || '';
          row.push(purchases);
        }

        if (includeWheelSpins) {
          const spins = user.wheelSpins?.length || 0;
          row.push(`${spins} çevirme`);
        }

        if (includeEventParticipations) {
          const events = user.eventParticipations
            ?.map((e: any) => e.event.title)
            .join('; ') || '';
          row.push(events);
        }

        if (includeTicketRequests) {
          const tickets = user.ticketRequests
            ?.map((t: any) => `${t.event.title} - ${t.investmentAmount}₺ (${t.status})`)
            .join('; ') || '';
          row.push(tickets);
        }

        return row;
      });

      // CSV oluştur
      const escapeCSV = (value: any) => {
        const str = String(value ?? '');
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const csvContent = [
        headers.map(escapeCSV).join(','),
        ...rows.map(row => row.map(escapeCSV).join(',')),
      ].join('\n');

      // BOM ekleyerek UTF-8 encoding sorunlarını çöz
      const bom = '\uFEFF';
      const csvWithBom = bom + csvContent;

      return new NextResponse(csvWithBom, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="kullanicilar_${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    // JSON formatı (Excel için daha kolay dönüştürülebilir)
    if (format === 'json') {
      const jsonData = users.map((user: any) => {
        const baseData: any = {
          'ID': user.id,
          'Site Kullanıcı Adı': user.siteUsername || '',
          'Email': user.email || '',
          'Email Doğrulandı': user.emailVerified ? 'Evet' : 'Hayır',
          'Telegram ID': user.telegramId || '',
          'Telegram Kullanıcı Adı': user.telegramUsername || '',
          'Ad': user.firstName || '',
          'Soyad': user.lastName || '',
          'Puan': user.points,
          'XP': user.xp,
          'Toplam Mesaj': user.telegramGroupUser?.messageCount ?? 0,
          'Banlı': user.isBanned ? 'Evet' : 'Hayır',
          'Ban Nedeni': user.banReason || '',
          'Kayıt Tarihi': new Date(user.createdAt).toLocaleDateString('tr-TR'),
        };

        if (includeSponsors && user.sponsorInfos) {
          baseData['Sponsor Bilgileri'] = user.sponsorInfos
            .map((s: any) => `${s.sponsor.name}: ${s.identifier}`)
            .join('; ');
        }

        if (includePurchases && user.purchases) {
          baseData['Satın Almalar'] = user.purchases
            .map((p: any) => `${p.item.name} (${p.status})`)
            .join('; ');
        }

        if (includeWheelSpins && user.wheelSpins) {
          baseData['Çark Çevirmeleri'] = `${user.wheelSpins.length} çevirme`;
        }

        if (includeEventParticipations && user.eventParticipations) {
          baseData['Etkinlik Katılımları'] = user.eventParticipations
            .map((e: any) => e.event.title)
            .join('; ');
        }

        if (includeTicketRequests && user.ticketRequests) {
          baseData['Bilet Talepleri'] = user.ticketRequests
            .map((t: any) => `${t.event.title} - ${t.investmentAmount}₺ (${t.status})`)
            .join('; ');
        }

        return baseData;
      });

      return NextResponse.json({
        data: jsonData,
        count: jsonData.length,
        exportedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({ error: 'Geçersiz format' }, { status: 400 });
  } catch (error) {
    console.error('Export error:', error);

    // Daha detaylı hata mesajı
    const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';

    // Timeout hatası kontrolü
    if (errorMessage.includes('timeout') || errorMessage.includes('Connection')) {
      return NextResponse.json({
        error: 'Export işlemi zaman aşımına uğradı. Daha az seçenek ile tekrar deneyin.'
      }, { status: 504 });
    }

    return NextResponse.json({
      error: 'Export işlemi başarısız',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    }, { status: 500 });
  }
}
