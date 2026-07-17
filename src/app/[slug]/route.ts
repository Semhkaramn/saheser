import { NextRequest, NextResponse } from 'next/server'
import { getShortLinkBySlug, recordClick } from '@/lib/services/short-links'

// Örn: site.com/deneme -> kayıtlı hedef adrese yönlendirir ve tıklanmayı kaydeder.
// Bilinmeyen bir slug gelirse ana sayfaya döner.
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ slug: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const { slug } = await params
  const link = await getShortLinkBySlug(slug)

  if (!link) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  // Yönlendirmeyi bekletmeden yap, tıklanma kaydı arka planda tamamlansın.
  recordClick(link.id, {
    referrer: req.headers.get('referer') || undefined,
    userAgent: req.headers.get('user-agent') || undefined,
  }).catch(() => {})

  return NextResponse.redirect(link.targetUrl)
}
