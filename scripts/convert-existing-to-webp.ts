import { v2 as cloudinary } from 'cloudinary'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

// ⚠️ ÖNEMLİ: Next.js .env dosyasını otomatik okur ama düz bir node/tsx
// script'i OKUMAZ - bu yüzden .env dosyasını koymak tek başına yetmiyordu.
// Burada elle okuyup process.env'e yüklüyoruz (ekstra paket gerekmesin diye).
function loadDotEnv() {
  const envPath = join(process.cwd(), '.env')
  if (!existsSync(envPath)) return

  const content = readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue
    const key = trimmed.slice(0, eqIndex).trim()
    let value = trimmed.slice(eqIndex + 1).trim()
    // Tırnak işaretlerini temizle ("VALUE" veya 'VALUE' yazılmışsa)
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

loadDotEnv()

// ✅ Cloudinary'de ZATEN yüklü olan tüm PNG/JPEG/GIF dosyalarını WebP'ye
// çevirir (aynı public_id ile üzerine yazar - overwrite). Veritabanındaki
// URL'lere (logoUrl, imageUrl, photoUrl vb.) HİÇ dokunmuyoruz ve dokunmaya
// gerek yok: Cloudinary, URL'deki uzantı ne olursa olsun (isteğe bağlı .png
// yazsa bile) her zaman anlık olarak doğru formatı sunuyor - biz sadece asıl
// depolanan/varsayılan boyutu küçültmüş oluyoruz.
//
// Çalıştırmak için (CLOUDINARY_* env değişkenleri tanımlı olmalı):
//   bun scripts/convert-existing-to-webp.ts
// veya
//   npx tsx scripts/convert-existing-to-webp.ts

const cloudName = process.env.CLOUDINARY_CLOUD_NAME
const apiKey = process.env.CLOUDINARY_API_KEY
const apiSecret = process.env.CLOUDINARY_API_SECRET

if (!cloudName || !apiKey || !apiSecret) {
  console.error('❌ CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET env değişkenleri eksik.')
  process.exit(1)
}

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
})

const CONVERTIBLE_FORMATS = ['png', 'jpg', 'jpeg', 'gif']

async function convertAllToWebp() {
  let nextCursor: string | undefined = undefined
  let totalConverted = 0
  let totalSkipped = 0
  let totalFailed = 0
  let totalBytesSaved = 0
  let page = 1

  console.log('🔍 Cloudinary\'deki tüm görseller taranıyor...\n')

  do {
    const result: any = await cloudinary.api.resources({
      type: 'upload',
      resource_type: 'image',
      max_results: 100,
      next_cursor: nextCursor,
    })

    console.log(`📄 Sayfa ${page} - ${result.resources.length} dosya bulundu`)

    for (const resource of result.resources) {
      const format = (resource.format || '').toLowerCase()

      if (!CONVERTIBLE_FORMATS.includes(format)) {
        totalSkipped++
        continue
      }

      try {
        const originalBytes = resource.bytes || 0

        const converted: any = await cloudinary.uploader.upload(resource.secure_url, {
          public_id: resource.public_id,
          resource_type: 'image',
          overwrite: true,
          invalidate: true, // CDN cache'ini hemen temizle, eski (büyük) versiyon önbellekte kalmasın
          format: 'webp',
          quality: 'auto:good',
        })

        const newBytes = converted.bytes || 0
        const saved = originalBytes - newBytes
        totalBytesSaved += saved
        totalConverted++

        console.log(
          `  ✅ ${resource.public_id}.${format} -> webp  ` +
          `(${(originalBytes / 1024).toFixed(0)}KB -> ${(newBytes / 1024).toFixed(0)}KB, ` +
          `${saved > 0 ? '-' : '+'}${(Math.abs(saved) / 1024).toFixed(0)}KB)`
        )
      } catch (err) {
        totalFailed++
        console.error(`  ❌ ${resource.public_id} dönüştürülemedi:`, err instanceof Error ? err.message : err)
      }

      // Cloudinary rate limit'e takılmamak için ufak bir bekleme
      await new Promise((r) => setTimeout(r, 150))
    }

    nextCursor = result.next_cursor
    page++
  } while (nextCursor)

  console.log('\n🎉 Tamamlandı!')
  console.log(`  ✅ Dönüştürülen: ${totalConverted}`)
  console.log(`  ⏭️  Atlanan (zaten webp/svg vb.): ${totalSkipped}`)
  console.log(`  ❌ Başarısız: ${totalFailed}`)
  console.log(`  💾 Toplam kazanılan alan: ${(totalBytesSaved / 1024 / 1024).toFixed(2)} MB`)
}

convertAllToWebp().catch((err) => {
  console.error('❌ Script hatası:', err)
  process.exit(1)
})
