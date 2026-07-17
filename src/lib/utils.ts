import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 🔍 Türkçe karakterlere duyarlı arama normalizasyonu.
 *
 * SORUN: JS'in standart toLowerCase()'i Türkçe büyük "İ" harfini
 * "i" + görünmez nokta karakterine çevirir (i̇, iki karakter), tek
 * karakterlik düz "i" değil. Bu yüzden "Hİp" gibi bir isimde arama
 * kutusuna "hip" yazınca .includes() eşleşmiyordu - kullanıcı "sonuç
 * bulunamadı" görüyordu.
 *
 * ÇÖZÜM: Karşılaştırmadan önce hem "İ" hem de düz "I" harflerini tek
 * tip düz "i"ye çevirip öyle lowercase yapıyoruz - nokta farkı aramaya
 * takılmıyor.
 */
export function normalizeForSearch(str: string): string {
  return str.replace(/İ/g, 'i').replace(/I/g, 'i').toLowerCase();
}

/**
 * ⏰ Şu anki UTC zamanını döndürür
 *
 * ⚠️ NOT: İsim "getTurkeyDate" olmasına rağmen UTC döndürür!
 * Bu isim geçmişten kalmadır ve değiştirilmemiştir.
 *
 * 📌 KULLANIM:
 * - Veritabanına kayıt yaparken (Prisma DateTime alanları için)
 * - Tarih karşılaştırmalarında (veritabanından gelen UTC tarihlerle)
 *
 * ✅ DOĞRU DAVRANIŞ:
 * - new Date() → UTC zamanı döndürür
 * - Prisma DateTime → UTC olarak saklar ve döndürür
 * - Karşılaştırma → UTC === UTC (doğru!)
 *
 * 🎯 ÖRNEK:
 * const now = getTurkeyDate() // UTC: 2024-12-17 10:00:00Z
 * await prisma.user.update({
 *   data: { lastMessageAt: now } // UTC olarak kaydedilir
 * })
 *
 * @returns UTC formatında Date objesi
 */
export function getTurkeyDate(): Date {
  return new Date(); // UTC zamanı döndürür
}

/**
 * Türkiye saatine göre bugünün başlangıcını UTC olarak döndürür (00:00:00 Turkey Time)
 *
 * 📌 KULLANIM: Günlük istatistikler, günlük reset kontrolleri
 *
 * 🎯 ÖRNEK:
 * Türkiye'de 17 Aralık 2024 00:00 = UTC 16 Aralık 2024 21:00 (UTC+3 için)
 *
 * const today = getTurkeyToday()
 * const todayMessages = await prisma.message.count({
 *   where: { createdAt: { gte: today } } // UTC karşılaştırması
 * })
 *
 * @returns Türkiye'de bugünün başlangıcının UTC karşılığı
 */
export function getTurkeyToday(): Date {
  const now = new Date();

  // Türkiye'deki bugünün tarihini al
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(now);
  const values: Record<string, number> = {};

  for (const part of parts) {
    if (part.type !== 'literal') {
      values[part.type] = Number.parseInt(part.value);
    }
  }

  // Türkiye'deki bu günün öğlen vaktini UTC olarak oluştur (offset hesabı için)
  const testDate = new Date(Date.UTC(values.year, values.month - 1, values.day, 12, 0, 0));

  // Bu UTC öğlen zamanı Türkiye'de kaç saat?
  const turkeyHourStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Istanbul',
    hour: '2-digit',
    hour12: false
  }).format(testDate);
  const turkeyHour = Number.parseInt(turkeyHourStr);

  // Offset hesapla: Türkiye saati - UTC saati
  const offset = turkeyHour - 12;

  // Türkiye'de 00:00 = UTC'de (00:00 - offset)
  const midnightUTC = new Date(Date.UTC(values.year, values.month - 1, values.day, 0 - offset, 0, 0));

  return midnightUTC;
}

/**
 * Türkiye saatine göre belirli bir tarih aralığı döndürür
 * @param daysAgo Kaç gün önce
 */
export function getTurkeyDateAgo(daysAgo: number): Date {
  const today = getTurkeyToday();
  return new Date(today.getTime() - daysAgo * 24 * 60 * 60 * 1000);
}

/**
 * Türkiye saatine göre bu haftanın başlangıcını UTC olarak döndürür (Pazartesi 00:00:00 Turkey Time)
 */
export function getTurkeyWeekStart(): Date {
  const now = new Date();

  // Türkiye'deki bugünün tarihini ve gününü al
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });

  const parts = formatter.formatToParts(now);
  const values: Record<string, any> = {};

  for (const part of parts) {
    if (part.type !== 'literal') {
      values[part.type] = part.type === 'weekday' ? part.value : Number.parseInt(part.value);
    }
  }

  // Türkiye'deki bugünün haftanın hangi günü olduğunu bul
  // Intl API kullanarak doğru gün değerini al
  const dayFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Istanbul',
    weekday: 'short'
  });
  const dayName = dayFormatter.format(now);
  const dayMap: Record<string, number> = {
    'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
  };
  const turkeyDayOfWeek = dayMap[dayName] || 0;

  const turkeyDate = new Date(Date.UTC(values.year, values.month - 1, values.day));

  // Pazartesi'ye kadar olan gün farkını hesapla
  const diff = turkeyDayOfWeek === 0 ? -6 : 1 - turkeyDayOfWeek;

  // Pazartesinin tarihini hesapla
  const mondayDate = new Date(turkeyDate);
  mondayDate.setUTCDate(turkeyDate.getUTCDate() + diff);

  // Offset hesabı için öğlen vaktini kullan
  const testDate = new Date(Date.UTC(mondayDate.getUTCFullYear(), mondayDate.getUTCMonth(), mondayDate.getUTCDate(), 12, 0, 0));
  const turkeyHourStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Istanbul',
    hour: '2-digit',
    hour12: false
  }).format(testDate);
  const offset = Number.parseInt(turkeyHourStr) - 12;

  // Pazartesi 00:00 Türkiye saati = UTC (00:00 - offset)
  return new Date(Date.UTC(mondayDate.getUTCFullYear(), mondayDate.getUTCMonth(), mondayDate.getUTCDate(), 0 - offset, 0, 0));
}

/**
 * Türkiye saatine göre bu ayın başlangıcını UTC olarak döndürür (1. gün 00:00:00 Turkey Time)
 */
export function getTurkeyMonthStart(): Date {
  const now = new Date();

  // Türkiye'deki şu anki yıl ve ayı al
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
  });

  const parts = formatter.formatToParts(now);
  const values: Record<string, number> = {};

  for (const part of parts) {
    if (part.type !== 'literal') {
      values[part.type] = Number.parseInt(part.value);
    }
  }

  // Bu ayın 1. gününün öğlen vaktini UTC olarak oluştur (offset hesabı için)
  const testDate = new Date(Date.UTC(values.year, values.month - 1, 1, 12, 0, 0));

  // Bu UTC öğlen zamanı Türkiye'de kaç saat?
  const turkeyHourStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Istanbul',
    hour: '2-digit',
    hour12: false
  }).format(testDate);
  const turkeyHour = Number.parseInt(turkeyHourStr);

  // Offset hesapla
  const offset = turkeyHour - 12;

  // Türkiye'de ayın 1. günü 00:00 = UTC'de (00:00 - offset)
  return new Date(Date.UTC(values.year, values.month - 1, 1, 0 - offset, 0, 0));
}

/**
 * Cloudinary image URL - dönüşüm yapmadan orijinal döndürür
 */
export function optimizeCloudinaryImage(url: string, width?: number, height?: number): string {
  if (!url) return url

  // Cloudinary URL'si değilse (örn. dışarıdan bir link) olduğu gibi döndür
  if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) {
    return url
  }

  // ✅ FIX: Bu fonksiyon eskiden hiçbir şey yapmıyordu - width/height parametreleri
  // TAMAMEN yok sayılıyor, orijinal (genelde çok daha büyük) görsel URL'si
  // olduğu gibi döndürülüyordu. Sponsor logoları, ürün resimleri gibi küçük
  // bir kutuda gösterilen görseller bile tam çözünürlükte indiriliyordu -
  // "resimler yavaş yükleniyor" şikayetinin en büyük sebeplerinden biri buydu.
  // Şimdi Cloudinary'nin kendi dönüşüm parametrelerini (w_, h_, c_fill, q_auto,
  // f_auto) URL'ye ekleyip görseli sunucu tarafında küçültüp optimize ediyoruz.
  // ✅ FIX: "c_fill" Cloudinary'ye görseli tam o kutuya SIĞDIRMAK için
  // KIRPMASINI söylüyordu - logo gibi en-boy oranı kutuyla eşleşmeyen
  // görsellerde bu, logonun bir kısmının (özellikle kenarların) kırpılıp
  // kaybolmasına sebep oluyordu. "c_fit" ise görseli KIRPMADAN, orantısını
  // koruyarak kutunun İÇİNE sığdırır (gerekirse taşan boyut küçültülür,
  // hiçbir piksel kaybolmaz).
  const transforms = ['q_auto', 'f_auto']
  if (width) transforms.push(`w_${width}`)
  if (height) transforms.push(`h_${height}`)
  if (width || height) transforms.push('c_fit')

  return url.replace('/upload/', `/upload/${transforms.join(',')}/`)
}

/**
 * UTC tarihini Türkiye saat dilimine (UTC+3) göre formatlar
 * Veritabanından gelen UTC tarihlerini doğru şekilde göstermek için kullanılır
 */
export function formatDateTR(dateString: string | Date, options: {
  showTime?: boolean
  showDate?: boolean
  showSeconds?: boolean
} = { showTime: true, showDate: true, showSeconds: false }) {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString

  const { showTime = true, showDate = true, showSeconds = false } = options

  const dateOptions: Intl.DateTimeFormatOptions = {
    timeZone: 'Europe/Istanbul',
    ...(showDate && {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }),
    ...(showTime && {
      hour: '2-digit',
      minute: '2-digit',
      ...(showSeconds && { second: '2-digit' })
    })
  }

  return date.toLocaleString('tr-TR', dateOptions)
}

/**
 * Sadece saati gösterir (HH:MM formatında)
 */
export function formatTimeTR(dateString: string | Date) {
  return formatDateTR(dateString, { showTime: true, showDate: false, showSeconds: false })
}

/**
 * Sadece tarihi gösterir (GG.AA.YYYY formatında)
 */
export function formatDateOnlyTR(dateString: string | Date) {
  return formatDateTR(dateString, { showTime: false, showDate: true, showSeconds: false })
}

/**
 * URL'nin mutlaka http:// veya https:// ile başlamasını sağlar
 * Relative path olarak yorumlanmasını önler
 *
 * 📌 KULLANIM:
 * window.open(ensureAbsoluteUrl(websiteUrl), '_blank')
 *
 * 🎯 ÖRNEKLER:
 * ensureAbsoluteUrl('example.com') => 'https://example.com'
 * ensureAbsoluteUrl('www.example.com') => 'https://www.example.com'
 * ensureAbsoluteUrl('https://example.com') => 'https://example.com'
 * ensureAbsoluteUrl('http://example.com') => 'http://example.com'
 * ensureAbsoluteUrl('') => ''
 * ensureAbsoluteUrl(undefined) => ''
 *
 * @param url URL string
 * @returns Absolute URL (https:// veya http:// ile başlayan)
 */
export function ensureAbsoluteUrl(url: string | undefined | null): string {
  if (!url || typeof url !== 'string') return ''

  const trimmedUrl = url.trim()
  if (!trimmedUrl) return ''

  // Zaten http:// veya https:// ile başlıyorsa olduğu gibi döndür
  if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
    return trimmedUrl
  }

  // Protocol-relative URL ise (//example.com) https ekle
  if (trimmedUrl.startsWith('//')) {
    return `https:${trimmedUrl}`
  }

  // Hiç protocol yoksa https:// ekle
  return `https://${trimmedUrl}`
}
