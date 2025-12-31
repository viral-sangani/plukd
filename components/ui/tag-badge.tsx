'use client'

import type { Tag } from '@/types'
import { TAG_LABELS } from '@/lib/constants'
import { cn } from '@/lib/utils'

interface TagBadgeProps {
  tag: Tag
  className?: string
}

export function TagBadge({ tag, className }: TagBadgeProps) {
  const label = TAG_LABELS[tag]

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-sm px-2 py-1 text-xs font-medium whitespace-nowrap',
        'border border-border-subtle bg-transparent text-foreground-secondary',
        'hover:border-border hover:text-foreground transition-colors',
        className
      )}
    >
      {label}
    </span>
  )
}
