import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Çark',
  description: 'Günlük şans çarkını çevir ve anında ödüller kazan! Her gün yeni bir şans, her çevirişte sürpriz hediyeler.',
  keywords: ['çark', 'şans çarkı', 'günlük ödül', 'bedava hediye', 'spin wheel'],
  openGraph: {
    title: 'Çark',
    description: 'Günlük şans çarkını çevir ve anında ödüller kazan!',
  },
}

export default function WheelLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
