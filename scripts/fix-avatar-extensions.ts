import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ✅ Tek seferlik düzeltme: profil avatar seçim listesi yanlışlıkla
// "/avatar/N.webp" yolu üretiyordu ama public/avatar/ klasöründeki gerçek
// dosyalar "/avatar/N.svg". Bu yüzden daha önce avatar seçmiş kullanıcıların
// veritabanında hâlâ kırık (olmayan) .webp yolu kayıtlı - bu script onları
// var olan .svg karşılığına çevirir. Bir kere çalıştırmak yeterli.
async function fixAvatarExtensions() {
  try {
    console.log('🖼️  Kırık .webp avatar yolları taranıyor...')

    const users = await prisma.user.findMany({
      where: { avatar: { endsWith: '.webp', startsWith: '/avatar/' } },
      select: { id: true, avatar: true },
    })

    console.log(`🔍 ${users.length} kullanıcıda kırık avatar yolu bulundu`)

    for (const user of users) {
      const fixedAvatar = user.avatar!.replace(/\.webp$/, '.svg')
      await prisma.user.update({
        where: { id: user.id },
        data: { avatar: fixedAvatar },
      })
      console.log(`  ✅ ${user.id}: ${user.avatar} -> ${fixedAvatar}`)
    }

    console.log('🎉 Tamamlandı!')
  } catch (error) {
    console.error('❌ Hata:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

fixAvatarExtensions().catch(console.error)
