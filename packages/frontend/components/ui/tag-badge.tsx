'use client'

import type { Tag } from '@plukd/shared'
import { TAG_LABELS } from '@plukd/shared'
import { cn } from '@/lib/utils'

interface TagBadgeProps {
  tag: Tag
  className?: string
  interactive?: boolean
}

export function TagBadge({ tag, className, interactive = true }: TagBadgeProps) {
  const label = TAG_LABELS[tag]

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-none px-2 py-1 text-[10px] font-mono font-medium uppercase tracking-wider whitespace-nowrap',
        'border border-border-subtle bg-transparent text-foreground-muted',
        interactive && 'hover:border-accent/50 hover:text-accent cursor-pointer',
        'transition-colors',
        className
      )}
    >
      {label}
    </span>
  )
}
