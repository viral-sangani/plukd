'use client'

import { ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { BookmarkHeader } from './bookmark-header'
import { BookmarkMeta } from './bookmark-meta'
import { DeleteBookmarkDialog } from './delete-bookmark-dialog'
import {
  SOURCE_COLORS,
  SOURCE_LABELS,
  CATEGORY_LABELS,
  TAG_LABELS,
} from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { Bookmark } from '@/types'

interface BookmarkDetailProps {
  bookmark: Bookmark
}

export function BookmarkDetail({ bookmark }: BookmarkDetailProps) {
  const {
    title,
    source,
    category,
    tags,
    blurb,
    summary,
    url,
  } = bookmark

  // Split summary into paragraphs
  const summaryParagraphs = summary.split('\n\n').filter(Boolean)

  return (
    <div className="space-y-8">
      {/* Header with back button and breadcrumb */}
      <BookmarkHeader title={title} />

      {/* Main content */}
      <div className="space-y-6">
        {/* Badges section */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Source badge - large and colored */}
          <Badge
            className={cn(
              SOURCE_COLORS[source],
              'text-white px-3 py-1 text-sm font-medium rounded-md'
            )}
          >
            {SOURCE_LABELS[source]}
          </Badge>

          {/* Category badge */}
          <Badge variant="outline" className="px-3 py-1 text-sm rounded-md">
            {CATEGORY_LABELS[category]}
          </Badge>

          {/* Tag badges */}
          {tags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="px-2.5 py-0.5 text-xs bg-background-emphasis text-foreground-secondary"
            >
              {TAG_LABELS[tag]}
            </Badge>
          ))}
        </div>

        {/* Title */}
        <h1 className="font-cal text-3xl md:text-4xl text-foreground leading-tight tracking-tight">
          {title}
        </h1>

        {/* Meta row */}
        <BookmarkMeta bookmark={bookmark} />

        <Separator className="bg-border-subtle" />

        {/* Blurb section - highlighted card */}
        <div className="relative rounded-lg bg-[#1c1917] border-l-4 border-l-[#fafaf9] p-6">
          <p className="text-lg text-foreground leading-relaxed italic">
            &ldquo;{blurb}&rdquo;
          </p>
        </div>

        {/* Full Summary section */}
        <div className="space-y-4">
          <h2 className="font-cal text-xl text-foreground">Summary</h2>
          <div className="space-y-4">
            {summaryParagraphs.map((paragraph, index) => (
              <p
                key={index}
                className="text-foreground-secondary leading-7 text-base"
              >
                {paragraph}
              </p>
            ))}
          </div>
        </div>

        <Separator className="bg-border-subtle" />

        {/* Actions at bottom */}
        <div className="flex flex-wrap items-center gap-4">
          <DeleteBookmarkDialog bookmarkId={bookmark.id} bookmarkTitle={title} />

          <Button variant="outline" className="gap-2" asChild>
            <a href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-4" />
              Open Original
            </a>
          </Button>
        </div>
      </div>
    </div>
  )
}
