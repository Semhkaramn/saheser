'use client'

import PromotionListPage from '@/components/promotions/PromotionListPage'
import { Gift } from 'lucide-react'

export default function DenemeBonuslariPage() {
  return (
    <PromotionListPage
      type="trial_bonus"
      title="Deneme Bonusları"
      subtitle="Sponsorların sunduğu deneme bonuslarını incele"
      icon={Gift}
      basePath="/deneme-bonuslari"
    />
  )
}
