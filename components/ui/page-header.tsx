'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-6',
        className
      )}
    >
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground font-cal tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-foreground-secondary">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 mt-4 sm:mt-0">
          {actions}
        </div>
      )}
    </div>
  )
}
