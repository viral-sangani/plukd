'use client'

import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'

interface StatsCardProps {
  label: string
  value: string | number
  subValue?: string
  change?: number
  changeLabel?: string
  variant?: 'default' | 'success' | 'warning' | 'error'
  className?: string
  showWarning?: boolean
}

export function StatsCard({
  label,
  value,
  subValue,
  change,
  changeLabel,
  variant = 'default',
  className,
  showWarning = false,
}: StatsCardProps) {
  const isPositive = change !== undefined && change > 0
  const isNegative = change !== undefined && change < 0

  return (
    <div
      className={cn(
        'bg-[#0a0a0a] border border-zinc-900 p-4',
        className
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-mono font-medium uppercase tracking-[0.15em] text-zinc-500">
          {label}
        </span>
        {showWarning && (
          <AlertTriangle className="size-3 text-amber-500" />
        )}
      </div>

      <div className="flex items-baseline gap-2">
        <span
          className={cn(
            'text-2xl font-mono font-medium tabular-nums',
            variant === 'success' && 'text-green-500',
            variant === 'warning' && 'text-amber-500',
            variant === 'error' && 'text-red-500',
            variant === 'default' && 'text-white'
          )}
        >
          {value}
        </span>
        {subValue && (
          <span className="text-sm font-mono text-zinc-500">
            {subValue}
          </span>
        )}
      </div>

      {change !== undefined && (
        <div className="flex items-center gap-1 mt-1">
          {isPositive ? (
            <TrendingUp className="size-3 text-green-500" />
          ) : isNegative ? (
            <TrendingDown className="size-3 text-red-500" />
          ) : null}
          <span
            className={cn(
              'text-xs font-mono',
              isPositive && 'text-green-500',
              isNegative && 'text-red-500',
              !isPositive && !isNegative && 'text-zinc-500'
            )}
          >
            {isPositive && '+'}
            {change.toFixed(1)}%
            {changeLabel && (
              <span className="text-zinc-600 ml-1">{changeLabel}</span>
            )}
          </span>
        </div>
      )}
    </div>
  )
}

interface StatsGridProps {
  children: React.ReactNode
  className?: string
}

export function StatsGrid({ children, className }: StatsGridProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 md:grid-cols-4 gap-px bg-zinc-900',
        className
      )}
    >
      {children}
    </div>
  )
}
