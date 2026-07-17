import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Mağaza',
  description: 'Puanlarını harca ve özel ödüller kazan! Çeşitli ürünler ve hediyeler mağazada seni bekliyor.',
  keywords: ['mağaza', 'shop', 'ödül', 'hediye', 'puan harca', 'alışveriş'],
  openGraph: {
    title: 'Mağaza',
    description: 'Puanlarını harca ve özel ödüller kazan!',
  },
}

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
