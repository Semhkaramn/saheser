import AdminLayout from '@/components/AdminLayout'

// Admin sayfalarını dinamik olarak render et (build sırasında pre-render yapma)
export const dynamic = 'force-dynamic'

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AdminLayout>{children}</AdminLayout>
}
