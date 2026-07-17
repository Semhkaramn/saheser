import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Profil',
  description: 'Profilini görüntüle ve düzenle. Puanlarını, rütbeni ve başarılarını takip et.',
  keywords: ['profil', 'hesap', 'puan', 'rütbe', 'başarı', 'profile'],
  openGraph: {
    title: 'Profil',
    description: 'Profilini görüntüle ve düzenle. Puanlarını, rütbeni ve başarılarını takip et.',
  },
}

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
