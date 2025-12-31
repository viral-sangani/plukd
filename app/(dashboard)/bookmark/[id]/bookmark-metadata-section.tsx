'use client'

import { useState } from 'react'
import Image from 'next/image'
import {
  Image as ImageIcon,
  Images,
  Globe,
  User,
  Calendar,
  Heart,
  MessageCircle,
  Repeat2,
  Eye,
  ArrowUp,
  Users,
  Clock,
  FileText,
  ThumbsUp,
  Share2,
  Play,
  Hash,
  X,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type {
  ContentSource,
  RawMetadata,
  OGMetadata,
  TwitterMetadata,
  RedditMetadata,
  YouTubeMetadata,
  LinkedInMetadata,
  WebMetadata,
} from '@/types'

interface BookmarkMetadataSectionProps {
  rawMetadata: Record<string, unknown> | null
  source: ContentSource
  authorUrl?: string | null
  mediaUrls?: string[] | null
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`
  }
  return num.toString()
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function MetadataItem({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  href?: string
}) {
  const content = (
    <div className="flex items-center gap-2">
      <Icon className="size-4 text-[#71717a] flex-shrink-0" />
      <span className="text-[#71717a] text-sm">{label}:</span>
      <span className="text-[#fafafa] text-sm font-medium">{value}</span>
    </div>
  )

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:opacity-80 transition-opacity"
      >
        {content}
      </a>
    )
  }

  return content
}

function TwitterStats({ metadata }: { metadata: TwitterMetadata }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {metadata.likes !== undefined && (
        <MetadataItem icon={Heart} label="Likes" value={formatNumber(metadata.likes)} />
      )}
      {metadata.retweets !== undefined && (
        <MetadataItem icon={Repeat2} label="Reposts" value={formatNumber(metadata.retweets)} />
      )}
      {metadata.replies !== undefined && (
        <MetadataItem icon={MessageCircle} label="Replies" value={formatNumber(metadata.replies)} />
      )}
      {metadata.views !== undefined && (
        <MetadataItem icon={Eye} label="Views" value={formatNumber(metadata.views)} />
      )}
      {metadata.isThread && metadata.threadLength && (
        <MetadataItem icon={Hash} label="Thread" value={`${metadata.threadLength} posts`} />
      )}
    </div>
  )
}

function RedditStats({ metadata }: { metadata: RedditMetadata }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {metadata.upvotes !== undefined && (
        <MetadataItem icon={ArrowUp} label="Upvotes" value={formatNumber(metadata.upvotes)} />
      )}
      {metadata.score !== undefined && (
        <MetadataItem icon={ThumbsUp} label="Score" value={formatNumber(metadata.score)} />
      )}
      {metadata.comments !== undefined && (
        <MetadataItem icon={MessageCircle} label="Comments" value={formatNumber(metadata.comments)} />
      )}
      {metadata.community && (
        <MetadataItem icon={Users} label="Community" value={metadata.community} />
      )}
      {metadata.communityMembers !== undefined && (
        <MetadataItem icon={Users} label="Members" value={formatNumber(metadata.communityMembers)} />
      )}
    </div>
  )
}

function YouTubeStats({ metadata }: { metadata: YouTubeMetadata }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {metadata.views !== undefined && (
        <MetadataItem icon={Eye} label="Views" value={formatNumber(metadata.views)} />
      )}
      {metadata.likes !== undefined && (
        <MetadataItem icon={ThumbsUp} label="Likes" value={formatNumber(metadata.likes)} />
      )}
      {metadata.comments !== undefined && (
        <MetadataItem icon={MessageCircle} label="Comments" value={formatNumber(metadata.comments)} />
      )}
      {metadata.duration && (
        <MetadataItem icon={Play} label="Duration" value={metadata.duration} />
      )}
      {metadata.channelSubscribers !== undefined && (
        <MetadataItem icon={Users} label="Subscribers" value={formatNumber(metadata.channelSubscribers)} />
      )}
    </div>
  )
}

function LinkedInStats({ metadata }: { metadata: LinkedInMetadata }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {metadata.likes !== undefined && (
        <MetadataItem icon={ThumbsUp} label="Reactions" value={formatNumber(metadata.likes)} />
      )}
      {metadata.comments !== undefined && (
        <MetadataItem icon={MessageCircle} label="Comments" value={formatNumber(metadata.comments)} />
      )}
      {metadata.reposts !== undefined && (
        <MetadataItem icon={Share2} label="Reposts" value={formatNumber(metadata.reposts)} />
      )}
      {metadata.impressions !== undefined && (
        <MetadataItem icon={Eye} label="Impressions" value={formatNumber(metadata.impressions)} />
      )}
    </div>
  )
}

function WebStats({ metadata }: { metadata: WebMetadata }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {metadata.readingTime !== undefined && (
        <MetadataItem icon={Clock} label="Read time" value={`${metadata.readingTime} min`} />
      )}
      {metadata.wordCount !== undefined && (
        <MetadataItem icon={FileText} label="Words" value={formatNumber(metadata.wordCount)} />
      )}
    </div>
  )
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

  // Check for Twitter video URLs
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

/**
 * Media Gallery component for displaying images and videos
 */
function MediaGallery({ mediaUrls }: { mediaUrls: string[] }) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set())

  const handleImageError = (url: string) => {
    setImageErrors((prev) => new Set(prev).add(url))
  }

  // Filter out URLs that failed to load
  const validMediaUrls = mediaUrls.filter((url) => !imageErrors.has(url))

  if (validMediaUrls.length === 0) {
    return null
  }

  // Determine grid layout based on number of images
  const getGridClass = (count: number) => {
    if (count === 1) return 'grid-cols-1'
    if (count === 2) return 'grid-cols-2'
    if (count === 3) return 'grid-cols-2 sm:grid-cols-3'
    return 'grid-cols-2 sm:grid-cols-2'
  }

  return (
    <>
      <div className={`grid ${getGridClass(validMediaUrls.length)} gap-2`}>
        {validMediaUrls.slice(0, 4).map((url, index) => {
          const isVideo = isVideoUrl(url)

          return (
            <div
              key={url}
              className="relative aspect-video rounded-lg overflow-hidden bg-[#09090b] cursor-pointer group"
              onClick={() => !isVideo && setSelectedImage(url)}
            >
              {isVideo ? (
                <video
                  src={url}
                  controls
                  className="w-full h-full object-cover"
                  poster={url.replace('.mp4', '.jpg')}
                  preload="metadata"
                >
                  <source src={url} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              ) : (
                <>
                  <Image
                    src={url}
                    alt={`Media ${index + 1}`}
                    fill
                    className="object-cover transition-transform group-hover:scale-105"
                    onError={() => handleImageError(url)}
                    unoptimized
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                </>
              )}

              {/* Show remaining count on last visible image */}
              {index === 3 && validMediaUrls.length > 4 && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                  <span className="text-white text-xl font-semibold">
                    +{validMediaUrls.length - 4}
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Lightbox for full-size image viewing */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setSelectedImage(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            onClick={() => setSelectedImage(null)}
            aria-label="Close"
          >
            <X className="size-6 text-white" />
          </button>
          <div className="relative max-w-full max-h-full">
            <Image
              src={selectedImage}
              alt="Full size media"
              width={1200}
              height={800}
              className="max-w-full max-h-[90vh] object-contain"
              onClick={(e) => e.stopPropagation()}
              unoptimized
            />
          </div>
        </div>
      )}
    </>
  )
}

function OGPreviewCard({
  og,
  authorUrl,
}: {
  og: OGMetadata
  authorUrl?: string | null
}) {
  const hasImage = og.image && og.image.length > 0
  const [imageError, setImageError] = useState(false)

  return (
    <div className="rounded-lg border border-[#27272a] bg-[#18181b] overflow-hidden">
      {/* OG Image */}
      {hasImage && !imageError && (
        <div className="relative w-full aspect-video bg-[#09090b]">
          <Image
            src={og.image!}
            alt={og.title || 'Preview image'}
            fill
            className="object-cover"
            onError={() => setImageError(true)}
            unoptimized
          />
        </div>
      )}

      {/* OG Content */}
      <div className="p-4 space-y-3">
        {/* Site Name */}
        {og.siteName && (
          <div className="flex items-center gap-1.5">
            <Globe className="size-3.5 text-[#71717a]" />
            <span className="text-xs text-[#71717a] uppercase tracking-wide">
              {og.siteName}
            </span>
          </div>
        )}

        {/* Title */}
        {og.title && (
          <h3 className="text-[#fafafa] font-medium leading-snug line-clamp-2">
            {og.title}
          </h3>
        )}

        {/* Description */}
        {og.description && (
          <p className="text-[#a1a1aa] text-sm leading-relaxed line-clamp-3">
            {og.description}
          </p>
        )}

        {/* Meta info row */}
        <div className="flex flex-wrap items-center gap-4 pt-1">
          {/* Author */}
          {og.author && (
            <div className="flex items-center gap-1.5">
              <User className="size-3.5 text-[#71717a]" />
              {authorUrl ? (
                <a
                  href={authorUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#a1a1aa] hover:text-[#fafafa] transition-colors"
                >
                  {og.author}
                </a>
              ) : (
                <span className="text-sm text-[#a1a1aa]">{og.author}</span>
              )}
            </div>
          )}

          {/* Published Date */}
          {og.publishedTime && (
            <div className="flex items-center gap-1.5">
              <Calendar className="size-3.5 text-[#71717a]" />
              <span className="text-sm text-[#a1a1aa]">
                {formatDate(og.publishedTime)}
              </span>
            </div>
          )}

          {/* Type */}
          {og.type && (
            <span className="text-xs text-[#71717a] bg-[#27272a] px-2 py-0.5 rounded">
              {og.type}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export function BookmarkMetadataSection({
  rawMetadata,
  source,
  authorUrl,
  mediaUrls,
}: BookmarkMetadataSectionProps) {
  const metadata = rawMetadata as RawMetadata | null
  const og = metadata?.og as OGMetadata | undefined
  const twitterMeta = metadata?.twitter as TwitterMetadata | undefined
  const redditMeta = metadata?.reddit as RedditMetadata | undefined
  const youtubeMeta = metadata?.youtube as YouTubeMetadata | undefined
  const linkedinMeta = metadata?.linkedin as LinkedInMetadata | undefined
  const webMeta = metadata?.web as WebMetadata | undefined

  // Check if we have any metadata to display
  const hasOG = og && (og.title || og.description || og.image)
  const hasSourceMeta =
    (source === 'twitter' && twitterMeta) ||
    (source === 'reddit' && redditMeta) ||
    (source === 'youtube' && youtubeMeta) ||
    (source === 'linkedin' && linkedinMeta) ||
    (source === 'web' && webMeta)
  const hasMedia = mediaUrls && mediaUrls.length > 0

  if (!hasOG && !hasSourceMeta && !hasMedia) {
    return null
  }

  return (
    <>
      {/* Media Gallery Section */}
      {hasMedia && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Images className="size-5 text-[#fafafa]" />
            <h2 className="text-lg font-semibold text-[#fafafa]">
              Media
              <span className="ml-2 text-sm font-normal text-[#71717a]">
                ({mediaUrls.length} {mediaUrls.length === 1 ? 'item' : 'items'})
              </span>
            </h2>
          </div>
          <div className="rounded-lg border border-[#27272a] bg-[#18181b] p-4">
            <MediaGallery mediaUrls={mediaUrls} />
          </div>
        </section>
      )}

      {/* Page Preview Section (OG metadata and stats) */}
      {(hasOG || hasSourceMeta) && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <ImageIcon className="size-5 text-[#fafafa]" />
            <h2 className="text-lg font-semibold text-[#fafafa]">Page Preview</h2>
          </div>

          <div className="space-y-6">
            {/* OG Preview Card */}
            {hasOG && <OGPreviewCard og={og!} authorUrl={authorUrl} />}

            {/* Source-specific stats */}
            {hasSourceMeta && (
              <Card className="bg-[#18181b] border-[#27272a]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-[#a1a1aa]">
                    Engagement Stats
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {source === 'twitter' && twitterMeta && (
                    <TwitterStats metadata={twitterMeta} />
                  )}
                  {source === 'reddit' && redditMeta && (
                    <RedditStats metadata={redditMeta} />
                  )}
                  {source === 'youtube' && youtubeMeta && (
                    <YouTubeStats metadata={youtubeMeta} />
                  )}
                  {source === 'linkedin' && linkedinMeta && (
                    <LinkedInStats metadata={linkedinMeta} />
                  )}
                  {source === 'web' && webMeta && <WebStats metadata={webMeta} />}
                </CardContent>
              </Card>
            )}
          </div>
        </section>
      )}
    </>
  )
}
