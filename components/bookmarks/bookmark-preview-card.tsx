'use client'

import * as React from 'react'
import Image from 'next/image'
import type { Bookmark } from '@/types'
import { SourceBadge } from '@/components/ui/source-badge'
import { cn, truncateText } from '@/lib/utils'
import { User, Calendar, ExternalLink, Play } from 'lucide-react'

interface BookmarkPreviewCardProps {
  bookmark: Bookmark
  className?: string
}

/**
 * Determines if a URL points to a video based on file extension or known patterns.
 * Also detects Twitter video thumbnails which represent videos.
 */
function isVideoUrl(url: string): boolean {
  const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv']
  const lowerUrl = url.toLowerCase()

  // Check file extensions
  if (videoExtensions.some((ext) => lowerUrl.includes(ext))) {
    return true
  }

  // Check for Twitter video URLs (they contain /video/ in the path)
  if (lowerUrl.includes('video.twimg.com') || lowerUrl.includes('/ext_tw_video/')) {
    return true
  }

  // Check for Twitter video thumbnail URLs (images that represent videos)
  const twitterVideoThumbnailPatterns = [
    'amplify_video_thumb',
    'ext_tw_video_thumb',
    'tweet_video_thumb',
  ]
  if (twitterVideoThumbnailPatterns.some((pattern) => lowerUrl.includes(pattern))) {
    return true
  }

  return false
}

export function BookmarkPreviewCard({
  bookmark,
  className,
}: BookmarkPreviewCardProps) {
  // Prioritize media_urls for the thumbnail, fall back to OG image if available
  const mediaUrls = bookmark.media_urls ?? []
  const firstMediaUrl = mediaUrls[0] ?? null
  const isVideo = firstMediaUrl ? isVideoUrl(firstMediaUrl) : false

  const description = bookmark.blurb || bookmark.summary
  const truncatedDescription = truncateText(description, 100)

  // Extract domain from URL for display
  const domain = React.useMemo(() => {
    try {
      const url = new URL(bookmark.url)
      return url.hostname.replace('www.', '')
    } catch {
      return null
    }
  }, [bookmark.url])

  // Format published date
  const formattedDate = React.useMemo(() => {
    const dateStr = bookmark.published_at || bookmark.created_at
    if (!dateStr) return null
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    } catch {
      return null
    }
  }, [bookmark.published_at, bookmark.created_at])

  return (
    <div className={cn('space-y-3', className)}>
      {/* Media Thumbnail */}
      {firstMediaUrl && (
        <div className="relative w-full h-[60px] rounded-md overflow-hidden bg-background-muted">
          <Image
            src={firstMediaUrl}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 256px) 100vw, 256px"
            unoptimized
          />
          {/* Video overlay indicator */}
          {isVideo && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <div className="flex items-center justify-center size-6 rounded-full bg-white/90">
                <Play className="size-3 text-foreground fill-current ml-0.5" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Title */}
      <h4 className="font-medium text-sm text-foreground line-clamp-2 leading-tight">
        {bookmark.title}
      </h4>

      {/* Description */}
      {truncatedDescription && (
        <p className="text-xs text-foreground-secondary line-clamp-3 leading-relaxed">
          {truncatedDescription}
        </p>
      )}

      {/* Meta info row */}
      <div className="flex items-center gap-3 text-xs text-foreground-muted">
        {/* Source badge */}
        <SourceBadge source={bookmark.source} size="sm" />

        {/* Author */}
        {bookmark.author && (
          <div className="flex items-center gap-1 min-w-0">
            <User className="size-3 shrink-0" />
            <span className="truncate">{bookmark.author}</span>
          </div>
        )}
      </div>

      {/* Date and domain row */}
      <div className="flex items-center justify-between text-xs text-foreground-muted pt-1 border-t border-border-subtle">
        {/* Date */}
        {formattedDate && (
          <div className="flex items-center gap-1">
            <Calendar className="size-3" />
            <span>{formattedDate}</span>
          </div>
        )}

        {/* Domain */}
        {domain && (
          <div className="flex items-center gap-1">
            <ExternalLink className="size-3" />
            <span className="truncate max-w-[120px]">{domain}</span>
          </div>
        )}
      </div>
    </div>
  )
}
