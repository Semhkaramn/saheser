'use client'

import { useState, useEffect, useCallback, useMemo, memo } from 'react'
import { useAuth } from '@/components/providers/auth-provider'
import { useUserTheme } from '@/components/providers/user-theme-provider'
import { useSponsors } from '@/lib/hooks/useSponsors'
import { optimizeCloudinaryImage, ensureAbsoluteUrl, normalizeForSearch } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Heart, Crown, Sparkles, Search } from 'lucide-react'
import Image from 'next/image'
import HomePopup from '@/components/HomePopup'
import HighlightedText from '@/components/HighlightedText'

interface Sponsor {
  id: string
  name: string
  description?: string
  logoUrl?: string
  websiteUrl?: string
  category: string
  clicks: number
}

// Sponsor kartı - tüm kategoriler (main/vip/normal) TEK bir bileşen kullanıyor,
// sadece rozet rengi/boyutu değişiyor. Eskiden 3 ayrı, birbirinden kopyalanmış
// kart bloğu vardı; artık tek yapı, tutarlı davranıyor.
const SponsorCard = memo(function SponsorCard({
  sponsor,
  tier,
  onVisit,
  priority = false,
  onImgLoad,
}: {
  sponsor: Sponsor
  tier: 'main' | 'vip' | 'normal'
  onVisit: (sponsor: Sponsor) => void
  priority?: boolean
  onImgLoad?: () => void
}) {
  const { theme } = useUserTheme()
  const handleClick = () => onVisit(sponsor)

  // Ana Sponsor: tek belirgin fark - etrafında YAVAŞÇA dönen ince bir neon
  // çerçeve var. Bunun dışında VIP/Normal ile aynı basit yapı - küçük logo,
  // isim, kısa açıklama. Sadece BU kartta (genelde 1 tane) animasyon var,
  // bu yüzden kaç sponsor olursa olsun toplam maliyet hep sabit kalıyor.
  if (tier === 'main') {
    return (
      <div
        onClick={handleClick}
        data-hover-arrow
        className="neon-ring-spin group p-[2px] rounded-2xl cursor-pointer transition-transform duration-200 hover:-translate-y-0.5"
        style={{ color: theme.colors.primary, boxShadow: `0 4px 18px ${theme.colors.primary}25` }}
      >
        <div
          className="relative z-[1] rounded-[calc(1rem-2px)] flex flex-col items-center text-center gap-1.5 p-3 sm:p-4"
          style={{ background: theme.colors.card }}
        >
          {sponsor.logoUrl ? (
            <div className="relative w-full" style={{ height: 60 }}>
              <Image
                src={optimizeCloudinaryImage(sponsor.logoUrl, 320, 130)}
                alt={sponsor.name}
                fill
                sizes="220px"
                className="object-contain"
                priority={priority}
                loading="eager"
                unoptimized
                onLoad={onImgLoad}
                onError={onImgLoad}
                placeholder="blur"
                blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjI0IiBoZWlnaHQ9IjIyNCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjI0IiBoZWlnaHQ9IjIyNCIgZmlsbD0iI0U0RUVGRiIvPjwvc3ZnPg=="
              />
            </div>
          ) : (
            <div
              className="w-full flex items-center justify-center font-display font-black text-2xl"
              style={{ height: 60, color: theme.colors.primary }}
            >
              {sponsor.name[0]}
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <span className="text-xs">⭐</span>
            <h3 className="font-display font-black text-sm break-words" style={{ color: theme.colors.text }}>
              {sponsor.name}
            </h3>
          </div>

          {sponsor.description && (
            <HighlightedText
              text={sponsor.description}
              className="text-[11px] font-semibold leading-snug line-clamp-2"
            />
          )}

          <span
            className="inline-flex items-center gap-1 text-[11px] font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            style={{ color: theme.colors.primary }}
          >
            Siteye Git <span className="cta-arrow">→</span>
          </span>
        </div>
      </div>
    )
  }

  const isVip = tier === 'vip'
  const logoHeight = isVip ? 52 : 44
  const neonColor = isVip ? theme.colors.warning : theme.colors.primary

  return (
    <div
      onClick={handleClick}
      data-hover-arrow
      className="neon-ring-static group p-[1.5px] rounded-xl cursor-pointer transition-transform duration-200 hover:-translate-y-0.5"
      style={{ background: `${neonColor}55` }}
    >
      <div
        className="relative z-[1] rounded-[calc(0.75rem-1.5px)] flex flex-col items-center text-center gap-1.5 p-2.5"
        style={{ background: theme.colors.card }}
      >
        {/* Logo - küçük, sade */}
        {sponsor.logoUrl ? (
          <div className="relative w-full" style={{ height: logoHeight }}>
            <Image
              src={optimizeCloudinaryImage(sponsor.logoUrl, 260, logoHeight * 2)}
              alt={sponsor.name}
              fill
              sizes="160px"
              className="object-contain"
              priority={priority}
              loading="eager"
              unoptimized
              onLoad={onImgLoad}
              onError={onImgLoad}
              placeholder="blur"
              blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjI0IiBoZWlnaHQ9IjIyNCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjI0IiBoZWlnaHQ9IjIyNCIgZmlsbD0iI0U0RUVGRiIvPjwvc3ZnPg=="
            />
          </div>
        ) : (
          <div
            className="w-full rounded-lg flex items-center justify-center font-display font-bold"
            style={{ height: logoHeight, background: theme.colors.backgroundSecondary, color: theme.colors.textMuted }}
          >
            {sponsor.name[0]}
          </div>
        )}

        <div className="flex items-center gap-1">
          {isVip && <span className="text-[10px]">👑</span>}
          <h3
            className="font-display font-bold leading-snug break-words"
            style={{
              color: theme.colors.text,
              fontSize: sponsor.name.length > 22 ? '0.75rem' : sponsor.name.length > 14 ? '0.8125rem' : '0.875rem',
            }}
          >
            {sponsor.name}
          </h3>
        </div>

        {sponsor.description && (
          <p
            className="text-[10px] font-semibold leading-snug line-clamp-2 w-full whitespace-pre-line"
            style={{ color: neonColor }}
          >
            {sponsor.description.replace(/<\/?span>/g, '')}
          </p>
        )}

        {/* Hover'da beliren "Git" oku - kartın tıklanabilir olduğunu görünür kılar */}
        <span
          className="inline-flex items-center gap-0.5 text-[11px] font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          style={{ color: neonColor }}
        >
          Git <span className="cta-arrow">→</span>
        </span>
      </div>
    </div>
  )
})

export default function HarleyHome() {
  const { user } = useAuth()
  const { theme } = useUserTheme()
  const { data: sponsorsData, isLoading: loadingSponsors } = useSponsors()

  const [searchTerm, setSearchTerm] = useState('')
  // 🖼️ Görseller artık hep loading="eager" + doğru önbellek eşleşmesiyle
  // (unoptimized) geliyor, bu yüzden kaydırırken "sonradan yüklenme" sorunu
  // kalmadı. Bu yüzden TÜM sayfayı görsellerin bitmesini bekleyip göstermek
  // yerine (bu, "içerik 1sn geç geliyor" hissi yaratıyordu), sadece VERİ
  // gelince içeriği gösteriyoruz - kartlar anında render olur, resimler
  // kendi blur placeholder'larıyla üstüne yumuşakça biner (native <img>
  // davranışı, kaybolma/geç gelme değil).

  useEffect(() => {
    if (!loadingSponsors) {
      window.dispatchEvent(new CustomEvent('contentReady'))
    }
  }, [loadingSponsors])

  const sponsors = sponsorsData || []
  // 🚀 useMemo: eskiden bu sıralama HER render'da (arama kutusuna her harf
  // yazıldığında, tema değiştiğinde vb.) yeniden çalışıyordu - liste
  // kalabalıksa gereksiz CPU işi. Artık sadece sponsors verisi gerçekten
  // değişince yeniden hesaplanıyor.
  const sortedSponsors = useMemo(() => {
    return [...sponsors].sort((a: Sponsor, b: Sponsor) => {
      if (a.category === 'vip' && b.category !== 'vip') return -1
      if (a.category !== 'vip' && b.category === 'vip') return 1
      return 0
    })
  }, [sponsors])

  // 🚀 useCallback: sabit bir referans - SponsorCard'ın React.memo ile
  // gereksiz yeniden render'ları atlayabilmesi için şart (aksi halde her
  // kart için her render'da YENİ bir fonksiyon oluşturulur, memo işe yaramaz).
  const visitSponsor = useCallback((sponsor: Sponsor) => {
    if (!sponsor.websiteUrl) return
    const data = JSON.stringify({ sponsorId: sponsor.id })
    if (navigator.sendBeacon) {
      const blob = new Blob([data], { type: 'application/json' })
      navigator.sendBeacon('/api/sponsors/click', blob)
    } else {
      fetch('/api/sponsors/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: data,
        keepalive: true
      }).catch(() => {})
    }
    window.open(ensureAbsoluteUrl(sponsor.websiteUrl), '_blank', 'noopener,noreferrer')
  }, [])

  // Sadece VERİ yüklenene kadar iskelet göster (genelde çok hızlı, özellikle
  // önbellekten). Görsellerin bitmesini beklemiyoruz artık - bu, sayfanın
  // "1 saniye geç geliyor" gibi hissettirmesine sebep oluyordu. Kartlar anında
  // render olur, resimler eager+blur-placeholder ile kendi üstüne yumuşakça
  // biner; kaydırırken pop-in olmaz çünkü hiçbir görsel lazy değil ve gerçek
  // <img> adresiyle bire bir aynı (unoptimized) - önbellek daima eşleşir.
  if (loadingSponsors) {
    return (
      <div className="min-h-screen pb-8 px-2 sm:px-4 py-4 max-w-[1800px] mx-auto" style={{ contain: 'layout' }}>
        <div className="h-11 rounded-full mb-6 animate-pulse" style={{ background: theme.colors.card }} />
        <div className="grid gap-2 sm:gap-3 grid-cols-2 mb-6">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-2xl animate-pulse" style={{ aspectRatio: '2.2 / 1', background: theme.colors.card }} />
          ))}
        </div>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="rounded-2xl p-3 animate-pulse" style={{ height: 140, background: theme.colors.card }} />
          ))}
        </div>
      </div>
    )
  }

  const filteredSponsors = sortedSponsors.filter((s: Sponsor) =>
    normalizeForSearch(s.name).includes(normalizeForSearch(searchTerm))
  )

  const mainSponsors = filteredSponsors.filter((s: Sponsor) => s.category === 'main')
  const vipSponsors = filteredSponsors.filter((s: Sponsor) => s.category === 'vip')
  const normalSponsors = filteredSponsors.filter((s: Sponsor) => s.category !== 'vip' && s.category !== 'main')

  return (
    <div className="min-h-screen pb-8 px-2 sm:px-4 py-4 max-w-[1800px] mx-auto">
      <HomePopup />

      {/* Kullanıcıyı selamlayan kısa başlık - sayfaya kimlik katıyor */}
      {user && (
        <h1 className="font-display text-xl sm:text-2xl font-bold mb-4 text-center" style={{ color: theme.colors.text }}>
          Merhaba, <span style={{ color: theme.colors.primary }}>{user.siteUsername || user.firstName}</span> 👋
        </h1>
      )}

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: theme.colors.primary }} />
        <Input
          type="text"
          placeholder="Sponsor ara..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 rounded-full"
        />
      </div>

      {filteredSponsors.length === 0 ? (
        <div className="text-center py-12" style={{ minHeight: '200px' }}>
          <Heart className="w-16 h-16 mx-auto mb-4" style={{ color: theme.colors.textMuted }} />
          <p style={{ color: theme.colors.textMuted }}>Henüz sponsor bulunmuyor</p>
        </div>
      ) : (
        <div className="space-y-8" style={{ contain: 'layout', minHeight: '400px' }}>
          {/* MAIN Sponsors */}
          {mainSponsors.length > 0 && (
            <div className="space-y-3">
              <SectionLabel icon={Sparkles} text="Ana Sponsor" color={theme.colors.primary} />
              <div className="grid gap-2 sm:gap-3 grid-cols-2 lg:grid-cols-3">
                {mainSponsors.map((sponsor, index) => (
                  <SponsorCard
                    key={sponsor.id}
                    sponsor={sponsor}
                    tier="main"
                    priority={index === 0}
                    onVisit={visitSponsor}
                  />
                ))}
              </div>
            </div>
          )}

          {/* VIP Sponsors */}
          {vipSponsors.length > 0 && (
            <div className="space-y-3">
              <SectionLabel icon={Crown} text="VIP Sponsorlar" color={theme.colors.accent} />
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {vipSponsors.map((sponsor, index) => (
                  <SponsorCard
                    key={sponsor.id}
                    sponsor={sponsor}
                    tier="vip"
                    priority={mainSponsors.length === 0 && index < 2}
                    onVisit={visitSponsor}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Normal Sponsors */}
          {normalSponsors.length > 0 && (
            <div className="space-y-3">
              {(mainSponsors.length > 0 || vipSponsors.length > 0) && (
                <SectionLabel icon={Heart} text="Sponsorlar" color={theme.colors.textMuted} />
              )}
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {normalSponsors.map((sponsor, index) => (
                  <SponsorCard
                    key={sponsor.id}
                    sponsor={sponsor}
                    tier="normal"
                    priority={mainSponsors.length === 0 && vipSponsors.length === 0 && index < 2}
                    onVisit={visitSponsor}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SectionLabel({ icon: Icon, text, color }: { icon: React.ElementType; text: string; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${color}20` }}>
        <Icon className="w-4 h-4" style={{ color }} fill={color} />
      </span>
      <h2 className="font-display text-base sm:text-lg font-bold" style={{ color }}>{text}</h2>
      <div className="flex-1 h-px" style={{ background: `${color}30` }} />
    </div>
  )
}
