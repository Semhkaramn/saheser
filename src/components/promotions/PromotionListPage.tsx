'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import PageHeader from '@/components/PageHeader'
import { useUserTheme } from '@/components/providers/user-theme-provider'
import { optimizeCloudinaryImage } from '@/lib/utils'
import { ThemedButton, ThemedEmptyState } from '@/components/ui/themed'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { Eye, Gift, Ticket as TicketIcon, LucideIcon } from 'lucide-react'

interface PromotionItem {
  id: string
  name: string
  slug?: string | null
  sponsor: { logoUrl: string | null } | null
  groups?: { id: string; name: string }[]
}

interface PromotionGroup {
  id: string
  name: string
}

export default function PromotionListPage({
  type,
  title,
  subtitle,
  icon,
  basePath,
}: {
  type: 'trial_bonus' | 'promotion'
  title: string
  subtitle: string
  icon: LucideIcon
  basePath: string
}) {
  const { theme } = useUserTheme()
  const router = useRouter()
  const [activeGroup, setActiveGroup] = useState<string | null>(null)

  // ✅ React Query ile önbellekli - sayfaya tekrar gelince anında açılır
  const { data, isLoading } = useQuery({
    queryKey: ['promotions', type],
    queryFn: async () => {
      const res = await fetch(`/api/promotions?type=${type}`)
      return res.json()
    },
    staleTime: 60 * 1000,
  })

  // Admin'in oluşturduğu gruplar (örn. "Kayıp Bonusu") - üstte filtre çipi olarak
  const { data: groupsData } = useQuery({
    queryKey: ['promotionGroups', type],
    queryFn: async () => {
      const res = await fetch(`/api/promotion-groups?type=${type}`)
      return res.json()
    },
    staleTime: 60 * 1000,
  })

  const items: PromotionItem[] = data?.items || []
  const groups: PromotionGroup[] = groupsData?.groups || []

  const visibleItems = activeGroup
    ? items.filter((item) => item.groups?.some((g) => g.id === activeGroup))
    : items

  return (
    <div className="user-page-container">
      <div className="user-page-inner space-y-5">
      <PageHeader icon={icon} title={title} subtitle={subtitle} />

      {groups.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveGroup(null)}
            className="text-xs font-semibold px-3 py-1.5 rounded-full transition-all"
            style={{
              background: activeGroup === null ? theme.colors.primary : theme.colors.card,
              color: activeGroup === null ? '#fff' : theme.colors.textSecondary,
              border: `1px solid ${activeGroup === null ? theme.colors.primary : theme.colors.cardBorder}`,
            }}
          >
            Tümü
          </button>
          {groups.map((g) => (
            <button
              key={g.id}
              onClick={() => setActiveGroup(g.id)}
              className="text-xs font-semibold px-3 py-1.5 rounded-full transition-all"
              style={{
                background: activeGroup === g.id ? theme.colors.primary : theme.colors.card,
                color: activeGroup === g.id ? '#fff' : theme.colors.textSecondary,
                border: `1px solid ${activeGroup === g.id ? theme.colors.primary : theme.colors.cardBorder}`,
              }}
            >
              {g.name}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner />
        </div>
      ) : visibleItems.length === 0 ? (
        <ThemedEmptyState
          icon={<Gift className="w-12 h-12" />}
          title="Henüz eklenmedi"
          description="Yakında burada listelenecek."
        />
      ) : (
        <div className="space-y-2.5">
          {visibleItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 p-3 rounded-2xl transition-all duration-200 hover:-translate-y-0.5"
              style={{
                background: theme.colors.card,
                border: `1px solid ${theme.colors.cardBorder}`,
                boxShadow: '0 1px 3px rgba(15,30,61,0.04)',
              }}
            >
              {/* Logo - yatay dikdörtgen, çerçevesiz, kırpılmadan */}
              <div className="relative flex-shrink-0 w-16 h-10">
                {item.sponsor?.logoUrl ? (
                  <Image
                    src={optimizeCloudinaryImage(item.sponsor.logoUrl, 128, 80)}
                    unoptimized
                    alt={item.name}
                    fill
                    sizes="64px"
                    className="object-contain"
                  />
                ) : (
                  <div
                    className="w-full h-full rounded-lg flex items-center justify-center font-display font-bold"
                    style={{ background: theme.colors.backgroundSecondary, color: theme.colors.textMuted }}
                  >
                    {item.name[0]}
                  </div>
                )}
              </div>

              <h3
                className="flex-1 min-w-0 font-display font-bold leading-snug break-words"
                style={{
                  color: theme.colors.text,
                  fontSize: item.name.length > 28 ? '0.75rem' : item.name.length > 18 ? '0.8125rem' : '0.875rem',
                }}
              >
                {item.name}
              </h3>

              <ThemedButton
                onClick={() => router.push(`${basePath}/${item.slug || item.id}`)}
                variant="secondary"
                size="sm"
                className="flex-shrink-0 text-xs px-3"
              >
                <Eye className="w-3.5 h-3.5 mr-1 flex-shrink-0" />
                Detay
              </ThemedButton>
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  )
}
