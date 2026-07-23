import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Çekiliş Biletleri',
  description: 'Çekiliş biletlerini topla ve büyük ödüller kazan! Aktif çekilişlere katıl, şansını dene.',
  keywords: ['çekiliş', 'bilet', 'ödül', 'şans', 'lottery', 'raffle'],
  openGraph: {
    title: 'Çekiliş Biletleri',
    description: 'Çekiliş biletlerini topla ve büyük ödüller kazan!',
  },
}

export default function TicketsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
