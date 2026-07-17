'use client'

import { useQuery } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { useUserTheme } from '@/components/providers/user-theme-provider'
import { optimizeCloudinaryImage } from '@/lib/utils'
import { ThemedButton, ThemedEmptyState } from '@/components/ui/themed'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import HighlightedText from '@/components/HighlightedText'

export default function PromotionDetailPage({
  type,
  backPath,
}: {
  type: 'trial_bonus' | 'promotion'
  backPath: string
}) {
  const { theme } = useUserTheme()
  const router = useRouter()
  const params = useParams()
  const slug = params.slug as string

  const { data, isLoading } = useQuery({
    queryKey: ['promotion', type, slug],
    queryFn: async () => {
      const res = await fetch(`/api/promotions/${slug}?type=${type}`)
      if (!res.ok) throw new Error('not found')
      return res.json()
    },
  })

  const item = data?.item

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner />
      </div>
    )
  }

  if (!item) {
    return (
      <div className="user-page-container"><div className="user-page-inner">
        <ThemedEmptyState title="Bulunamadı" description="Bu içerik kaldırılmış olabilir." />
      </div></div>
    )
  }

  return (
    <div className="user-page-container"><div className="user-page-inner space-y-5 max-w-3xl mx-auto">
      <button
        onClick={() => router.push(backPath)}
        className="flex items-center gap-1.5 text-sm font-medium"
        style={{ color: theme.colors.textSecondary }}
      >
        <ArrowLeft className="w-4 h-4" />
        Geri
      </button>

      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: theme.colors.card, border: `1px solid ${theme.colors.cardBorder}` }}
      >
        {/* Fotoğraf - kırpılmadan, tamamı görünecek şekilde gösterilir */}
        {item.photoUrl && (
          <div
            className="relative w-full aspect-[2/1]"
            style={{ background: theme.colors.backgroundSecondary }}
          >
            <Image
              src={optimizeCloudinaryImage(item.photoUrl, 1000, 500)}
              unoptimized
              alt={item.name}
              fill
              sizes="(max-width: 768px) 100vw, 700px"
              className="object-contain"
              priority
            />
          </div>
        )}

        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            {item.sponsor?.logoUrl && (
              <div className="relative flex-shrink-0 w-20 h-12">
                <Image
                  src={optimizeCloudinaryImage(item.sponsor.logoUrl, 160, 96)}
                  unoptimized
                  alt={item.name}
                  fill
                  sizes="80px"
                  className="object-contain"
                />
              </div>
            )}
            <h1 className="font-display text-xl font-bold" style={{ color: theme.colors.text }}>
              {item.name}
            </h1>
          </div>

          {/* Açıklama */}
          {item.description && (
            <HighlightedText
              text={item.description}
              className="text-sm leading-relaxed"
              style={{ color: theme.colors.textSecondary }}
            />
          )}

          {/* Giriş butonu - sponsorun linkine gider */}
          <a href={item.sponsor?.websiteUrl || '#'} target="_blank" rel="noopener noreferrer" className="block">
            <ThemedButton variant="primary" size="lg" className="w-full">
              <ExternalLink className="w-4 h-4 mr-2" />
              Giriş Yap
            </ThemedButton>
          </a>
        </div>
      </div>
      </div>
    </div>
  )
}
