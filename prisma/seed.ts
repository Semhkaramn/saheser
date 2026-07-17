import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting seed...')

  // 🎡 Çark Ödülleri (6 adet)
  console.log('🎯 Creating wheel prizes...')
  const wheelPrizes = [
    { name: '100 Puan', points: 100, probability: 10, color: '#3B82F6', order: 0 },
    { name: '250 Puan', points: 250, probability: 5, color: '#8B5CF6', order: 1 },
    { name: '500 Puan', points: 500, probability: 1, color: '#EC4899', order: 2 },
    { name: '1000 Puan', points: 1000, probability: 0.3, color: '#F59E0B', order: 3 },
    { name: '2500 Puan', points: 2500, probability: 0.2, color: '#10B981', order: 4 },
    { name: '5000 Puan', points: 5000, probability: 0.1, color: '#EF4444', order: 5 },
  ]

  for (const prize of wheelPrizes) {
    await prisma.wheelPrize.upsert({
      where: { name: prize.name },
      update: prize,
      create: prize
    })
  }
  console.log('✅ Wheel prizes created!')

  // 🏆 Rütbeler (Seviye Sistemi)
  console.log('🏅 Creating ranks...')
  const ranks = [
    { name: 'Çaylak', minXp: 1000, icon: '⚡', color: '#60A5FA', order: 1, pointsReward: 500 },
    { name: 'Deneyimli', minXp: 2500, icon: '🔥', color: '#A78BFA', order: 2, pointsReward: 1000 },
    { name: 'Usta', minXp: 5000, icon: '💎', color: '#F472B6', order: 3, pointsReward: 2000 },
    { name: 'Elit', minXp: 10000, icon: '👑', color: '#FBBF24', order: 4, pointsReward: 4000 },
    { name: 'Efsane', minXp: 20000, icon: '⭐', color: '#34D399', order: 5, pointsReward: 8000 },
    { name: 'EJDERİYA', minXp: 40000, icon: '🌟', color: '#EF4444', order: 6, pointsReward: 16000 },
  ]

  for (const rank of ranks) {
    try {
      await prisma.rank.upsert({
        where: { name: rank.name },
        update: rank,
        create: rank
      })
    } catch (error) {
      // ⚠️ FIX: Tek bir rütbe kaydındaki çakışma (örn. minXp veritabanında
      // başka bir kayda ait olabilir - elle yapılmış bir değişiklikten kalma)
      // eskiden TÜM build'i durduruyordu. Artık sadece uyarı verip devam
      // ediyor - deploy bu yüzden hiç kesilmesin.
      console.warn(`⚠️  Rütbe atlanıyor (çakışma var): ${rank.name}`, error instanceof Error ? error.message : error)
    }
  }
  console.log('✅ Ranks created!')

  // 👨‍💼 Super Admin (Varsayılan admin hesabı)
  // ✅ FIX: Artık .env'deki ADMIN_USERNAME/ADMIN_PASSWORD okunuyor - önceden
  // burada sabit (hardcoded) bir kullanıcı adı/şifre vardı ve .env'de yazan
  // değerle UYUŞMUYORDU (örn. .env'de "semhkaramn" yazarken burada
  // "Semhkaramn" olarak üretiliyordu) - bu yüzden .env'i değiştirmenin hiç
  // etkisi olmuyordu. Şimdi ikisi her zaman aynı.
  console.log('👨‍💼 Creating super admin...')
  const adminUsername = process.env.ADMIN_USERNAME || 'admin'
  const adminPassword = process.env.ADMIN_PASSWORD || 'changeme'
  const hashedPassword = await bcrypt.hash(adminPassword, 10)

  await prisma.admin.upsert({
    where: { username: adminUsername },
    update: {
      passwordHash: hashedPassword,
      isSuperAdmin: true,
      canAccessUsers: true,
      canAccessTasks: true,
      canAccessShop: true,
      canAccessWheel: true,
      canAccessSponsors: true,
      canAccessAds: true,
      canAccessRanks: true,
      canAccessSettings: true,
      canAccessAdmins: true,
      canAccessTickets: true,
      canAccessEvents: true,
      canAccessPromocodes: true,
      canAccessActivityLogs: true,
    },
    create: {
      username: adminUsername,
      passwordHash: hashedPassword,
      isSuperAdmin: true,
      canAccessUsers: true,
      canAccessTasks: true,
      canAccessShop: true,
      canAccessWheel: true,
      canAccessSponsors: true,
      canAccessAds: true,
      canAccessRanks: true,
      canAccessSettings: true,
      canAccessAdmins: true,
      canAccessTickets: true,
      canAccessEvents: true,
      canAccessPromocodes: true,
      canAccessActivityLogs: true,
    }
  })
  console.log('✅ Super admin created!')
  console.log('   👤 Kullanıcı adı: ' + adminUsername)
  console.log('   🔑 Şifre: ' + adminPassword)

  // ⚙️ Settings (Sadece bildirimler ve dinamik UI ayarları)
  // NOT: Bot, çark, puan/XP ayarları .env dosyasındadır
  console.log('⚙️ Creating settings...')
  const settings = [
    // Bildirim Ayarları
    { key: 'notify_order_approved', value: 'true', description: 'Market siparişi onaylandığında kullanıcıya bildirim gönder', category: 'notifications' },
    { key: 'notify_level_up', value: 'true', description: 'Kullanıcı seviye atladığında grupta bildirim göster', category: 'notifications' },
    { key: 'notify_wheel_reset', value: 'true', description: 'Şans çarkı sıfırlandığında kullanıcılara bildirim gönder', category: 'notifications' },
    { key: 'roll_enabled', value: 'true', description: 'Roll sistemi komutlarını aktif et', category: 'notifications' },

    // Dinamik UI Ayarları
    { key: 'sponsor_banner_enabled', value: 'true', description: 'Sponsor banner gösterilsin mi', category: 'general' },
    { key: 'popup_enabled', value: 'false', description: 'Popup gösterilsin mi', category: 'general' },
    { key: 'popup_data', value: '{}', description: 'Popup içeriği (JSON)', category: 'general' },

  ]

  for (const setting of settings) {
    await prisma.settings.upsert({
      where: { key: setting.key },
      update: { value: setting.value, description: setting.description, category: setting.category },
      create: setting
    })
  }
  console.log('✅ Settings created!')

  // 🤖 Bot Modülleri (hepsi varsayılan olarak açık)
  console.log('🤖 Creating bot system toggles...')
  const botSystems = [
    'broadcast', 'randy', 'classic_giveaway', 'roll', 'auto_tag',
    'weekly_rewards', 'activity_rewards', 'gpt', 'cross_ban',
    'sponsor_approval', 'purchase_approval',
  ]
  for (const key of botSystems) {
    await prisma.botSystemSetting.upsert({
      where: { key },
      update: {},
      create: { key, enabled: true }
    })
  }
  console.log('✅ Bot system toggles created!')

  console.log('🎉 Seed completed!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
