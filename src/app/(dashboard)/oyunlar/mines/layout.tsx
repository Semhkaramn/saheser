import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Mines',
  description: 'Mayınlardan kaçın, çarpanını büyüt, puanını al!',
}

export default function MinesLayout({ children }: { children: React.ReactNode }) {
  return children
}
