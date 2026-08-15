import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Blackjack',
  description: '21i geç, dealerı yen!',
}

export default function BlackjackLayout({ children }: { children: React.ReactNode }) {
  return children
}
