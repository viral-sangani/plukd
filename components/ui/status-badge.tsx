'use client'

import type { ProcessingStatus } from '@/types'
import { PROCESSING_STATUS_LABELS, PROCESSING_STATUS_COLORS } from '@/lib/constants'
import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  status: ProcessingStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const label = PROCESSING_STATUS_LABELS[status]
  const colorClasses = PROCESSING_STATUS_COLORS[status]

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-sm px-2 py-1 text-xs font-medium whitespace-nowrap',
        colorClasses,
        className
      )}
    >
      {label}
    </span>
  )
}
