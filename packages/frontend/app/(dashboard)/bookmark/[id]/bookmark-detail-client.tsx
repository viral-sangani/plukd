'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ArrowLeft,
  ExternalLink,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  Trash2,
  Sparkles,
} from 'lucide-react'
import { SourceBadge } from '@/components/ui/source-badge'
import { CategoryBadge } from '@/components/ui/category-badge'
import { Button } from '@/components/ui/button'
import { ResourceList } from '@/components/bookmarks/resource-list'
import { TAG_LABELS } from '@plukd/shared/constants'
import { useBookmark, useDeleteBookmark } from '@/lib/hooks'
import { api } from '@/lib/api/client'
import type { Bookmark, RawMetadata, ExtractedResource } from '@plukd/shared/types'

interface BookmarkDetailClientProps {
  id: string
  initialBookmark?: Bookmark
}

function getThumbnailUrl(bookmark: Bookmark): string | null {
  if (bookmark.media_urls && bookmark.media_urls.length > 0) {
    return bookmark.media_urls[0]
  }
  const rawMetadata = bookmark.raw_metadata as RawMetadata | null
  if (rawMetadata?.og?.image) {
    return rawMetadata.og.image
  }
  return null
}

function formatDisplayUrl(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/**
 * Renders text with simple markdown formatting as React elements.
 * Handles **bold** text safely without dangerouslySetInnerHTML.
 */
function MarkdownText({ text }: { text: string }) {
  // Split text by **bold** patterns and render appropriately
  const parts = text.split(/(\*\*[^*]+\*\*)/g)

  return (
    <>
      {parts.map((part, index) => {
        // Check if this part is bold (wrapped in **)
        if (part.startsWith('**') && part.endsWith('**')) {
          const boldText = part.slice(2, -2)
          return (
            <strong key={index} className="text-foreground font-medium">
              {boldText}
            </strong>
          )
        }
        return <span key={index}>{part}</span>
      })}
    </>
  )
}

const PROCESSING_TIMEOUT_MS = 300000 // 5 minutes

export function BookmarkDetailClient({ id, initialBookmark }: BookmarkDetailClientProps) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [processingTimedOut, setProcessingTimedOut] = useState(false)
  const processingStartTimeRef = useRef<number | null>(null)
  const { data: bookmark, isLoading, isError, error, refetch } = useBookmark(id)
  // Store refetch in a ref to avoid it being a dependency that triggers re-renders
  const refetchRef = useRef(refetch)
  refetchRef.current = refetch
  const deleteBookmark = useDeleteBookmark()

  // Use fetched data or initial bookmark from server
  const displayBookmark = bookmark ?? initialBookmark

  // Check if AI processing is in progress (must be before any conditional returns)
  const isProcessing = displayBookmark?.processing_status === 'pending' || displayBookmark?.processing_status === 'processing'

  // Auto-poll when processing is in progress with timeout detection
  useEffect(() => {
    if (!isProcessing) {
      // Reset refs when processing completes
      processingStartTimeRef.current = null
      return
    }

    if (processingTimedOut) return

    // Initialize start time when processing begins
    if (processingStartTimeRef.current === null) {
      processingStartTimeRef.current = Date.now()
    }

    const interval = setInterval(() => {
      // Check for timeout
      if (processingStartTimeRef.current && Date.now() - processingStartTimeRef.current > PROCESSING_TIMEOUT_MS) {
        setProcessingTimedOut(true)
        return
      }
      refetchRef.current()
    }, 3000) // Poll every 3 seconds

    return () => clearInterval(interval)
    // Note: refetch is not in deps because we use refetchRef to avoid re-creating the interval
  }, [isProcessing, processingTimedOut])

  // Reset timeout state when processing completes
  useEffect(() => {
    if (!isProcessing && processingTimedOut) {
      // Defer to avoid synchronous setState in effect
      const timeoutId = setTimeout(() => {
        setProcessingTimedOut(false)
      }, 0)
      return () => clearTimeout(timeoutId)
    }
  }, [isProcessing, processingTimedOut])

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

  const handleCopyUrl = async () => {
    if (!displayBookmark) return
    await navigator.clipboard.writeText(displayBookmark.url)
    setCopied(true)
    toast.success('URL copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRegenerate = async () => {
    if (!displayBookmark) return

    setIsRegenerating(true)
    try {
      await api.post('/api/bookmarks/process', { bookmarkId: id })

      toast.success('Regenerating AI summary...', {
        description: 'This may take a few moments',
      })

      // Poll for completion by refetching until processing is done
      const pollForCompletion = async (attempts = 0): Promise<void> => {
        if (attempts >= 30) {
          toast.error('Processing is taking longer than expected', {
            description: 'Please refresh the page to check the status',
          })
          setIsRegenerating(false)
          return
        }

        await new Promise((resolve) => setTimeout(resolve, 2000))
        const { data: updatedBookmark } = await refetch()

        if (
          updatedBookmark?.processing_status === 'completed' ||
          updatedBookmark?.processing_status === 'failed'
        ) {
          setIsRegenerating(false)
          if (updatedBookmark.processing_status === 'completed') {
            toast.success('AI summary regenerated successfully')
          } else {
            toast.error('Failed to regenerate summary', {
              description: updatedBookmark.processing_error || 'Please try again',
            })
          }
          return
        }

        return pollForCompletion(attempts + 1)
      }

      pollForCompletion()
    } catch (err) {
      setIsRegenerating(false)
      toast.error('Failed to regenerate summary', {
        description: err instanceof Error ? err.message : 'Please try again',
      })
    }
  }

  // Loading state
  if (isLoading && !displayBookmark) {
    return (
      <div className="max-w-4xl mx-auto py-6 px-4 lg:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-mono text-foreground-muted hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="size-4" />
          <span>Back</span>
        </Link>
        <div className="relative bg-background-muted border border-border rounded-none p-8" data-corners="diagonal">
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-6 animate-spin text-foreground-muted" />
            <span className="ml-3 text-sm font-mono text-foreground-muted">Loading bookmark...</span>
          </div>
        </div>
      </div>
    )
  }

  // Error state with no fallback data
  if (isError && !displayBookmark) {
    return (
      <div className="max-w-4xl mx-auto py-6 px-4 lg:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-mono text-foreground-muted hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="size-4" />
          <span>Back</span>
        </Link>
        <div className="relative bg-background-muted border border-border rounded-none p-8" data-corners="diagonal">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AlertCircle className="size-10 text-red-500 mb-4" />
            <h2 className="text-lg font-mono font-medium text-foreground mb-2">
              Failed to load bookmark
            </h2>
            <p className="text-sm font-mono text-foreground-muted mb-6">
              {error instanceof Error ? error.message : 'An error occurred'}
            </p>
            <Button variant="outline" onClick={() => router.push('/')}>
              Return to Bookmarks
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // No bookmark found
  if (!displayBookmark) {
    return (
      <div className="max-w-4xl mx-auto py-6 px-4 lg:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-mono text-foreground-muted hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="size-4" />
          <span>Back</span>
        </Link>
        <div className="relative bg-background-muted border border-border rounded-none p-8" data-corners="diagonal">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AlertCircle className="size-10 text-foreground-muted mb-4" />
            <h2 className="text-lg font-mono font-medium text-foreground mb-2">
              Bookmark not found
            </h2>
            <p className="text-sm font-mono text-foreground-muted mb-6">
              The bookmark you are looking for does not exist.
            </p>
            <Button variant="outline" onClick={() => router.push('/')}>
              Return to Bookmarks
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const {
    title,
    author,
    source,
    url,
    blurb,
    summary,
    category,
    tags,
    created_at,
  } = displayBookmark

  const thumbnailUrl = getThumbnailUrl(displayBookmark)

  const formattedDate = new Date(created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 lg:px-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-mono text-foreground-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          <span>Back</span>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className="group text-foreground-muted hover:text-red-400 hover:bg-red-500/10"
          onClick={handleDelete}
          disabled={deleteBookmark.isPending}
        >
          {deleteBookmark.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Trash2 className="size-4 transition-colors group-hover:text-red-400" />
          )}
          <span className="sr-only">Delete bookmark</span>
        </Button>
      </div>

      {/* Main Content Card */}
      <div className="relative bg-background-muted border border-border rounded-none p-6 lg:p-8" data-corners="diagonal">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-start gap-6 mb-8">
          {/* Thumbnail */}
          {thumbnailUrl && (
            <div className="relative w-full lg:w-48 h-32 lg:h-28 flex-shrink-0 overflow-hidden rounded-none bg-background-emphasis border border-border">
              <Image
                src={thumbnailUrl}
                alt=""
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 192px"
                unoptimized
              />
            </div>
          )}

          {/* Title & Meta */}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl lg:text-2xl font-mono font-medium text-foreground leading-tight mb-3">
              {isProcessing && title === url ? 'Processing bookmark...' : title}
            </h1>
            <div className="flex flex-wrap items-center gap-3">
              <SourceBadge source={source} size="sm" />
              {author && (
                <span className="text-sm font-mono text-foreground-muted">
                  by <span className="text-foreground">{author}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* TL;DR Section */}
        {blurb && (
          <section className="mb-8">
            <h2 className="text-[10px] font-mono font-medium uppercase tracking-[0.15em] text-foreground-muted mb-3">
              TL;DR
            </h2>
            <div className="bg-background border border-border rounded-none p-4">
              <p className="text-sm font-mono text-foreground-muted leading-relaxed">
                {blurb}
              </p>
            </div>
          </section>
        )}

        {/* Summary Section */}
        {summary && (
          <section className="mb-8">
            <h2 className="text-[10px] font-mono font-medium uppercase tracking-[0.15em] text-foreground-muted mb-3">
              Summary
            </h2>
            <div className="bg-background border border-border rounded-none p-4">
              <p className="text-sm font-mono text-foreground-muted leading-relaxed whitespace-pre-line">
                <MarkdownText text={summary} />
              </p>
            </div>
          </section>
        )}

        {/* Extracted Resources (for list-type content) */}
        {displayBookmark.extracted_resources && displayBookmark.extracted_resources.length > 0 && (
          <ResourceList resources={displayBookmark.extracted_resources as ExtractedResource[]} />
        )}

        {/* AI Processing Status / Regenerate Button */}
        {displayBookmark.processing_status === 'failed' ? (
          <section className="mb-8">
            <div className="bg-red-500/5 border border-red-500/20 rounded-none p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="size-5 text-red-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-mono font-medium text-red-400">
                    Processing failed
                  </p>
                  <p className="text-xs font-mono text-foreground-muted mt-0.5">
                    {displayBookmark.processing_error || 'An error occurred while processing this bookmark.'}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="font-mono flex-shrink-0 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                onClick={handleRegenerate}
                disabled={isRegenerating}
              >
                {isRegenerating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                Retry
              </Button>
            </div>
          </section>
        ) : processingTimedOut && isProcessing ? (
          <section className="mb-8">
            <div className="bg-red-500/5 border border-red-500/20 rounded-none p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="size-5 text-red-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-mono font-medium text-red-400">
                    Processing is taking longer than expected
                  </p>
                  <p className="text-xs font-mono text-foreground-muted mt-0.5">
                    The bookmark may be stuck. Try regenerating the summary.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="font-mono flex-shrink-0 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                onClick={handleRegenerate}
                disabled={isRegenerating}
              >
                <Sparkles className="size-4" />
                Regenerate
              </Button>
            </div>
          </section>
        ) : isProcessing || isRegenerating ? (
          <section className="mb-8">
            <div className="bg-accent/5 border border-accent/20 rounded-none p-4 flex items-center gap-3">
              <Loader2 className="size-5 animate-spin text-accent" />
              <div>
                <p className="text-sm font-mono font-medium text-accent">
                  Generating AI summary...
                </p>
                <p className="text-xs font-mono text-foreground-muted mt-0.5">
                  This usually takes 10-30 seconds
                </p>
              </div>
            </div>
          </section>
        ) : (!blurb || !summary) ? (
          <section className="mb-8">
            <div className="bg-background border border-dashed border-border rounded-none p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-mono text-foreground-muted">
                  AI summary is missing or incomplete
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="font-mono"
                onClick={handleRegenerate}
                disabled={isRegenerating}
              >
                <Sparkles className="size-4" />
                Generate Summary
              </Button>
            </div>
          </section>
        ) : (
          <section className="mb-8">
            <Button
              variant="outline"
              size="sm"
              className="font-mono text-foreground-muted hover:text-foreground"
              onClick={handleRegenerate}
              disabled={isRegenerating}
            >
              <Sparkles className="size-4" />
              Regenerate AI Summary
            </Button>
          </section>
        )}

        {/* Metadata Section */}
        <section className="mb-8">
          <h2 className="text-[10px] font-mono font-medium uppercase tracking-[0.15em] text-foreground-muted mb-3">
            Details
          </h2>
          <div className="bg-background border border-border rounded-none divide-y divide-border">
            {/* Category */}
            <div className="flex items-center justify-between p-4">
              <span className="text-sm font-mono text-foreground-muted">Category</span>
              <CategoryBadge category={category} />
            </div>

            {/* Tags */}
            {tags.length > 0 && (
              <div className="flex items-center justify-between p-4">
                <span className="text-sm font-mono text-foreground-muted">Tags</span>
                <div className="flex flex-wrap gap-1.5 justify-end">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-2 py-0.5 rounded-none text-[10px] font-mono font-medium uppercase tracking-wider bg-background-emphasis text-foreground-muted border border-border"
                    >
                      {TAG_LABELS[tag]}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Source URL */}
            <div className="flex items-center justify-between p-4">
              <span className="text-sm font-mono text-foreground-muted">Source</span>
              <span className="text-sm font-mono text-foreground">{formatDisplayUrl(url)}</span>
            </div>

            {/* Date Added */}
            <div className="flex items-center justify-between p-4">
              <span className="text-sm font-mono text-foreground-muted">Added</span>
              <span className="text-sm font-mono text-foreground">{formattedDate}</span>
            </div>
          </div>
        </section>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button variant="default" className="flex-1 font-mono" asChild>
            <a href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-4" />
              View Original
            </a>
          </Button>
          <Button
            variant="outline"
            className="flex-1 font-mono group"
            onClick={handleCopyUrl}
          >
            {copied ? (
              <>
                <Check className="size-4 text-green-400" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="size-4 transition-colors text-foreground-muted group-hover:text-accent" />
                Copy URL
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
