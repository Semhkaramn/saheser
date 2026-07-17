import { prisma } from '@/lib/prisma'

const SLUG_RE = /^[a-zA-Z0-9-_]+$/

export function normalizeSlug(raw: string): string {
  return raw.trim().replace(/^\/+/, '').toLowerCase()
}

export function isValidSlug(slug: string): boolean {
  return slug.length > 0 && slug.length <= 64 && SLUG_RE.test(slug)
}

export function normalizeTargetUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`
  return trimmed
}

export async function listShortLinks(q?: string) {
  return prisma.shortLink.findMany({
    where: q
      ? {
          OR: [
            { slug: { contains: q, mode: 'insensitive' } },
            { title: { contains: q, mode: 'insensitive' } },
            { targetUrl: { contains: q, mode: 'insensitive' } },
          ],
        }
      : undefined,
    orderBy: { createdAt: 'desc' },
  })
}

export async function getShortLinkBySlug(slug: string) {
  return prisma.shortLink.findUnique({ where: { slug } })
}

export async function createShortLink(data: { slug: string; targetUrl: string; title?: string | null }) {
  const slug = normalizeSlug(data.slug)
  if (!isValidSlug(slug)) {
    throw new Error('Geçersiz slug — sadece harf, rakam, - ve _ kullanılabilir.')
  }
  const existing = await getShortLinkBySlug(slug)
  if (existing) throw new Error('Bu slug zaten kullanılıyor.')

  return prisma.shortLink.create({
    data: {
      slug,
      targetUrl: normalizeTargetUrl(data.targetUrl),
      title: data.title?.trim() || null,
    },
  })
}

export async function updateShortLink(
  id: string,
  data: Partial<{ slug: string; targetUrl: string; title: string | null }>
) {
  const patch: { slug?: string; targetUrl?: string; title?: string | null } = {}

  if (data.slug !== undefined) {
    const slug = normalizeSlug(data.slug)
    if (!isValidSlug(slug)) throw new Error('Geçersiz slug — sadece harf, rakam, - ve _ kullanılabilir.')
    const existing = await getShortLinkBySlug(slug)
    if (existing && existing.id !== id) throw new Error('Bu slug zaten kullanılıyor.')
    patch.slug = slug
  }
  if (data.targetUrl !== undefined) patch.targetUrl = normalizeTargetUrl(data.targetUrl)
  if (data.title !== undefined) patch.title = data.title?.trim() || null

  return prisma.shortLink.update({ where: { id }, data: patch })
}

export async function deleteShortLink(id: string) {
  await prisma.shortLinkClick.deleteMany({ where: { shortLinkId: id } })
  return prisma.shortLink.delete({ where: { id } })
}

export async function recordClick(shortLinkId: string, meta?: { referrer?: string; userAgent?: string }) {
  await prisma.$transaction([
    prisma.shortLinkClick.create({
      data: { shortLinkId, referrer: meta?.referrer, userAgent: meta?.userAgent },
    }),
    prisma.shortLink.update({
      where: { id: shortLinkId },
      data: { clickCount: { increment: 1 } },
    }),
  ])
}

export async function getShortLinkStats(shortLinkId: string, days = 14) {
  const since = new Date()
  since.setDate(since.getDate() - days)

  const clicks = await prisma.shortLinkClick.findMany({
    where: { shortLinkId, clickedAt: { gte: since } },
    select: { clickedAt: true },
    orderBy: { clickedAt: 'asc' },
  })

  const dailyMap = new Map<string, number>()
  for (const c of clicks) {
    const key = c.clickedAt.toISOString().slice(0, 10)
    dailyMap.set(key, (dailyMap.get(key) ?? 0) + 1)
  }

  const daily: { date: string; count: number }[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    daily.push({ date: key, count: dailyMap.get(key) ?? 0 })
  }

  const link = await prisma.shortLink.findUnique({ where: { id: shortLinkId } })
  const today = new Date().toISOString().slice(0, 10)
  const last7 = daily.slice(-7).reduce((s, x) => s + x.count, 0)

  return {
    totalClicks: link?.clickCount ?? 0,
    todayClicks: dailyMap.get(today) ?? 0,
    last7DaysClicks: last7,
    daily,
  }
}
