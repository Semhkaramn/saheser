import DashboardLayout from '@/components/DashboardLayout'

// Bu layout, / , /wheel, /tasks, /profile*, /events*, /shop, /tickets*, /leaderboard
// sayfaları arasında PAYLAŞILIYOR. Header/Sidebar/Footer artık her sayfa geçişinde
// yeniden mount olmuyor - sadece içerik (children) değişiyor. Bu, sayfalar arası
// geçişi belirgin şekilde hızlandırır ve header/sidebar'ın her seferinde
// yanıp sönmesini (flash) engeller.
export default function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <DashboardLayout>{children}</DashboardLayout>
}
