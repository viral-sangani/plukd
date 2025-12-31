import { ExternalLink, User, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatFullDate } from '@/lib/utils'
import { SOURCE_LABELS } from '@/lib/constants'
import type { Bookmark } from '@/types'

interface BookmarkMetaProps {
  bookmark: Bookmark
}

export function BookmarkMeta({ bookmark }: BookmarkMetaProps) {
  const { author, author_url, published_at, url, source } = bookmark

  return (
    <div className="flex flex-wrap items-center gap-4 text-sm text-foreground-secondary">
      {/* Author */}
      {author && (
        <div className="flex items-center gap-2">
          <User className="size-4" />
          {author_url ? (
            <a
              href={author_url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground hover:underline underline-offset-4 transition-colors"
            >
              {author}
            </a>
          ) : (
            <span>{author}</span>
          )}
        </div>
      )}

      {/* Published date */}
      {published_at && (
        <div className="flex items-center gap-2">
          <Calendar className="size-4" />
          <span>{formatFullDate(published_at)}</span>
        </div>
      )}

      {/* Source platform */}
      <div className="flex items-center gap-2">
        <span className="text-foreground-muted">via</span>
        <span>{SOURCE_LABELS[source]}</span>
      </div>

      {/* View original link */}
      <Button
        variant="link"
        size="sm"
        asChild
        className="gap-1.5 text-foreground-secondary hover:text-foreground p-0 h-auto"
      >
        <a href={url} target="_blank" rel="noopener noreferrer">
          View Original
          <ExternalLink className="size-3" />
        </a>
      </Button>
    </div>
  )
}
