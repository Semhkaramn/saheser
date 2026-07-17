import { PrismaClient } from '@prisma/client'
import { generateUniqueSlug } from '../src/lib/slug'

const prisma = new PrismaClient()

// ✅ Tek seferlik backfill: slug alanı eklenmeden önce oluşturulmuş
// promosyon/deneme bonusu, market ürünü ve etkinlik kayıtlarına isimlerinden
// türetilmiş bir slug atar. Yeni kayıtlar zaten oluşturulurken otomatik slug
// alıyor - bu script sadece geçmiş verileri tamamlamak için.
async function backfillSlugs() {
  try {
    console.log('🔗 Promosyonlar/Deneme Bonusları için slug üretiliyor...')
    const promotions = await prisma.promotion.findMany({ where: { slug: null } })
    for (const promo of promotions) {
      const slug = await generateUniqueSlug(promo.name, async (candidate) => {
        const existing = await prisma.promotion.findFirst({ where: { type: promo.type, slug: candidate } })
        return !!existing
      })
      await prisma.promotion.update({ where: { id: promo.id }, data: { slug } })
      console.log(`  ✅ [${promo.type}] ${promo.name} -> ${slug}`)
    }

    console.log('🔗 Market ürünleri için slug üretiliyor...')
    const shopItems = await prisma.shopItem.findMany({ where: { slug: null } })
    for (const item of shopItems) {
      const slug = await generateUniqueSlug(item.name, async (candidate) => {
        const existing = await prisma.shopItem.findUnique({ where: { slug: candidate } })
        return !!existing
      })
      await prisma.shopItem.update({ where: { id: item.id }, data: { slug } })
      console.log(`  ✅ ${item.name} -> ${slug}`)
    }

    console.log('🔗 Etkinlikler için slug üretiliyor...')
    const events = await prisma.event.findMany({ where: { slug: null } })
    for (const event of events) {
      const slug = await generateUniqueSlug(event.title, async (candidate) => {
        const existing = await prisma.event.findUnique({ where: { slug: candidate } })
        return !!existing
      })
      await prisma.event.update({ where: { id: event.id }, data: { slug } })
      console.log(`  ✅ ${event.title} -> ${slug}`)
    }

    console.log('🔗 Bilet etkinlikleri için slug üretiliyor...')
    const ticketEvents = await prisma.ticketEvent.findMany({ where: { slug: null } })
    for (const ticketEvent of ticketEvents) {
      const slug = await generateUniqueSlug(ticketEvent.title, async (candidate) => {
        const existing = await prisma.ticketEvent.findUnique({ where: { slug: candidate } })
        return !!existing
      })
      await prisma.ticketEvent.update({ where: { id: ticketEvent.id }, data: { slug } })
      console.log(`  ✅ ${ticketEvent.title} -> ${slug}`)
    }

    console.log(`🎉 Tamamlandı! ${promotions.length} promosyon, ${shopItems.length} ürün, ${events.length} etkinlik, ${ticketEvents.length} bilet etkinliği güncellendi.`)
  } catch (error) {
    console.error('❌ Hata:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

backfillSlugs().catch(console.error)
