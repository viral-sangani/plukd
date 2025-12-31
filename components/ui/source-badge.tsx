'use client'

import type { ContentSource } from '@/types'
import { SOURCE_COLORS, SOURCE_LABELS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { TwitterIcon, RedditIcon, LinkedInIcon, YouTubeIcon } from '@/components/icons'
import { Globe } from 'lucide-react'

interface SourceBadgeProps {
  source: ContentSource
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'px-1.5 py-0.5 text-[10px] gap-1 [&>svg]:size-2.5',
  md: 'px-2 py-1 text-xs gap-1.5 [&>svg]:size-3',
  lg: 'px-2.5 py-1.5 text-sm gap-2 [&>svg]:size-4',
}

function getSourceIcon(source: ContentSource) {
  switch (source) {
    case 'twitter':
      return TwitterIcon
    case 'reddit':
      return RedditIcon
    case 'linkedin':
      return LinkedInIcon
    case 'youtube':
      return YouTubeIcon
    case 'web':
    default:
      return Globe
  }
}

export function SourceBadge({ source, size = 'md', className }: SourceBadgeProps) {
  const Icon = getSourceIcon(source)
  const label = SOURCE_LABELS[source]
  const colorClass = SOURCE_COLORS[source]

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-sm font-medium text-white whitespace-nowrap',
        colorClass,
        sizeClasses[size],
        className
      )}
    >
      <Icon />
      <span>{label}</span>
    </span>
  )
}
