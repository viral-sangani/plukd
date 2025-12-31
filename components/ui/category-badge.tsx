'use client'

import type { Category } from '@/types'
import { CATEGORY_LABELS } from '@/lib/constants'
import { cn } from '@/lib/utils'

interface CategoryBadgeProps {
  category: Category
  className?: string
}

export function CategoryBadge({ category, className }: CategoryBadgeProps) {
  // Fallback for unknown categories (e.g., old data with deprecated category values)
  const label = CATEGORY_LABELS[category] || formatCategoryFallback(category)

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-sm px-2 py-1 text-xs font-medium text-white whitespace-nowrap bg-[#262626]',
        className
      )}
    >
      {label}
    </span>
  )
}

/**
 * Formats a category slug as a readable label when no mapping exists
 * e.g., 'tech-development' -> 'Tech Development'
 */
function formatCategoryFallback(category: string): string {
  return category
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
