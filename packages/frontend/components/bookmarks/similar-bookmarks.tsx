'use client'

import Link from 'next/link'
import { useSimilarBookmarks } from '@/lib/hooks/use-similar-bookmarks'
import { SourceBadge } from '@/components/ui/source-badge'
import { Sparkles, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SimilarBookmarksProps {
  bookmarkId: string
  className?: string
}

export function SimilarBookmarks({ bookmarkId, className }: SimilarBookmarksProps) {
  const { data, isLoading, error } = useSimilarBookmarks({
    bookmarkId,
    limit: 5,
    threshold: 0.7,
  })

  if (isLoading) {
    return (
      <div className={cn('space-y-3', className)}>
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-foreground-muted" />
          <h3 className="text-base font-medium">Similar Bookmarks</h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="size-6 animate-spin text-foreground-muted" />
        </div>
      </div>
    )
  }

  // Don't show section if semantic search is unavailable (503) or other errors
  if (error) {
    return null
  }

  // Don't show section if no similar bookmarks found
  if (!data || data.count === 0) {
    return null
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2">
        <Sparkles className="size-5 text-foreground-muted" />
        <h3 className="text-base font-medium">Similar Bookmarks</h3>
        <span className="text-sm text-foreground-muted">({data.count})</span>
      </div>

      <div className="space-y-2">
        {data.results.map((bookmark) => (
          <Link
            key={bookmark.id}
            href={`/bookmark/${bookmark.id}`}
            className="group flex items-center gap-3 rounded-lg border border-border-muted bg-background-secondary p-3 transition-all hover:border-border hover:bg-background-tertiary"
          >
            {/* Thumbnail */}
            {bookmark.media_urls?.[0] && (
              <div className="shrink-0">
                <img
                  src={bookmark.media_urls[0]}
                  alt=""
                  className="size-8 rounded object-cover"
                />
              </div>
            )}

            {/* Content */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <SourceBadge source={bookmark.source} size="sm" />
                {bookmark.similarity && (
                  <span className="rounded bg-foreground-muted/10 px-1.5 py-0.5 text-[10px] text-foreground-muted">
                    {Math.round(bookmark.similarity * 100)}%
                  </span>
                )}
              </div>
              <h4 className="mt-1 truncate text-sm font-medium group-hover:text-accent">
                {bookmark.title}
              </h4>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
