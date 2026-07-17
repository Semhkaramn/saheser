import { LoadingSpinner } from '@/components/LoadingSpinner'

// Next.js bu ekranı, sayfa server component'i veriyi çekerken ANINDA gösterir.
// Bu dosya olmadan, veri çekimi bitene kadar ekran boş/donmuş görünüyordu -
// sayfalar arası geçişin "yavaş / direkt yüklenmiyor" hissi büyük ölçüde buradan
// kaynaklanıyordu.
export default function DashboardLoading() {
  return <LoadingSpinner fullscreen={false} className="min-h-[60vh]" />
}
