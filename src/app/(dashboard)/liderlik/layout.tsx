import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Liderlik Tablosu',
  description: 'En yüksek puanlı oyuncuları gör! Haftalık ve aylık sıralamalarda yerini al, zirvede ol.',
  keywords: ['liderlik tablosu', 'sıralama', 'en iyi oyuncular', 'ranking', 'puan tablosu'],
  openGraph: {
    title: 'Liderlik Tablosu',
    description: 'En yüksek puanlı oyuncuları gör! Haftalık ve aylık sıralamalarda yerini al.',
  },
}

export default function LeaderboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
