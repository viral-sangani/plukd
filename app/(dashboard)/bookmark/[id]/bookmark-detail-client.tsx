'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ArrowLeft,
  ExternalLink,
  Sparkles,
  Brain,
  Calendar,
  Tag,
  Loader2,
  AlertCircle,
  Trash2,
} from 'lucide-react'
import { SourceBadge } from '@/components/ui/source-badge'
import { CategoryBadge } from '@/components/ui/category-badge'
import { Button } from '@/components/ui/button'
import { TAG_LABELS } from '@/lib/constants'
import { useBookmark, useDeleteBookmark } from '@/lib/hooks'
import { getBookmarkById } from '@/lib/mock-data'
import { BookmarkMetadataSection } from './bookmark-metadata-section'
import type { Bookmark } from '@/types'

interface BookmarkDetailClientProps {
  id: string
  initialBookmark?: Bookmark
}

export function BookmarkDetailClient({ id, initialBookmark }: BookmarkDetailClientProps) {
  const router = useRouter()
  const { data: bookmark, isLoading, isError, error } = useBookmark(id)
  const deleteBookmark = useDeleteBookmark()

  // Use fetched data, or initial bookmark from server, or fall back to mock data
  const displayBookmark = bookmark ?? initialBookmark ?? getBookmarkById(id)

  // Show toast on successful load
  useEffect(() => {
    if (bookmark) {
      toast.success('Bookmark loaded', {
        description: bookmark.title,
      })
    }
  }, [bookmark])

  const handleDelete = async () => {
    if (!displayBookmark) return

    try {
      await deleteBookmark.mutateAsync({ id })
      toast.success('Bookmark deleted')
      router.push('/')
    } catch (err) {
      toast.error('Failed to delete bookmark', {
        description: err instanceof Error ? err.message : 'Please try again',
      })
    }
  }

  // Loading state
  if (isLoading && !displayBookmark) {
    return (
      <div className="max-w-3xl mx-auto py-8 px-4 lg:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-[#a1a1aa] hover:text-[#fafafa] transition-colors mb-8 group"
        >
          <ArrowLeft className="size-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium">Back to Bookmarks</span>
        </Link>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="size-8 animate-spin text-[#a1a1aa]" />
          <span className="ml-3 text-[#a1a1aa]">Loading bookmark...</span>
        </div>
      </div>
    )
  }

  // Error state with no fallback data
  if (isError && !displayBookmark) {
    return (
      <div className="max-w-3xl mx-auto py-8 px-4 lg:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-[#a1a1aa] hover:text-[#fafafa] transition-colors mb-8 group"
        >
          <ArrowLeft className="size-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium">Back to Bookmarks</span>
        </Link>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <AlertCircle className="size-12 text-red-500 mb-4" />
          <h2 className="text-xl font-semibold text-[#fafafa] mb-2">
            Failed to load bookmark
          </h2>
          <p className="text-[#a1a1aa]">
            {error instanceof Error ? error.message : 'An error occurred'}
          </p>
          <Button
            variant="outline"
            className="mt-6"
            onClick={() => router.push('/')}
          >
            Return to Bookmarks
          </Button>
        </div>
      </div>
    )
  }

  // No bookmark found
  if (!displayBookmark) {
    return (
      <div className="max-w-3xl mx-auto py-8 px-4 lg:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-[#a1a1aa] hover:text-[#fafafa] transition-colors mb-8 group"
        >
          <ArrowLeft className="size-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium">Back to Bookmarks</span>
        </Link>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <AlertCircle className="size-12 text-[#71717a] mb-4" />
          <h2 className="text-xl font-semibold text-[#fafafa] mb-2">
            Bookmark not found
          </h2>
          <p className="text-[#a1a1aa]">
            The bookmark you are looking for does not exist.
          </p>
          <Button
            variant="outline"
            className="mt-6"
            onClick={() => router.push('/')}
          >
            Return to Bookmarks
          </Button>
        </div>
      </div>
    )
  }

  const {
    title,
    author,
    author_url,
    source,
    url,
    blurb,
    summary,
    category,
    tags,
    created_at,
    raw_metadata,
    media_urls,
  } = displayBookmark

  // Format date
  const formattedDate = new Date(created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 lg:px-6">
      {/* Back Button */}
      <div className="flex items-center justify-between mb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-[#a1a1aa] hover:text-[#fafafa] transition-colors group"
        >
          <ArrowLeft className="size-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium">Back to Bookmarks</span>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className="text-[#71717a] hover:text-red-500 hover:bg-red-500/10"
          onClick={handleDelete}
          disabled={deleteBookmark.isPending}
        >
          {deleteBookmark.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Trash2 className="size-4" />
          )}
          <span className="sr-only">Delete bookmark</span>
        </Button>
      </div>

      {/* Title Section */}
      <div className="space-y-4 mb-8">
        <h1 className="text-3xl font-bold text-[#fafafa] leading-tight tracking-tight">
          {title}
        </h1>

        <div className="flex flex-wrap items-center gap-3">
          {author && (
            <span className="text-[#a1a1aa] text-sm">
              by <span className="text-[#fafafa] font-medium">{author}</span>
            </span>
          )}
          <SourceBadge source={source} size="sm" />
        </div>

        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-[#71717a] hover:text-[#a1a1aa] transition-colors break-all"
        >
          <ExternalLink className="size-3.5 flex-shrink-0" />
          <span className="truncate max-w-md">{url}</span>
        </a>
      </div>

      {/* AI TLDR Section */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="size-5 text-[#fafafa]" />
          <h2 className="text-lg font-semibold text-[#fafafa]">TL;DR</h2>
        </div>
        <div className="rounded-lg bg-[#18181b] border border-[#27272a] p-5">
          <p className="text-[#a1a1aa] leading-relaxed">{blurb}</p>
        </div>
      </section>

      {/* AI Summary Section */}
      {summary && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="size-5 text-[#fafafa]" />
            <h2 className="text-lg font-semibold text-[#fafafa]">AI Summary</h2>
          </div>
          <div className="rounded-lg bg-[#18181b] border border-[#27272a] p-5">
            <p className="text-[#a1a1aa] leading-relaxed whitespace-pre-line">
              {summary}
            </p>
          </div>
        </section>
      )}

      {/* Media Gallery & OG Metadata Section */}
      <BookmarkMetadataSection
        rawMetadata={raw_metadata}
        source={source}
        authorUrl={author_url}
        mediaUrls={media_urls}
      />

      {/* View Original Button */}
      <section className="mb-8">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-[#fafafa] text-[#09090b] font-medium hover:bg-[#e4e4e7] transition-colors"
        >
          <ExternalLink className="size-4" />
          View Original
        </a>
      </section>

      {/* Metadata Footer */}
      <footer className="pt-6 border-t border-[#27272a]">
        <div className="flex flex-wrap items-center gap-4">
          {/* Category */}
          <CategoryBadge category={category} />

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex items-center gap-2">
              <Tag className="size-3.5 text-[#71717a]" />
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#27272a] text-[#a1a1aa]"
                  >
                    {TAG_LABELS[tag]}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Date Added */}
          <div className="flex items-center gap-1.5 text-[#71717a] text-sm ml-auto">
            <Calendar className="size-3.5" />
            <span>Added {formattedDate}</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
