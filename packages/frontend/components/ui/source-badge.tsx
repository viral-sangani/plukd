'use client'

import type { ComponentType } from 'react'
import type { ContentSource } from '@plukd/shared'
import { SOURCE_LABELS } from '@plukd/shared'
import { cn } from '@/lib/utils'
import { TwitterIcon, RedditIcon, LinkedInIcon, YouTubeIcon, InstagramIcon } from '@/components/icons'
import { Globe } from 'lucide-react'

interface SourceBadgeProps {
  source: ContentSource
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'px-1.5 py-0.5 text-[9px] gap-1 [&>svg]:size-2.5',
  md: 'px-2 py-1 text-[10px] gap-1.5 [&>svg]:size-3',
  lg: 'px-2.5 py-1.5 text-xs gap-2 [&>svg]:size-4',
}

// Platform-specific colors with background variants for dark theme
const sourceStyles: Record<ContentSource, { bg: string; text: string; border: string }> = {
  twitter: {
    bg: 'bg-[#1da1f2]/15',
    text: 'text-[#1da1f2]',
    border: 'border-[#1da1f2]/30',
  },
  reddit: {
    bg: 'bg-[#ff4500]/15',
    text: 'text-[#ff4500]',
    border: 'border-[#ff4500]/30',
  },
  linkedin: {
    bg: 'bg-[#0077b5]/15',
    text: 'text-[#0077b5]',
    border: 'border-[#0077b5]/30',
  },
  youtube: {
    bg: 'bg-[#ff0000]/15',
    text: 'text-[#ff0000]',
    border: 'border-[#ff0000]/30',
  },
  instagram: {
    bg: 'bg-[#E4405F]/15',
    text: 'text-[#E4405F]',
    border: 'border-[#E4405F]/30',
  },
  web: {
    bg: 'bg-foreground-muted/10',
    text: 'text-foreground-muted',
    border: 'border-foreground-muted/20',
  },
}

// Map sources to their icon components
const sourceIcons: Record<ContentSource, ComponentType<{ className?: string }>> = {
  twitter: TwitterIcon,
  reddit: RedditIcon,
  linkedin: LinkedInIcon,
  youtube: YouTubeIcon,
  instagram: InstagramIcon,
  web: Globe,
}

export function SourceBadge({ source, size = 'md', className }: SourceBadgeProps) {
  const Icon = sourceIcons[source]
  const label = SOURCE_LABELS[source]
  const styles = sourceStyles[source]

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-none font-mono font-medium uppercase tracking-wider whitespace-nowrap border transition-colors',
        styles.bg,
        styles.text,
        styles.border,
        sizeClasses[size],
        className
      )}
    >
      <Icon />
      <span>{label}</span>
    </span>
  )
}
