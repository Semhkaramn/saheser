'use client'

import PromotionListPage from '@/components/promotions/PromotionListPage'
import { Sparkles } from 'lucide-react'

export default function PromosyonlarPage() {
  return (
    <PromotionListPage
      type="promotion"
      title="Promosyonlar"
      subtitle="Güncel promosyonları kaçırma"
      icon={Sparkles}
      basePath="/promosyonlar"
    />
  )
}
