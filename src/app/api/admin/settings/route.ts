import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { invalidateSettingsCache } from '@/lib/enhanced-cache'
import { invalidateDynamicSettings } from '@/lib/site-config'
import { revalidatePath } from 'next/cache'
import { requirePermission } from '@/lib/admin-middleware'

// GET - Tüm ayarları getir
export async function GET(request: NextRequest) {
  const authCheck = await requirePermission(request, 'canAccessSettings')
  if (authCheck.error) return authCheck.error

  try {
    const settings = await prisma.settings.findMany({
      orderBy: [
        { category: 'asc' },
        { key: 'asc' }
      ]
    })

    return NextResponse.json({ settings })
  } catch (error) {
    console.error('Settings GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}



// PUT - Ayarı güncelle (sadece notification ve roll ayarları)
export async function PUT(request: NextRequest) {
  const authCheck = await requirePermission(request, 'canAccessSettings')
  if (authCheck.error) return authCheck.error

  try {
    const body = await request.json()
    const { key, value } = body

    if (!key) {
      return NextResponse.json(
        { error: 'Anahtar gerekli' },
        { status: 400 }
      )
    }

    // value undefined veya null olmamalı
    if (value === undefined || value === null) {
      return NextResponse.json(
        { error: 'Değer gerekli' },
        { status: 400 }
      )
    }

    // Sadece izin verilen ayarları kabul et
    const allowedKeys = [
      // Bildirim ayarları
      'notify_order_approved',
      'notify_level_up',
      'notify_wheel_reset',
      // Roll sistemi
      'roll_enabled',
      // Reklam ayarları
      'sponsor_banner_enabled',
      'popup_enabled',
      'popup_data',
      'left_banner_data',
      'right_banner_data',
      'yatay_banner_data'
    ]

    if (!allowedKeys.includes(key)) {
      return NextResponse.json(
        {
          error: 'Bu ayar artık .env dosyasından yönetilmektedir',
          message: 'Telegram bot, çark, puan/XP ve diğer ayarlar için .env dosyasını düzenleyin'
        },
        { status: 400 }
      )
    }

    // Kategoriyi belirle
    const adsKeys = ['sponsor_banner_enabled', 'popup_enabled', 'popup_data', 'left_banner_data', 'right_banner_data', 'yatay_banner_data']
    const category = adsKeys.includes(key) ? 'ads' : 'notifications'

    // Ayarı güncelle veya oluştur
    const setting = await prisma.settings.upsert({
      where: { key },
      update: { value: String(value) },
      create: {
        key,
        value: String(value),
        description: getSettingDescription(key),
        category
      }
    })

    // ✅ Cache invalidation (hem enhanced cache hem telegram cache)
    await invalidateSettingsCache()
    await invalidateDynamicSettings()

    revalidatePath('/')
    console.log(`🔄 Settings cache temizlendi (ayar güncellendi: ${key})`)

    return NextResponse.json({ success: true, setting })
  } catch (error) {
    console.error('Settings PUT error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper: Ayar açıklamaları
function getSettingDescription(key: string): string {
  const descriptions: Record<string, string> = {
    'notify_order_approved': 'Market siparişi onaylandığında kullanıcıya bildirim gönder',
    'notify_level_up': 'Kullanıcı seviye atladığında grupta bildirim göster',
    'notify_wheel_reset': 'Şans çarkı sıfırlandığında kullanıcılara bildirim gönder',
    'roll_enabled': 'Roll sistemi komutlarını aktif et',
    // Reklam ayarları
    'sponsor_banner_enabled': 'Sponsor banner\'ı ana sayfada göster',
    'popup_enabled': 'Ana sayfa popup\'ını göster',
    'popup_data': 'Popup içerik verileri (JSON)',
    'left_banner_data': 'Sol yan banner verileri (JSON)',
    'right_banner_data': 'Sağ yan banner verileri (JSON)',
    'yatay_banner_data': 'Yatay banner verileri (JSON)'
  }
  return descriptions[key] || ''
}
