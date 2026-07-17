import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Detay sayfası artık rastgele ID yerine isimden türetilmiş bir slug kullanıyor
// (örn. /deneme-bonuslari/deneme-bonusu-kayip). type query param'ı zorunlu,
// çünkü slug benzersizliği type bazında (Deneme Bonusu / Promosyon ayrı ayrı).
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const type = request.nextUrl.searchParams.get('type')

    let item = type
      ? await prisma.promotion.findFirst({
          where: { type, slug },
          include: { sponsor: { select: { name: true, logoUrl: true, websiteUrl: true, isActive: true } } },
        })
      : null

    // Geriye dönük uyumluluk: eski linkler hâlâ ID ile geliyor olabilir,
    // veya slug henüz üretilmemiş eski bir kayıt olabilir - ID ile de dene.
    if (!item) {
      item = await prisma.promotion.findUnique({
        where: { id: slug },
        include: { sponsor: { select: { name: true, logoUrl: true, websiteUrl: true, isActive: true } } },
      })
    }

    if (!item || !item.isActive || (item.sponsor && !item.sponsor.isActive)) {
      return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 })
    }

    return NextResponse.json({ item })
  } catch (error) {
    console.error('Promotion detail fetch error:', error)
    return NextResponse.json({ error: 'Bir hata oluştu' }, { status: 500 })
  }
}
