/**
 * YouTube Extractor
 *
 * Extracts content from YouTube videos including:
 * - Video metadata (title, description, thumbnail)
 * - Transcript/captions when available
 *
 * Uses youtube-transcript package for caption extraction.
 * Falls back to description-only extraction if captions unavailable.
 */

import type { ExtractedContent, RawMetadata, YouTubeMetadata } from '@plukd/shared'
import { extractOGMetadata } from './og-metadata'

/**
 * Extract video ID from a YouTube URL
 */
export function extractYouTubeVideoId(url: string): string | null {
  try {
    const urlObj = new URL(url)

    // youtube.com/watch?v=VIDEO_ID
    if (urlObj.hostname.includes('youtube.com')) {
      return urlObj.searchParams.get('v')
    }

    // youtu.be/VIDEO_ID
    if (urlObj.hostname === 'youtu.be') {
      return urlObj.pathname.slice(1).split('/')[0] || null
    }

    // youtube.com/shorts/VIDEO_ID
    if (urlObj.pathname.includes('/shorts/')) {
      const parts = urlObj.pathname.split('/shorts/')
      return parts[1]?.split('/')[0] || null
    }

    // youtube.com/embed/VIDEO_ID
    if (urlObj.pathname.includes('/embed/')) {
      const parts = urlObj.pathname.split('/embed/')
      return parts[1]?.split('/')[0] || null
    }

    return null
  } catch {
    return null
  }
}

/**
 * Fetch YouTube transcript using youtube-transcript package
 *
 * This is a simplified implementation that fetches the transcript
 * from YouTube's timedtext API.
 */
async function fetchYouTubeTranscript(videoId: string): Promise<string | null> {
  try {
    // YouTube transcript API endpoint
    // This fetches the auto-generated or uploaded captions
    const response = await fetch(
      `https://www.youtube.com/watch?v=${videoId}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      }
    )

    if (!response.ok) {
      console.log(`[youtube] Failed to fetch video page: ${response.status}`)
      return null
    }

    const html = await response.text()

    // Extract the caption tracks from the video page
    // Look for "captionTracks" in the page data
    const captionMatch = html.match(/"captionTracks":\s*(\[.*?\])/)
    if (!captionMatch) {
      console.log('[youtube] No caption tracks found')
      return null
    }

    let captionTracks: Array<{ baseUrl: string; languageCode: string }>
    try {
      captionTracks = JSON.parse(captionMatch[1])
    } catch {
      console.log('[youtube] Failed to parse caption tracks')
      return null
    }

    if (captionTracks.length === 0) {
      console.log('[youtube] Empty caption tracks array')
      return null
    }

    // Prefer English, then auto-generated, then first available
    let selectedTrack = captionTracks.find((t) => t.languageCode === 'en')
    if (!selectedTrack) {
      selectedTrack = captionTracks.find((t) => t.languageCode.startsWith('en'))
    }
    if (!selectedTrack) {
      selectedTrack = captionTracks[0]
    }

    if (!selectedTrack?.baseUrl) {
      console.log('[youtube] No valid caption track URL')
      return null
    }

    // Fetch the actual transcript
    const transcriptResponse = await fetch(selectedTrack.baseUrl + '&fmt=json3')
    if (!transcriptResponse.ok) {
      console.log(`[youtube] Failed to fetch transcript: ${transcriptResponse.status}`)
      return null
    }

    const transcriptData = await transcriptResponse.json()

    // Extract text from the transcript events
    const events = transcriptData.events || []
    const textSegments: string[] = []

    for (const event of events) {
      if (event.segs) {
        const segmentText = event.segs
          .map((seg: { utf8?: string }) => seg.utf8 || '')
          .join('')
          .trim()
        if (segmentText) {
          textSegments.push(segmentText)
        }
      }
    }

    const transcript = textSegments.join(' ').replace(/\s+/g, ' ').trim()

    if (transcript.length < 50) {
      console.log('[youtube] Transcript too short, ignoring')
      return null
    }

    console.log(`[youtube] Extracted transcript: ${transcript.length} chars`)
    return transcript
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.log(`[youtube] Transcript extraction failed: ${message}`)
    return null
  }
}

/**
 * Extract content from a YouTube URL
 *
 * Attempts to get:
 * 1. Video metadata (title, description, thumbnail) from OG tags
 * 2. Transcript/captions from YouTube's caption system
 *
 * @param url - YouTube video URL
 * @returns Extracted content with transcript if available
 */
export async function extractYouTubeContent(url: string): Promise<ExtractedContent | null> {
  console.log(`[youtube] Extracting content from: ${url}`)

  const videoId = extractYouTubeVideoId(url)
  if (!videoId) {
    console.log('[youtube] Could not extract video ID')
    return null
  }

  console.log(`[youtube] Video ID: ${videoId}`)

  // Get OG metadata for title, description, thumbnail
  const ogMetadata = await extractOGMetadata(url)
  if (!ogMetadata) {
    console.log('[youtube] Could not get OG metadata')
    return null
  }

  const title = ogMetadata.ogTitle || ogMetadata.pageTitle || 'YouTube Video'
  const description = ogMetadata.ogDescription || ogMetadata.metaDescription || ''

  // Try to get transcript
  const transcript = await fetchYouTubeTranscript(videoId)

  // Build raw metadata
  const rawMetadata: RawMetadata = {
    og: {
      title: ogMetadata.ogTitle,
      description: ogMetadata.ogDescription,
      image: ogMetadata.ogImage,
      siteName: ogMetadata.ogSiteName,
      type: ogMetadata.ogType,
    },
    youtube: {
      // We don't have engagement metrics without API key
    } as YouTubeMetadata,
  }

  // Content is description + transcript (if available)
  let content = description
  if (transcript) {
    content = `${description}\n\n---\n\nTranscript:\n${transcript}`
  }

  return {
    url,
    source: 'youtube',
    title,
    content,
    transcript,
    mediaUrls: ogMetadata.ogImage ? [ogMetadata.ogImage] : undefined,
    ogTitle: ogMetadata.ogTitle,
    ogDescription: ogMetadata.ogDescription,
    ogImage: ogMetadata.ogImage,
    ogSiteName: ogMetadata.ogSiteName,
    ogType: ogMetadata.ogType,
    metaDescription: ogMetadata.metaDescription,
    rawMetadata,
  }
}
