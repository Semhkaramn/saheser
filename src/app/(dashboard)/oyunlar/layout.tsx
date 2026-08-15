import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Oyunlar',
  description: 'Puanlarınla Mines, Zar, Rulet ve Blackjack oyna! Gerçek para gerekmez, tamamen puan bazlı eğlence.',
  keywords: ['oyunlar', 'mines', 'zar', 'rulet', 'blackjack', 'puan oyunu'],
  openGraph: {
    title: 'Oyunlar',
    description: 'Puanlarınla Mines, Zar, Rulet ve Blackjack oyna!',
  },
}

export default function GamesLayout({ children }: { children: React.ReactNode }) {
  return children
}
