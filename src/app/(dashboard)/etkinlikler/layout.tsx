import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Etkinlikler',
  description: 'Heyecan verici etkinliklere katıl ve büyük ödüller kazan! Çekilişler, yarışmalar ve özel etkinlikler seni bekliyor.',
  keywords: ['etkinlik', 'çekiliş', 'yarışma', 'ödül', 'event', 'giveaway'],
  openGraph: {
    title: 'Etkinlikler',
    description: 'Heyecan verici etkinliklere katıl ve büyük ödüller kazan!',
  },
}

export default function EventsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
