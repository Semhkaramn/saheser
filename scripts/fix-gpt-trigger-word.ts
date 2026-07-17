import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ✅ GPT sohbet özelliğinin tetikleyici kelimesi "harley" olarak
// güncellendi, ama bu sadece YENİ oluşturulan grup ayarları için geçerli -
// zaten var olan gruplarda hâlâ eski "bot" kelimesi kayıtlı duruyordu.
// Bu script mevcut kayıtları günceller.
async function fixGptTriggerWord() {
  try {
    const result = await prisma.gptSettings.updateMany({
      where: { triggerWord: 'bot' },
      data: { triggerWord: 'harley' },
    })
    console.log(`✅ ${result.count} grubun GPT tetikleyici kelimesi "harley" olarak güncellendi`)
  } catch (error) {
    console.error('❌ Hata:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

fixGptTriggerWord().catch(console.error)
