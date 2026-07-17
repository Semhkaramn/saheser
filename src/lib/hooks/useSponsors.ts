import { useQuery } from '@tanstack/react-query'

interface Sponsor {
  id: string
  name: string
  description?: string
  logoUrl?: string
  websiteUrl?: string
  category: string
  clicks: number
  isActive: boolean
  order: number
  showInBanner?: boolean
}

async function fetchSponsors() {
  const response = await fetch('/api/sponsors')
  if (!response.ok) throw new Error('Failed to fetch sponsors')
  const data = await response.json()
  return data.sponsors as Sponsor[]
}

export function useSponsors() {
  return useQuery({
    queryKey: ['sponsors'],
    queryFn: fetchSponsors,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}
