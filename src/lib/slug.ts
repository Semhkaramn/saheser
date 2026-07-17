/**
 * 🔗 URL-dostu slug üretimi (örn. "Deneme Bonusu Kayıp" -> "deneme-bonusu-kayip")
 *
 * Türkçe karakterleri (ı, ş, ğ, ü, ö, ç, İ) ASCII karşılıklarına çevirir,
 * küçük harfe indirir, harf/rakam olmayan her şeyi tire ile değiştirir.
 */
export function slugify(text: string): string {
  const trMap: Record<string, string> = {
    ı: 'i', İ: 'i', ş: 's', Ş: 's', ğ: 'g', Ğ: 'g',
    ü: 'u', Ü: 'u', ö: 'o', Ö: 'o', ç: 'c', Ç: 'c',
  }

  const transliterated = text
    .split('')
    .map((ch) => trMap[ch] ?? ch)
    .join('')

  const slug = transliterated
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // kalan aksanları (é, à vb.) temizle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)

  return slug || 'item'
}

/**
 * Bir isimden benzersiz bir slug üretir. Aynı isimde bir kayıt zaten varsa
 * sonuna otomatik olarak "-1", "-2" ... ekler (örn. "deneme-bonusu",
 * "deneme-bonusu-1", "deneme-bonusu-2").
 *
 * @param baseText Slug'ın türetileceği metin (genelde kaydın ismi)
 * @param checkExists Verilen slug'ın veritabanında zaten var olup olmadığını
 *   döndüren fonksiyon (aynı kaydı güncellerken kendisini hariç tutmalı)
 */
export async function generateUniqueSlug(
  baseText: string,
  checkExists: (slug: string) => Promise<boolean>
): Promise<string> {
  const base = slugify(baseText)
  let slug = base
  let counter = 1

  while (await checkExists(slug)) {
    slug = `${base}-${counter}`
    counter++
  }

  return slug
}
