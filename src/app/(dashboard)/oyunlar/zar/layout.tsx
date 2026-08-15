import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Zar',
  description: 'Hedefini seç, zarı at, kazan!',
}

export default function DiceLayout({ children }: { children: React.ReactNode }) {
  return children
}
