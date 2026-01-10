'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, ExternalLink, Copy, Check } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { SourceBadge } from '@/components/ui/source-badge'
import { CategoryBadge } from '@/components/ui/category-badge'
import { KeyTakeaways } from '@/components/bookmarks/key-takeaways'
import { ResourceList } from '@/components/bookmarks/resource-list'
import { TAG_LABELS } from '@plukd/shared'
import type { Bookmark, RawMetadata } from '@plukd/shared'

interface BookmarkDetailViewProps {
  bookmark: Bookmark
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

export function BookmarkDetailView({ bookmark }: BookmarkDetailViewProps) {
  const [copied, setCopied] = useState(false)
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
  } = bookmark

  const thumbnailUrl = getThumbnailUrl(bookmark)

  const formattedDate = new Date(created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  const handleCopyUrl = async () => {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 lg:px-6">
      {/* Back Button */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm font-mono text-foreground-muted hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="size-4" />
        <span>Back</span>
      </Link>

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
              {title}
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
                {summary}
              </p>
            </div>
          </section>
        )}

        {/* Key Takeaways Section */}
        {bookmark.key_takeaways && bookmark.key_takeaways.length > 0 && (
          <KeyTakeaways takeaways={bookmark.key_takeaways} />
        )}

        {/* Extracted Resources Section */}
        {bookmark.extracted_resources && bookmark.extracted_resources.length > 0 && (
          <ResourceList
            resources={bookmark.extracted_resources}
            layoutHint={bookmark.resource_layout_hint}
          />
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
