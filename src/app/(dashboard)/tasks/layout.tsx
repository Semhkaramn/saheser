import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Görevler',
  description: 'Günlük ve haftalık görevleri tamamla, puan ve ödüller kazan! Her görev seni zirveye bir adım daha yaklaştırır.',
  keywords: ['görev', 'günlük görev', 'haftalık görev', 'puan kazan', 'task', 'daily task'],
  openGraph: {
    title: 'Görevler',
    description: 'Günlük ve haftalık görevleri tamamla, puan ve ödüller kazan!',
  },
}

export default function TasksLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
