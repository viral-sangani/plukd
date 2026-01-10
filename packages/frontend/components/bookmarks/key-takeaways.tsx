'use client'

import { Zap, Lightbulb, Clock, Bookmark } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { KeyTakeaway, TakeawayType } from '@plukd/shared'

interface KeyTakeawaysProps {
  takeaways: KeyTakeaway[]
  className?: string
}

/**
 * Get icon and styling for each takeaway type
 */
function getTakeawayConfig(type: TakeawayType) {
  switch (type) {
    case 'action':
      return {
        icon: Zap,
        label: 'Try',
        color: 'text-green-400',
        bgColor: 'bg-green-400/10',
        borderColor: 'border-green-400/20',
      }
    case 'idea':
      return {
        icon: Lightbulb,
        label: 'Idea',
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-400/10',
        borderColor: 'border-yellow-400/20',
      }
    case 'reminder':
      return {
        icon: Clock,
        label: 'Remember',
        color: 'text-blue-400',
        bgColor: 'bg-blue-400/10',
        borderColor: 'border-blue-400/20',
      }
    case 'reference':
      return {
        icon: Bookmark,
        label: 'Reference',
        color: 'text-purple-400',
        bgColor: 'bg-purple-400/10',
        borderColor: 'border-purple-400/20',
      }
    default:
      return {
        icon: Zap,
        label: 'Note',
        color: 'text-foreground-muted',
        bgColor: 'bg-background-emphasis',
        borderColor: 'border-border',
      }
  }
}

/**
 * Individual takeaway item component
 */
function TakeawayItem({ takeaway }: { takeaway: KeyTakeaway }) {
  const config = getTakeawayConfig(takeaway.type)
  const Icon = config.icon

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-none border transition-colors',
        config.bgColor,
        config.borderColor,
        'hover:bg-background-emphasis/50'
      )}
    >
      <div className={cn('flex-shrink-0 mt-0.5', config.color)}>
        <Icon className="size-4" />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-mono text-foreground leading-relaxed">
          {takeaway.text}
        </span>
      </div>
      <span
        className={cn(
          'flex-shrink-0 text-[9px] font-mono font-medium uppercase tracking-wider px-1.5 py-0.5 rounded-none',
          config.color,
          config.bgColor,
          'border',
          config.borderColor
        )}
      >
        {config.label}
      </span>
    </div>
  )
}

/**
 * Display key takeaways from bookmarked content
 * Shows actionable items, ideas, reminders, and references
 */
export function KeyTakeaways({ takeaways, className }: KeyTakeawaysProps) {
  if (!takeaways || takeaways.length === 0) {
    return null
  }

  return (
    <section className={cn('mb-8', className)}>
      <h2 className="text-[10px] font-mono font-medium uppercase tracking-[0.15em] text-foreground-muted mb-3">
        Key Takeaways ({takeaways.length})
      </h2>
      <div className="space-y-2">
        {takeaways.map((takeaway, index) => (
          <TakeawayItem key={index} takeaway={takeaway} />
        ))}
      </div>
    </section>
  )
}
