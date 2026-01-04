/**
 * Instagram Video Downloader
 *
 * Downloads Instagram Reels and posts using multiple methods:
 * 1. Instagram GraphQL API (most reliable, no authentication needed)
 * 2. Instagram embed page extraction
 * 3. RapidAPI fallback (requires RAPIDAPI_KEY env var)
 */

import querystring from 'querystring'
import { parse } from 'node-html-parser'

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
function extractShortcode(url: string): string | null {
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
 * Extract video URL using Instagram's GraphQL API
 *
 * This is the most reliable method as it uses Instagram's internal API.
 */
async function extractVideoUrlFromGraphQL(shortcode: string): Promise<string | null> {
  console.log(`[instagram-video] Trying GraphQL API for shortcode: ${shortcode}`)

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
      console.log(`[instagram-video] GraphQL request failed: ${response.status}`)
      return null
    }

    const data = (await response.json()) as GraphQLResponse

    const mediaData = data.data?.xdt_shortcode_media
    if (!mediaData) {
      console.log(`[instagram-video] No media data in GraphQL response`)
      return null
    }

    if (!mediaData.is_video) {
      console.log(`[instagram-video] Content is not a video`)
      return null
    }

    if (mediaData.video_url) {
      console.log(`[instagram-video] Got video URL from GraphQL: ${mediaData.video_url.slice(0, 100)}...`)
      return mediaData.video_url
    }

    console.log(`[instagram-video] No video_url in GraphQL response`)
    return null
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.log(`[instagram-video] GraphQL error: ${message}`)
    return null
  }
}

/**
 * Extract video URL from Instagram post page HTML using OG meta tag
 */
async function extractVideoUrlFromPage(shortcode: string): Promise<string | null> {
  console.log(`[instagram-video] Trying direct page fetch for shortcode: ${shortcode}`)

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
      console.log(`[instagram-video] Page fetch failed: ${response.status}`)
      return null
    }

    const html = await response.text()
    const root = parse(html)

    // Look for og:video meta tag
    const videoMeta = root.querySelector('meta[property="og:video"]')
    if (videoMeta) {
      const content = videoMeta.getAttribute('content')
      if (content) {
        console.log(`[instagram-video] Found og:video URL: ${content.slice(0, 100)}...`)
        return content
      }
    }

    // Look for video_url in the page's JSON data
    const videoUrlMatch = html.match(/"video_url"\s*:\s*"([^"]+)"/)
    if (videoUrlMatch && videoUrlMatch[1]) {
      let videoUrl = videoUrlMatch[1]
      // Unescape the URL
      videoUrl = videoUrl.replace(/\\u0026/g, '&').replace(/\\\//g, '/')
      console.log(`[instagram-video] Found video_url in JSON: ${videoUrl.slice(0, 100)}...`)
      return videoUrl
    }

    console.log(`[instagram-video] No video URL found in page`)
    return null
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.log(`[instagram-video] Page fetch error: ${message}`)
    return null
  }
}

/**
 * Extract video URL from Instagram embed page
 */
async function extractVideoUrlFromEmbed(instagramUrl: string): Promise<string | null> {
  // Convert to embed URL
  const embedUrl = instagramUrl.replace(/\?.*$/, '') + '/embed/'
  console.log(`[instagram-video] Fetching embed page: ${embedUrl}`)

  try {
    const response = await fetch(embedUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    })

    if (!response.ok) {
      console.log(`[instagram-video] Embed fetch failed: ${response.status}`)
      return null
    }

    const html = await response.text()

    // Check if embed is broken
    if (html.includes('EmbedIsBroken')) {
      console.log(`[instagram-video] Embed page shows content is broken/removed`)
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
      console.log(`[instagram-video] Found video_url in embed: ${videoUrl.slice(0, 100)}...`)
      return videoUrl
    }

    // Method 2: Look for video element
    const root = parse(html)
    const videoElement = root.querySelector('video')
    if (videoElement) {
      const src = videoElement.getAttribute('src')
      if (src) {
        console.log(`[instagram-video] Found video src in HTML: ${src.slice(0, 100)}...`)
        return src
      }
    }

    console.log(`[instagram-video] No video URL found in embed page`)
    return null
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.log(`[instagram-video] Embed error: ${message}`)
    return null
  }
}

/**
 * Try RapidAPI Instagram downloader as fallback
 */
async function downloadViaRapidAPI(shortcode: string): Promise<InstagramVideoResult | null> {
  const rapidApiKey = process.env.RAPIDAPI_KEY
  if (!rapidApiKey) {
    console.log(`[instagram-video] RAPIDAPI_KEY not set, skipping RapidAPI fallback`)
    return null
  }

  console.log(`[instagram-video] Trying RapidAPI fallback...`)

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
      console.log(`[instagram-video] RapidAPI request failed: ${response.status}`)
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
      console.log(`[instagram-video] No video URL in RapidAPI response`)
      return null
    }

    console.log(`[instagram-video] Got video URL from RapidAPI: ${videoUrl.slice(0, 100)}...`)
    return await downloadVideoFromUrl(videoUrl)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.log(`[instagram-video] RapidAPI error: ${message}`)
    return null
  }
}

/**
 * Download video from a direct URL
 */
async function downloadVideoFromUrl(videoUrl: string): Promise<InstagramVideoResult> {
  console.log(`[instagram-video] Downloading video from URL...`)

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

  console.log(`[instagram-video] Downloaded ${buffer.length} bytes, type: ${contentType}`)

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
  console.log(`[instagram-video] Downloading video from: ${instagramUrl}`)

  // Extract shortcode from URL
  const shortcode = extractShortcode(instagramUrl)
  if (!shortcode) {
    throw new Error(`Could not extract shortcode from URL: ${instagramUrl}`)
  }
  console.log(`[instagram-video] Extracted shortcode: ${shortcode}`)

  // Method 1: Try GraphQL API (most reliable)
  const graphqlVideoUrl = await extractVideoUrlFromGraphQL(shortcode)
  if (graphqlVideoUrl) {
    try {
      return await downloadVideoFromUrl(graphqlVideoUrl)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.log(`[instagram-video] GraphQL download failed: ${message}`)
    }
  }

  // Method 2: Try direct page fetch
  const pageVideoUrl = await extractVideoUrlFromPage(shortcode)
  if (pageVideoUrl) {
    try {
      return await downloadVideoFromUrl(pageVideoUrl)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.log(`[instagram-video] Page download failed: ${message}`)
    }
  }

  // Method 3: Try embed page extraction
  const embedVideoUrl = await extractVideoUrlFromEmbed(instagramUrl)
  if (embedVideoUrl) {
    try {
      return await downloadVideoFromUrl(embedVideoUrl)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.log(`[instagram-video] Embed download failed: ${message}`)
    }
  }

  // Method 4: Try RapidAPI fallback
  const rapidApiResult = await downloadViaRapidAPI(shortcode)
  if (rapidApiResult) {
    return rapidApiResult
  }

  throw new Error('All Instagram video download methods failed')
}

/**
 * Check if an Instagram URL is a video (reel or video post)
 */
export function isInstagramVideoUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase()
    // Reels are always videos
    if (pathname.includes('/reel/')) return true
    if (pathname.includes('/reels/')) return true
    // Posts could be images or videos - we try to download anyway
    if (pathname.includes('/p/')) return true
    return false
  } catch {
    return false
  }
}
