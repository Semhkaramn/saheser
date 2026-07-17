import { useQuery } from '@tanstack/react-query'

interface SocialMedia {
  id: string
  name: string
  platform: string
  username: string
  order: number
}

async function fetchSocialMedia() {
  const response = await fetch('/api/social-media')
  if (!response.ok) throw new Error('Failed to fetch social media')
  return response.json() as Promise<SocialMedia[]>
}

export function useSocialMedia() {
  return useQuery({
    queryKey: ['socialMedia'],
    queryFn: fetchSocialMedia,
    staleTime: 1000 * 60 * 60, // 1 saat - sosyal medya linkleri sık değişmez
    gcTime: 1000 * 60 * 60 * 24, // 24 saat cache
  })
}
