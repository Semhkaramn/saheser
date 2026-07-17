import type { ReactNode } from 'react'
import { ArrowUpRight, ArrowDownRight } from 'lucide-react'

// Bu üç bileşen daha önce hem admin/dashboard/page.tsx hem de
// admin/users/[id]/page.tsx içinde birebir aynı şekilde (kopyala-yapıştır)
// tanımlanmıştı. Tek bir yerde toplanınca ikisi de bu dosyayı kullanıyor -
// biri güncellenince diğeri unutulup tutarsız kalma riski ortadan kalkıyor.

type CardColor = 'slate' | 'emerald' | 'amber' | 'rose' | 'blue' | 'purple' | 'cyan' | 'orange'

const colorClasses: Record<CardColor, string> = {
  slate: 'bg-slate-500/10 text-slate-400 border-slate-700/50',
  emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-700/50',
  amber: 'bg-amber-500/10 text-amber-400 border-amber-700/50',
  rose: 'bg-rose-500/10 text-rose-400 border-rose-700/50',
  blue: 'bg-blue-500/10 text-blue-400 border-blue-700/50',
  purple: 'bg-purple-500/10 text-purple-400 border-purple-700/50',
  cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-700/50',
  orange: 'bg-orange-500/10 text-orange-400 border-orange-700/50',
}

const iconColorClasses: Record<CardColor, string> = {
  slate: 'text-slate-400',
  emerald: 'text-emerald-400',
  amber: 'text-amber-400',
  rose: 'text-rose-400',
  blue: 'text-blue-400',
  purple: 'text-purple-400',
  cyan: 'text-cyan-400',
  orange: 'text-orange-400',
}

export function StatCard({
  icon: Icon,
  label,
  value,
  subValue,
  color = 'slate',
  trend,
  trendValue,
}: {
  icon: React.ElementType
  label: string
  value: number | string
  subValue?: string
  color?: CardColor
  trend?: 'up' | 'down'
  trendValue?: string
}) {
  return (
    <div className={`rounded-xl border p-4 ${colorClasses[color]} backdrop-blur-sm transition-all hover:scale-[1.02]`}>
      <div className="flex items-start justify-between">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon className={`w-5 h-5 ${iconColorClasses[color]}`} />
        </div>
        {trend && trendValue && (
          <div className={`flex items-center gap-1 text-xs ${trend === 'up' ? 'text-emerald-400' : 'text-rose-400'}`}>
            {trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {trendValue}
          </div>
        )}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold text-white">{typeof value === 'number' ? value.toLocaleString('tr-TR') : value}</p>
        <p className="text-xs text-slate-400 mt-1">{label}</p>
        {subValue && <p className="text-xs text-slate-500 mt-0.5">{subValue}</p>}
      </div>
    </div>
  )
}

export function MiniStatCard({
  icon: Icon,
  label,
  value,
  color = 'slate',
}: {
  icon: React.ElementType
  label: string
  value: number | string
  color?: CardColor
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/30 border border-slate-700/30">
      <Icon className={`w-4 h-4 ${iconColorClasses[color]}`} />
      <div>
        <p className="text-sm font-semibold text-white">{typeof value === 'number' ? value.toLocaleString('tr-TR') : value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  )
}

export function SectionCard({
  title,
  icon: Icon,
  children,
  color = 'slate',
  action,
}: {
  title: string
  icon: React.ElementType
  children: ReactNode
  color?: CardColor
  action?: ReactNode
}) {
  return (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-800/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${iconColorClasses[color]}`} />
          <h3 className="text-sm font-semibold text-white">{title}</h3>
        </div>
        {action}
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  )
}
