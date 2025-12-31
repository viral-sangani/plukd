'use client'

import Link from 'next/link'
import type { Bookmark } from '@/types'
import { SourceBadge } from '@/components/ui/source-badge'
import { CategoryBadge } from '@/components/ui/category-badge'
import { TagBadge } from '@/components/ui/tag-badge'
import { TableCell, TableRow } from '@/components/ui/table'
import { formatRelativeTime, truncateText } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface BookmarkRowProps {
  bookmark: Bookmark
  className?: string
}

export function BookmarkRow({ bookmark, className }: BookmarkRowProps) {
  // Show max 2 tags
  const visibleTags = bookmark.tags.slice(0, 2)
  const remainingTagsCount = bookmark.tags.length - visibleTags.length

  return (
    <TableRow
      className={cn(
        'group cursor-pointer transition-colors',
        'hover:bg-background-emphasis',
        'border-b border-border-subtle',
        className
      )}
    >
      <TableCell className="w-[120px] py-4">
        <Link href={`/bookmark/${bookmark.id}`} className="block">
          <SourceBadge source={bookmark.source} size="sm" />
        </Link>
      </TableCell>

      <TableCell className="py-4">
        <Link href={`/bookmark/${bookmark.id}`} className="block space-y-1">
          <div className="font-medium text-foreground group-hover:text-accent transition-colors line-clamp-1">
            {bookmark.title}
          </div>
          <div className="text-sm text-foreground-secondary line-clamp-1">
            {truncateText(bookmark.blurb, 100)}
          </div>
        </Link>
      </TableCell>

      <TableCell className="w-[160px] py-4">
        <Link href={`/bookmark/${bookmark.id}`} className="block">
          <CategoryBadge category={bookmark.category} />
        </Link>
      </TableCell>

      <TableCell className="w-[180px] py-4">
        <Link href={`/bookmark/${bookmark.id}`} className="block">
          <div className="flex items-center gap-1.5 flex-wrap">
            {visibleTags.map((tag) => (
              <TagBadge key={tag} tag={tag} />
            ))}
            {remainingTagsCount > 0 && (
              <span className="text-xs text-foreground-muted">
                +{remainingTagsCount}
              </span>
            )}
          </div>
        </Link>
      </TableCell>

      <TableCell className="w-[100px] py-4 text-right">
        <Link href={`/bookmark/${bookmark.id}`} className="block">
          <span className="text-sm text-foreground-muted">
            {formatRelativeTime(bookmark.created_at)}
          </span>
        </Link>
      </TableCell>
    </TableRow>
  )
}
