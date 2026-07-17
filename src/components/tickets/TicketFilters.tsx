'use client'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useUserTheme } from '@/components/providers/user-theme-provider'

interface TicketFiltersProps {
  activeFilter: string
  onFilterChange: (filter: string) => void
  filters: {
    value: string
    label: string
    color?: string
  }[]
}

export function TicketFilters({ activeFilter, onFilterChange, filters }: TicketFiltersProps) {
  const { theme, tab } = useUserTheme()

  const getFilterStyle = (filter: { value: string; color?: string }, isActive: boolean) => {
    if (!isActive) return {}

    // Tema renklerini kullan
    switch (filter.color) {
      case 'green':
        return {
          background: `linear-gradient(to right, ${theme.colors.success}, ${theme.colors.success})`,
          color: 'white'
        }
      case 'yellow':
        return {
          background: `linear-gradient(to right, ${theme.colors.warning}, ${theme.colors.warning})`,
          color: 'white'
        }
      case 'gray':
        return {
          background: theme.colors.backgroundSecondary,
          color: theme.colors.textSecondary
        }
      default:
        return {
          background: `linear-gradient(to right, ${theme.colors.gradientFrom}, ${theme.colors.gradientTo})`,
          color: theme.colors.primaryForeground
        }
    }
  }

  return (
    <TabsList
      className={`grid w-full p-0.5 rounded-lg border gap-1 ${tab('list')}`}
      style={{
        gridTemplateColumns: `repeat(${filters.length}, minmax(0, 1fr))`,
        backgroundColor: theme.colors.backgroundSecondary,
        borderColor: theme.colors.border
      }}
    >
      {filters.map((filter) => {
        const isActive = activeFilter === filter.value
        return (
          <TabsTrigger
            key={filter.value}
            value={filter.value}
            onClick={() => onFilterChange(filter.value)}
            className="rounded-md text-sm transition-all duration-200"
            style={getFilterStyle(filter, isActive)}
          >
            {filter.label}
          </TabsTrigger>
        )
      })}
    </TabsList>
  )
}
