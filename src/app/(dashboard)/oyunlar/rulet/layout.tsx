import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Rulet',
  description: 'Kırmızı, siyah, tek sayı veya düzine - klasik rulet puanlarınla!',
}

export default function RouletteLayout({ children }: { children: React.ReactNode }) {
  return children
}
