'use client'

import Link from 'next/link'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { truncateText } from '@/lib/utils'

interface BookmarkHeaderProps {
  title: string
  backHref?: string
}

export function BookmarkHeader({ title, backHref = '/' }: BookmarkHeaderProps) {
  return (
    <div className="space-y-4">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        asChild
        className="gap-2 text-foreground-secondary hover:text-foreground -ml-2"
      >
        <Link href={backHref}>
          <ArrowLeft className="size-4" />
          Back
        </Link>
      </Button>

      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm">
        <Link
          href="/"
          className="text-foreground-secondary hover:text-foreground transition-colors"
        >
          Bookmarks
        </Link>
        <ChevronRight className="size-4 text-foreground-muted" />
        <span className="text-foreground-muted">
          {truncateText(title, 50)}
        </span>
      </nav>
    </div>
  )
}
