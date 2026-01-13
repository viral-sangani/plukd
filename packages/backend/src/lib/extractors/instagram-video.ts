/**
 * Instagram Video Downloader and Content Type Detection
 *
 * Downloads Instagram Reels and video posts using multiple methods:
 * 1. Instagram GraphQL API (most reliable, no authentication needed)
 * 2. Instagram embed page extraction
 * 3. RapidAPI fallback (requires RAPIDAPI_KEY env var)
 *
 * Also provides content type detection:
 * - isInstagramVideoUrl: Returns true only for /reel/ and /reels/ URLs (guaranteed videos)
 * - maybeInstagramVideo: Returns true for /p/ and /tv/ URLs (might be videos)
 * - getInstagramMediaInfo: Fetches GraphQL to determine actual content type
 * - shouldTranscribeInstagram: Determines if transcription should be attempted
 */

import querystring from 'querystring'
import { parse } from 'node-html-parser'

/**
 * Check if DEBUG mode is enabled
 */
const isDebug = () => process.env.DEBUG === 'true'

/**
 * Log debug message only when DEBUG=true
 */
function debugLog(message: string): void {
  if (isDebug()) {
    console.log(message)
  }
}

/**
 * Carousel item from Instagram
 */
export interface CarouselItem {
  isVideo: boolean
  url: string
  thumbnailUrl?: string
}

/**
 * Instagram media info from GraphQL API
 */
export interface InstagramMediaInfo {
  isVideo: boolean
  isCarousel: boolean
  videoUrl?: string
  thumbnailUrl?: string
  carouselItems?: CarouselItem[]
}

/**
 * GraphQL response from Instagram
 */
interface GraphQLResponse {
  data?: {
    xdt_shortcode_media?: {
      is_video: boolean
      video_url?: string
      display_url?: string
      dimensions?: {
        width: number
        height: number
      }
      edge_sidecar_to_children?: {
        edges: Array<{
          node: {
            is_video: boolean
            display_url?: string
            video_url?: string
          }
        }>
      }
    }
  }
  status?: string
}

/**
 * RapidAPI response structure for Instagram media
 */
interface RapidAPIResponse {
  media?: {
    video_versions?: Array<{ url: string }>
  }
  video_url?: string
}

/**
 * Result from downloading an Instagram video
 */
export interface InstagramVideoResult {
  /** Video buffer */
  buffer: Buffer
  /** MIME type of the video */
  mimeType: string
  /** Video URL (for caching/debugging) */
  url: string
  /** Thumbnail URL if available */
  thumbnail?: string
}

/**
 * User agent that mimics a real browser
 */
const USER_AGENT =
  'Mozilla/5.0 (Linux; Android 11; SAMSUNG SM-G973U) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/14.2 Chrome/87.0.4280.141 Mobile Safari/537.36'

/**
 * Extract shortcode from Instagram URL
 */
export function extractShortcode(url: string): string | null {
  const patterns = [
    /instagram\.com\/reel\/([A-Za-z0-9_-]+)/,
    /instagram\.com\/reels\/([A-Za-z0-9_-]+)/,
    /instagram\.com\/p\/([A-Za-z0-9_-]+)/,
    /instagram\.com\/tv\/([A-Za-z0-9_-]+)/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }
  return null
}

/**
 * Check if an Instagram URL is definitely a video (reel)
 *
 * Only returns true for /reel/ and /reels/ URLs which are guaranteed to be videos.
 * For /p/ URLs, use maybeInstagramVideo() and getInstagramMediaInfo() to determine.
 */
export function isInstagramVideoUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    // Must be an Instagram domain
    if (!urlObj.hostname.includes('instagram.com')) {
      return false
    }
    const pathname = urlObj.pathname.toLowerCase()
    // Only reels are guaranteed videos
    if (pathname.includes('/reel/')) return true
    if (pathname.includes('/reels/')) return true
    // /p/ URLs can be images, videos, or carousels - need to check GraphQL
    return false
  } catch {
    return false
  }
}

/**
 * Check if an Instagram URL is definitely a reel
 * Alias for isInstagramVideoUrl for semantic clarity
 */
export function isInstagramReelUrl(url: string): boolean {
  return isInstagramVideoUrl(url)
}

/**
 * Check if an Instagram URL might be a video (needs GraphQL check)
 *
 * Returns true for /p/ and /tv/ URLs which might be videos.
 * These URLs need to be checked via GraphQL API to determine actual content type.
 */
export function maybeInstagramVideo(url: string): boolean {
  try {
    const urlObj = new URL(url)
    if (!urlObj.hostname.includes('instagram.com')) {
      return false
    }
    const pathname = urlObj.pathname.toLowerCase()
    // /p/ URLs might be images, videos, or carousels
    if (pathname.includes('/p/')) return true
    // /tv/ URLs are IGTV videos
    if (pathname.includes('/tv/')) return true
    return false
  } catch {
    return false
  }
}

/**
 * Encode GraphQL request data for Instagram API
 */
function encodeGraphqlRequestData(shortcode: string): string {
  const requestData = {
    av: '0',
    __d: 'www',
    __user: '0',
    __a: '1',
    __req: '3',
    __hs: '19624.HYP:instagram_web_pkg.2.1..0.0',
    dpr: '3',
    __ccg: 'UNKNOWN',
    __rev: '1008824440',
    __s: 'xf44ne:zhh75g:xr51e7',
    __hsi: '7282217488877343271',
    __dyn:
      '7xeUmwlEnwn8K2WnFw9-2i5U4e0yoW3q32360CEbo1nEhw2nVE4W0om78b87C0yE5ufz81s8hwGwQwoEcE7O2l0Fwqo31w9a9x-0z8-U2zxe2GewGwso88cobEaU2eUlwhEe87q7-0iK2S3qazo7u1xwIw8O321LwTwKG1pg661pwr86C1mwraCg',
    __csr:
      'gZ3yFmJkillQvV6ybimnG8AmhqujGbLADgjyEOWz49z9XDlAXBJpC7Wy-vQTSvUGWGh5u8KibG44dBiigrgjDxGjU0150Q0848azk48N09C02IR0go4SaR70r8owyg9pU0V23hwiA0LQczA48S0f-x-27o05NG0fkw',
    __comet_req: '7',
    lsd: 'AVqbxe3J_YA',
    jazoest: '2957',
    __spin_r: '1008824440',
    __spin_b: 'trunk',
    __spin_t: '1695523385',
    fb_api_caller_class: 'RelayModern',
    fb_api_req_friendly_name: 'PolarisPostActionLoadPostQueryQuery',
    variables: JSON.stringify({
      shortcode: shortcode,
      fetch_comment_count: 'null',
      fetch_related_profile_media_count: 'null',
      parent_comment_count: 'null',
      child_comment_count: 'null',
      fetch_like_count: 'null',
      fetch_tagged_user_count: 'null',
      fetch_preview_comment_count: 'null',
      has_threaded_comments: 'false',
      hoisted_comment_id: 'null',
      hoisted_reply_id: 'null',
    }),
    server_timestamps: 'true',
    doc_id: '10015901848480474',
  }
  return querystring.stringify(requestData)
}

/**
 * Fetch Instagram media info from GraphQL API
 *
 * Returns information about whether the content is a video, image, or carousel.
 * Also extracts carousel items if present.
 */
export async function getInstagramMediaInfo(url: string): Promise<InstagramMediaInfo | null> {
  const shortcode = extractShortcode(url)
  if (!shortcode) {
    return null
  }

  debugLog(`[instagram-video] Fetching media info for shortcode: ${shortcode}`)

  try {
    const encodedData = encodeGraphqlRequestData(shortcode)

    const response = await fetch('https://www.instagram.com/api/graphql', {
      method: 'POST',
      headers: {
        Accept: '*/*',
        'Accept-Language': 'en-US,en;q=0.5',
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-FB-Friendly-Name': 'PolarisPostActionLoadPostQueryQuery',
        'X-CSRFToken': 'RVDUooU5MYsBbS1CNN3CzVAuEP8oHB52',
        'X-IG-App-ID': '1217981644879628',
        'X-FB-LSD': 'AVqbxe3J_YA',
        'X-ASBD-ID': '129477',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'User-Agent': USER_AGENT,
      },
      body: encodedData,
    })

    if (!response.ok) {
      debugLog(`[instagram-video] GraphQL request failed: ${response.status}`)
      return null
    }

    const data = (await response.json()) as GraphQLResponse

    const mediaData = data.data?.xdt_shortcode_media
    if (!mediaData) {
      debugLog(`[instagram-video] No media data in GraphQL response`)
      return null
    }

    // Check for carousel (sidecar)
    const sidecar = mediaData.edge_sidecar_to_children
    if (sidecar && sidecar.edges.length > 0) {
      debugLog(`[instagram-video] Detected carousel with ${sidecar.edges.length} items`)
      const carouselItems: CarouselItem[] = sidecar.edges.map((edge) => {
        const node = edge.node
        return {
          isVideo: node.is_video,
          url: node.is_video ? node.video_url! : node.display_url!,
          thumbnailUrl: node.is_video ? node.display_url : undefined,
        }
      })

      return {
        isVideo: false, // Carousel as a whole is not a single video
        isCarousel: true,
        thumbnailUrl: mediaData.display_url,
        carouselItems,
      }
    }

    // Single image or video
    debugLog(`[instagram-video] Detected ${mediaData.is_video ? 'video' : 'image'} post`)
    return {
      isVideo: mediaData.is_video,
      isCarousel: false,
      videoUrl: mediaData.is_video ? mediaData.video_url : undefined,
      thumbnailUrl: mediaData.display_url,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    debugLog(`[instagram-video] GraphQL error: ${message}`)
    return null
  }
}

/**
 * Determine if an Instagram URL should be transcribed
 *
 * @param url - The Instagram URL
 * @param mediaInfo - Optional pre-fetched media info (will fetch if not provided for /p/ URLs)
 * @returns True if the content is a video that should be transcribed
 */
export async function shouldTranscribeInstagram(
  url: string,
  mediaInfo?: InstagramMediaInfo
): Promise<boolean> {
  // Reels are always videos
  if (isInstagramReelUrl(url)) {
    return true
  }

  // Check if this might be a video post
  if (maybeInstagramVideo(url)) {
    // Use provided media info or fetch it
    const info = mediaInfo ?? (await getInstagramMediaInfo(url))
    if (!info) {
      // Could not determine content type, skip transcription
      return false
    }

    // Don't transcribe carousels (even if they contain videos)
    if (info.isCarousel) {
      return false
    }

    // Only transcribe if it's a video
    return info.isVideo
  }

  return false
}

/**
 * Extract video URL using Instagram's GraphQL API
 *
 * This is the most reliable method as it uses Instagram's internal API.
 */
async function extractVideoUrlFromGraphQL(shortcode: string): Promise<string | null> {
  debugLog(`[instagram-video] Trying GraphQL API for shortcode: ${shortcode}`)

  try {
    const encodedData = encodeGraphqlRequestData(shortcode)

    const response = await fetch('https://www.instagram.com/api/graphql', {
      method: 'POST',
      headers: {
        Accept: '*/*',
        'Accept-Language': 'en-US,en;q=0.5',
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-FB-Friendly-Name': 'PolarisPostActionLoadPostQueryQuery',
        'X-CSRFToken': 'RVDUooU5MYsBbS1CNN3CzVAuEP8oHB52',
        'X-IG-App-ID': '1217981644879628',
        'X-FB-LSD': 'AVqbxe3J_YA',
        'X-ASBD-ID': '129477',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'User-Agent': USER_AGENT,
      },
      body: encodedData,
    })

    if (!response.ok) {
      debugLog(`[instagram-video] GraphQL request failed: ${response.status}`)
      return null
    }

    const data = (await response.json()) as GraphQLResponse

    const mediaData = data.data?.xdt_shortcode_media
    if (!mediaData) {
      debugLog(`[instagram-video] No media data in GraphQL response`)
      return null
    }

    if (!mediaData.is_video) {
      debugLog(`[instagram-video] Content is not a video`)
      return null
    }

    if (mediaData.video_url) {
      debugLog(`[instagram-video] Got video URL from GraphQL`)
      return mediaData.video_url
    }

    debugLog(`[instagram-video] No video_url in GraphQL response`)
    return null
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    debugLog(`[instagram-video] GraphQL error: ${message}`)
    return null
  }
}

/**
 * Extract video URL from Instagram post page HTML using OG meta tag
 */
async function extractVideoUrlFromPage(shortcode: string): Promise<string | null> {
  debugLog(`[instagram-video] Trying direct page fetch for shortcode: ${shortcode}`)

  try {
    const response = await fetch(`https://www.instagram.com/p/${shortcode}/`, {
      headers: {
        accept: '*/*',
        host: 'www.instagram.com',
        referer: 'https://www.instagram.com/',
        DNT: '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/117.0',
      },
    })

    if (!response.ok) {
      debugLog(`[instagram-video] Page fetch failed: ${response.status}`)
      return null
    }

    const html = await response.text()
    const root = parse(html)

    // Look for og:video meta tag
    const videoMeta = root.querySelector('meta[property="og:video"]')
    if (videoMeta) {
      const content = videoMeta.getAttribute('content')
      if (content) {
        debugLog(`[instagram-video] Found og:video URL`)
        return content
      }
    }

    // Look for video_url in the page's JSON data
    const videoUrlMatch = html.match(/"video_url"\s*:\s*"([^"]+)"/)
    if (videoUrlMatch && videoUrlMatch[1]) {
      let videoUrl = videoUrlMatch[1]
      // Unescape the URL
      videoUrl = videoUrl.replace(/\\u0026/g, '&').replace(/\\\//g, '/')
      debugLog(`[instagram-video] Found video_url in JSON`)
      return videoUrl
    }

    debugLog(`[instagram-video] No video URL found in page`)
    return null
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    debugLog(`[instagram-video] Page fetch error: ${message}`)
    return null
  }
}

/**
 * Extract video URL from Instagram embed page
 */
async function extractVideoUrlFromEmbed(instagramUrl: string): Promise<string | null> {
  // Convert to embed URL
  const embedUrl = instagramUrl.replace(/\?.*$/, '') + '/embed/'
  debugLog(`[instagram-video] Fetching embed page`)

  try {
    const response = await fetch(embedUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    })

    if (!response.ok) {
      debugLog(`[instagram-video] Embed fetch failed: ${response.status}`)
      return null
    }

    const html = await response.text()

    // Check if embed is broken
    if (html.includes('EmbedIsBroken')) {
      debugLog(`[instagram-video] Embed page shows content is broken/removed`)
      return null
    }

    // Method 1: Look for video_url in the embedded JSON
    const videoUrlMatch = html.match(/video_url\\?":\s*\\?"(https:[^"\\]+(?:\\.[^"\\]+)*)/)
    if (videoUrlMatch && videoUrlMatch[1]) {
      let videoUrl = videoUrlMatch[1]
      // Unescape the URL
      videoUrl = videoUrl
        .replace(/\\\\\//g, '/')
        .replace(/\\\//g, '/')
        .replace(/\\u0026/g, '&')
        .replace(/\\u00253D/g, '=')
        .replace(/\\u0025/g, '%')
      debugLog(`[instagram-video] Found video_url in embed`)
      return videoUrl
    }

    // Method 2: Look for video element
    const root = parse(html)
    const videoElement = root.querySelector('video')
    if (videoElement) {
      const src = videoElement.getAttribute('src')
      if (src) {
        debugLog(`[instagram-video] Found video src in HTML`)
        return src
      }
    }

    debugLog(`[instagram-video] No video URL found in embed page`)
    return null
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    debugLog(`[instagram-video] Embed error: ${message}`)
    return null
  }
}

/**
 * Try RapidAPI Instagram downloader as fallback
 */
async function downloadViaRapidAPI(shortcode: string): Promise<InstagramVideoResult | null> {
  const rapidApiKey = process.env.RAPIDAPI_KEY
  if (!rapidApiKey) {
    debugLog(`[instagram-video] RAPIDAPI_KEY not set, skipping RapidAPI fallback`)
    return null
  }

  debugLog(`[instagram-video] Trying RapidAPI fallback`)

  try {
    const response = await fetch(
      `https://social-media-video-downloader.p.rapidapi.com/instagram/v3/media/post/details?shortcode=${shortcode}`,
      {
        headers: {
          'X-RapidAPI-Key': rapidApiKey,
          'X-RapidAPI-Host': 'social-media-video-downloader.p.rapidapi.com',
        },
      }
    )

    if (!response.ok) {
      debugLog(`[instagram-video] RapidAPI request failed: ${response.status}`)
      return null
    }

    const data = (await response.json()) as RapidAPIResponse

    let videoUrl: string | null = null
    if (data.media?.video_versions?.[0]?.url) {
      videoUrl = data.media.video_versions[0].url
    } else if (data.video_url) {
      videoUrl = data.video_url
    }

    if (!videoUrl) {
      debugLog(`[instagram-video] No video URL in RapidAPI response`)
      return null
    }

    debugLog(`[instagram-video] Got video URL from RapidAPI`)
    return await downloadVideoFromUrl(videoUrl)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    debugLog(`[instagram-video] RapidAPI error: ${message}`)
    return null
  }
}

/**
 * Download video from a direct URL
 */
async function downloadVideoFromUrl(videoUrl: string): Promise<InstagramVideoResult> {
  debugLog(`[instagram-video] Downloading video from URL`)

  const videoResponse = await fetch(videoUrl, {
    headers: {
      'User-Agent': USER_AGENT,
      Referer: 'https://www.instagram.com/',
    },
  })

  if (!videoResponse.ok) {
    throw new Error(`Video download failed: ${videoResponse.status} ${videoResponse.statusText}`)
  }

  const contentType = videoResponse.headers.get('content-type') || 'video/mp4'
  const buffer = Buffer.from(await videoResponse.arrayBuffer())

  debugLog(`[instagram-video] Downloaded ${buffer.length} bytes`)

  // Validate it's actually a video
  if (buffer.length < 1000) {
    throw new Error('Downloaded file too small - may not be a valid video')
  }

  return {
    buffer,
    mimeType: contentType,
    url: videoUrl,
  }
}

/**
 * Download an Instagram Reel or post video
 *
 * Uses multiple methods in order of reliability:
 * 1. Instagram GraphQL API (most reliable)
 * 2. Direct page fetch with OG meta
 * 3. Instagram embed page extraction
 * 4. RapidAPI fallback (requires RAPIDAPI_KEY env var)
 *
 * @param instagramUrl - Instagram URL (reel or post)
 * @returns Video buffer and metadata
 * @throws Error if all methods fail
 */
export async function downloadInstagramVideo(
  instagramUrl: string
): Promise<InstagramVideoResult> {
  debugLog(`[instagram-video] Downloading video from: ${instagramUrl}`)

  // Extract shortcode from URL
  const shortcode = extractShortcode(instagramUrl)
  if (!shortcode) {
    throw new Error(`Could not extract shortcode from URL: ${instagramUrl}`)
  }
  debugLog(`[instagram-video] Extracted shortcode: ${shortcode}`)

  // Method 1: Try GraphQL API (most reliable)
  const graphqlVideoUrl = await extractVideoUrlFromGraphQL(shortcode)
  if (graphqlVideoUrl) {
    try {
      return await downloadVideoFromUrl(graphqlVideoUrl)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      debugLog(`[instagram-video] GraphQL download failed: ${message}`)
    }
  }

  // Method 2: Try direct page fetch
  const pageVideoUrl = await extractVideoUrlFromPage(shortcode)
  if (pageVideoUrl) {
    try {
      return await downloadVideoFromUrl(pageVideoUrl)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      debugLog(`[instagram-video] Page download failed: ${message}`)
    }
  }

  // Method 3: Try embed page extraction
  const embedVideoUrl = await extractVideoUrlFromEmbed(instagramUrl)
  if (embedVideoUrl) {
    try {
      return await downloadVideoFromUrl(embedVideoUrl)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      debugLog(`[instagram-video] Embed download failed: ${message}`)
    }
  }

  // Method 4: Try RapidAPI fallback
  const rapidApiResult = await downloadViaRapidAPI(shortcode)
  if (rapidApiResult) {
    return rapidApiResult
  }

  throw new Error('All Instagram video download methods failed')
}
