import { google } from '@ai-sdk/google'
import { generateText } from 'ai'
import { generateFallbackTitle, isTitleBad, sleep } from '@plukd/shared'
import type { ExtractedContent, RawMetadata, InstagramMetadata, InstagramCarouselItem } from '@plukd/shared'
import { extractOGMetadata } from './og-metadata'
import { extractWithParallel } from './parallel-client'
import { getInstagramMediaInfo, type InstagramMediaInfo } from './instagram-video'

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
 * Constants for AI retry logic
 */
const AI_RETRY_ATTEMPTS = 3
const AI_RETRY_DELAY_MS = 1000
const AI_RETRY_MULTIPLIER = 2

/**
 * Detect the type of Instagram content from URL
 */
function detectInstagramContentType(url: string): 'reel' | 'post' | 'story' | 'unknown' {
  const pathname = new URL(url).pathname.toLowerCase()
  if (pathname.includes('/reel/')) return 'reel'
  if (pathname.includes('/p/')) return 'post'
  if (pathname.includes('/stories/')) return 'story'
  return 'unknown'
}

/**
 * Extract username from Instagram URL
 */
function extractInstagramUsername(url: string): string | null {
  try {
    const pathname = new URL(url).pathname
    const pathParts = pathname.split('/').filter(Boolean)

    // Skip content type paths
    if (pathParts.length >= 1) {
      const firstPart = pathParts[0]
      if (firstPart && !['p', 'reel', 'stories', 'tv', 'explore'].includes(firstPart)) {
        return firstPart
      }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Extract hashtags from caption text.
 *
 * @param text - The caption text
 * @returns Array of hashtags (without the # symbol)
 */
export function extractHashtags(text: string): string[] {
  const hashtagPattern = /#(\w+)/g
  const matches = text.matchAll(hashtagPattern)
  return Array.from(matches).map(m => m[1])
}

/**
 * Extract mentions from caption text.
 *
 * @param text - The caption text
 * @returns Array of usernames (without the @ symbol)
 */
export function extractMentions(text: string): string[] {
  const mentionPattern = /@(\w+)/g
  const matches = text.matchAll(mentionPattern)
  return Array.from(matches).map(m => m[1])
}

/**
 * Minimum content length threshold for Parallel AI extraction.
 * Reduced from 50 to 20 chars since short captions are still valuable.
 */
const MIN_CONTENT_LENGTH = 20

/**
 * Check if an error is retryable (timeout or rate limit)
 */
function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false

  const message = error.message.toLowerCase()
  const name = error.name.toLowerCase()

  // Check for timeout errors
  if (message.includes('timeout') || message.includes('timed out')) return true
  if (name.includes('timeout')) return true

  // Check for rate limit errors
  if (message.includes('rate limit') || message.includes('rate_limit')) return true
  if (message.includes('429') || message.includes('too many requests')) return true
  if (message.includes('quota')) return true

  // Check for transient network errors
  if (message.includes('econnreset') || message.includes('econnrefused')) return true
  if (message.includes('network') && message.includes('error')) return true

  return false
}

/**
 * Minimum character length for a caption to be considered complete (not just a fragment).
 * Short captions like "Save these!" are likely incomplete fragments.
 */
const MIN_COMPLETE_CAPTION_LENGTH = 30

/**
 * Extract the actual caption/post content from Instagram page content.
 * The full_content from Parallel AI contains login prompts and other junk.
 * This function uses multiple parsing strategies to extract meaningful caption text.
 *
 * DEBUGGING: Set DEBUG=true to see detailed extraction logs.
 *
 * @param content - The raw content from Parallel AI
 * @param username - The Instagram username (if available)
 * @param isCarousel - Whether this is a carousel post (enables relaxed scoring)
 */
export function extractCaptionFromContent(
  content: string,
  username: string | null,
  isCarousel: boolean = false
): string | null {
  if (!content || content.trim().length === 0) {
    debugLog('[caption-extraction] Content is empty or null')
    return null
  }

  debugLog(`[caption-extraction] Starting extraction from ${content.length} chars of content`)
  debugLog(`[caption-extraction] Username: ${username ?? 'null'}`)
  debugLog(`[caption-extraction] isCarousel: ${isCarousel}`)
  debugLog(`[caption-extraction] Full content preview:\n---\n${content.slice(0, 1000)}${content.length > 1000 ? '\n...(truncated)' : ''}\n---`)

  // Collect all candidate captions with their source strategy
  const candidates: Array<{ text: string; strategy: string; score: number }> = []

  // Strategy 1: Extract caption after username mention pattern (multi-line support)
  // Pattern: [username](/username/) followed by caption text (can span multiple lines)
  if (username) {
    // Look for pattern: [username](/username/)\n\nCaption text (capture multiple lines)
    const usernamePatternMultiLine = new RegExp(
      `\\[${username}\\]\\(/[^)]+/\\)\\s*\\n\\n([\\s\\S]*?)(?=\\n\\n\\[|\\n\\n\\d+\\s*(?:likes?|views?)|$)`,
      'i'
    )
    const multiLineMatch = content.match(usernamePatternMultiLine)
    if (multiLineMatch && multiLineMatch[1]) {
      const caption = multiLineMatch[1].trim()
      debugLog(`[caption-extraction] Strategy 1 (username multi-line) found: "${caption.slice(0, 100)}..."`)
      if (isValidCaption(caption)) {
        candidates.push({ text: caption, strategy: 'username-multiline', score: scoreCaptionQuality(caption, isCarousel) })
      }
    }

    // Also try single-line fallback
    const usernamePattern = new RegExp(`\\[${username}\\]\\(/[^)]+/\\)\\s*\\n\\n([^\\n\\[]+)`, 'i')
    const match = content.match(usernamePattern)
    if (match && match[1]) {
      const caption = match[1].trim()
      debugLog(`[caption-extraction] Strategy 1 (username single-line) found: "${caption.slice(0, 100)}..."`)
      if (isValidCaption(caption)) {
        candidates.push({ text: caption, strategy: 'username-singleline', score: scoreCaptionQuality(caption, isCarousel) })
      }
    }
  }

  // Strategy 2: Look for quoted content (often contains the actual caption)
  const quotedMatch = content.match(/"([^"]{15,500})"/);
  if (quotedMatch && quotedMatch[1] && isValidCaption(quotedMatch[1])) {
    const caption = quotedMatch[1].trim()
    debugLog(`[caption-extraction] Strategy 2 (quoted) found: "${caption.slice(0, 100)}..."`)
    candidates.push({ text: caption, strategy: 'quoted', score: scoreCaptionQuality(caption, isCarousel) })
  }

  // Strategy 3: Look for content after common Instagram patterns
  // e.g., "likes" count followed by caption (capture multi-line)
  const afterLikesMatchMulti = content.match(/\d+\s*(?:likes?|views?)\s*\n+([\s\S]*?)(?=\n\n\[|\n\n\d+\s*(?:likes?|views?)|$)/i)
  if (afterLikesMatchMulti && afterLikesMatchMulti[1]) {
    const caption = afterLikesMatchMulti[1].trim()
    if (caption.length >= 15 && caption.length <= 2000 && isValidCaption(caption)) {
      debugLog(`[caption-extraction] Strategy 3 (after-likes multi-line) found: "${caption.slice(0, 100)}..."`)
      candidates.push({ text: caption, strategy: 'after-likes-multiline', score: scoreCaptionQuality(caption, isCarousel) })
    }
  }

  // Strategy 4: Find hashtag-heavy content (often the caption)
  const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 10)
  for (const line of lines) {
    // Check if line has multiple hashtags - likely the caption
    const hashtagCount = (line.match(/#\w+/g) || []).length
    if (hashtagCount >= 2 && isValidCaption(line)) {
      debugLog(`[caption-extraction] Strategy 4 (hashtag-heavy) found: "${line.slice(0, 100)}..."`)
      candidates.push({ text: line, strategy: 'hashtag-heavy', score: scoreCaptionQuality(line, isCarousel) })
      break // Only take the first hashtag-heavy line
    }
  }

  // Strategy 5: Try to find any line that looks like a caption (not UI elements)
  for (const line of lines) {
    if (isValidCaption(line) && line.length >= 20 && line.length < 500) {
      debugLog(`[caption-extraction] Strategy 5 (valid-line) found: "${line.slice(0, 100)}..."`)
      candidates.push({ text: line, strategy: 'valid-line', score: scoreCaptionQuality(line, isCarousel) })
      break // Only take the first valid line
    }
  }

  // Strategy 6: Look for emoji-heavy content (common in Instagram captions)
  for (const line of lines) {
    // Check for emoji presence using a simple regex for common emoji ranges
    const hasEmojis = /[\u{1F300}-\u{1F9FF}]/u.test(line)
    if (hasEmojis && isValidCaption(line) && line.length >= 15 && line.length < 500) {
      debugLog(`[caption-extraction] Strategy 6 (emoji-heavy) found: "${line.slice(0, 100)}..."`)
      candidates.push({ text: line, strategy: 'emoji-heavy', score: scoreCaptionQuality(line, isCarousel) })
      break // Only take the first emoji-heavy line
    }
  }

  // Strategy 7: Look for multi-line content blocks (simplified to avoid regex backtracking)
  // Find paragraphs that don't contain common UI patterns
  const paragraphs = content.split(/\n\n+/).filter(p => {
    const trimmed = p.trim()
    return trimmed.length >= 20 &&
           trimmed.length <= 2000 &&
           !trimmed.startsWith('[') &&
           !trimmed.includes('Log in') &&
           !trimmed.includes('Sign up') &&
           isValidCaption(trimmed)
  })

  for (const para of paragraphs) {
    const caption = para.trim()
    if (caption.length >= 20) {
      debugLog(`[caption-extraction] Strategy 7 (paragraph) found: "${caption.slice(0, 100)}..."`)
      candidates.push({ text: caption, strategy: 'paragraph', score: scoreCaptionQuality(caption, isCarousel) })
      break // Only take the first valid paragraph
    }
  }

  // Strategy 8: Look for content between username link and UI elements
  // More aggressive but simplified - captures text after ](/.../) pattern
  const afterUsernameLink = content.split(/\]\([^)]+\/\)\s*\n+/)
  if (afterUsernameLink.length > 1 && afterUsernameLink[1]) {
    // Get first section after username link
    let section = afterUsernameLink[1].split(/\n\s*(?:Log in|Sign up|Keep up|Follow|Download)/i)[0]
    if (section) {
      section = section.trim()
      // Remove trailing hashtag section if present
      const hashtagSection = section.indexOf('\n#')
      if (hashtagSection > 0) {
        section = section.slice(0, hashtagSection).trim()
      }
      if (section.length >= 20 && section.length <= 2000 && isValidCaption(section)) {
        debugLog(`[caption-extraction] Strategy 8 (after-username) found: "${section.slice(0, 100)}..."`)
        candidates.push({ text: section, strategy: 'after-username', score: scoreCaptionQuality(section, isCarousel) })
      }
    }
  }

  // Strategy 9: Multi-line caption with list indicators (carousel-aware)
  // Pattern: matches text after markdown links that contains list-like content
  // This is especially useful for carousel posts with numbered lists or bullet points
  const multiLineCaptionMatch = content.match(/\]\([^)]+\/\)\s*\n+([\s\S]{15,500}?)(?=\n\n|\n\s*#|\n\s*\[|$)/)
  if (multiLineCaptionMatch && multiLineCaptionMatch[1]) {
    const captionText = multiLineCaptionMatch[1].trim()
    // Check if it looks like list content (numbers, bullets, or structured format)
    const hasListIndicators = /(?:^\d+[.):]\s|\n\d+[.):]\s|^[-•]\s|\n[-•]\s)/m.test(captionText)
    if (isValidCaption(captionText) && (hasListIndicators || isCarousel)) {
      debugLog(`[caption-extraction] Strategy 9 (multiline-list) found: "${captionText.slice(0, 100)}..."`)
      // Give bonus score for list content in carousels
      const listBonus = hasListIndicators && isCarousel ? 10 : 0
      candidates.push({
        text: captionText,
        strategy: 'multiline-list',
        score: scoreCaptionQuality(captionText, isCarousel) + listBonus,
      })
    }
  }

  // If no candidates found, return null
  if (candidates.length === 0) {
    debugLog('[caption-extraction] No valid caption candidates found')
    return null
  }

  // Sort candidates by score (highest first) and select the best one
  candidates.sort((a, b) => b.score - a.score)

  debugLog(`[caption-extraction] Found ${candidates.length} candidates:`)
  for (const c of candidates) {
    debugLog(`  - ${c.strategy} (score: ${c.score}): "${c.text.slice(0, 60)}..."`)
  }

  const best = candidates[0]
  debugLog(`[caption-extraction] Selected: ${best.strategy} with score ${best.score}`)

  return best.text
}

/**
 * Minimum character length for carousel captions before penalty.
 * Carousels often have short but valid captions like "Save these!"
 */
const MIN_CAROUSEL_CAPTION_LENGTH = 15

/**
 * Score the quality of a caption candidate.
 * Higher scores indicate better captions (longer, more content, fewer red flags).
 *
 * @param text - The caption text to score
 * @param isCarousel - Whether this is a carousel post (enables relaxed scoring)
 */
function scoreCaptionQuality(text: string, isCarousel: boolean = false): number {
  let score = 0
  const lowerText = text.toLowerCase()

  // Base score from length (longer is better, up to a point)
  score += Math.min(text.length, 300) / 10 // Max 30 points for length

  // Bonus for complete sentences (has punctuation)
  if (/[.!?]/.test(text)) {
    score += 10
  }

  // Bonus for having numbers (often indicates specific info like "31 AI tools")
  if (/\d+/.test(text)) {
    score += 5
  }

  // Bonus for having multiple words
  const wordCount = text.split(/\s+/).length
  score += Math.min(wordCount, 20) // Max 20 points for word count

  // Penalty for being too short (likely incomplete)
  // Use relaxed threshold for carousel posts
  const minLength = isCarousel ? MIN_CAROUSEL_CAPTION_LENGTH : MIN_COMPLETE_CAPTION_LENGTH
  if (text.length < minLength) {
    // Reduced penalty for carousels (10 instead of 20)
    score -= isCarousel ? 10 : 20
  }

  // Penalty for starting with common fragment patterns
  // Reduced penalty for carousels since these are often valid for list posts
  const fragmentPatterns = [
    /^save\s+/i,
    /^check\s+out/i,
    /^look\s+at/i,
    /^see\s+/i,
    /^watch\s+/i,
    /^click\s+/i,
    /^tap\s+/i,
    /^link\s+in/i,
  ]
  for (const pattern of fragmentPatterns) {
    if (pattern.test(text)) {
      // Reduced penalty for carousels
      score -= isCarousel ? 2 : 5
    }
  }

  // Heavy penalty for Instagram boilerplate phrases
  // These often appear before the actual caption and should be strongly deprioritized
  const boilerplatePatterns = [
    /^join\s+.+\s+on\s+instagram/i,   // "Join username on Instagram" (with spaces in name)
    /on\s+instagram$/i,               // Ends with "on Instagram"
    /^follow\s+.+\s+to\s+see/i,       // "Follow X to see..."
    /^create\s+an?\s+account/i,       // "Create an account..."
  ]
  for (const pattern of boilerplatePatterns) {
    if (pattern.test(text.trim())) {
      score -= 50 // Heavy penalty to ensure boilerplate is never selected
    }
  }

  // Bonus for topic-specific keywords (AI, tools, movies, books, etc.)
  const topicKeywords = ['AI', 'tool', 'movie', 'book', 'app', 'tested', 'found', 'recommend', 'list', 'tips']
  for (const keyword of topicKeywords) {
    if (lowerText.includes(keyword.toLowerCase())) {
      score += 3
    }
  }

  // Bonus for carousel posts with list-like content
  if (isCarousel) {
    // Check for numbered items or bullet points
    if (/(?:\d+[.):]\s|[-•]\s)/m.test(text)) {
      score += 5
    }
    // Bonus for having emojis (common in carousel captions)
    if (/[\u{1F300}-\u{1F9FF}]/u.test(text)) {
      score += 3
    }
  }

  return score
}

/**
 * Check if a potential caption is valid (not UI text or boilerplate).
 *
 * This function filters out:
 * - Instagram UI elements (login, signup, etc.)
 * - Instagram boilerplate text (e.g., "Join X on Instagram")
 * - Markdown link patterns
 * - Copyright text
 * - Captions that are only hashtags
 * - Extremely short captions (under 10 chars)
 */
export function isValidCaption(text: string): boolean {
  if (!text || text.length < 10) return false

  const lowerText = text.toLowerCase().trim()

  // Skip UI elements and Instagram's personalized CTAs
  const invalidPatterns = [
    'log in',
    'sign up',
    'never miss',
    'keep up with',
    'join instagram',
    'join to see',
    'see more on instagram',
    'open app',
    'get the app',
    'download',
    'install',
    'copyright',
    'meta platforms',
    'terms of use',
    'privacy policy',
    'cookies',
    'about us',
    'press',
    'api',
    'jobs',
    'blog',
    'verified badge',
    'meta verified',
    'creators account',
    'hashtags',
    'locations',
    'instagram lite',
    'threads',
    'contact uploading',
    'turn on notifications',
    'tap the',
    'click the link',
    'by continuing, you agree',
    'create an account',
  ]

  for (const pattern of invalidPatterns) {
    if (lowerText.includes(pattern)) return false
  }

  // Skip "Join X on Instagram" boilerplate pattern (common CTA that appears before actual content)
  // This pattern catches: "Join username on Instagram", "Join @username on Instagram", "Join Full Name on Instagram"
  if (/^join\s+.+\s+on\s+instagram$/i.test(text.trim())) return false

  // Skip if starts with common CTA words that indicate incomplete fragment
  const ctaStartPatterns = [
    /^follow\s+me/i,
    /^follow\s+for/i,
    /^follow\s+@/i,
    /^like\s+and\s+share/i,
    /^share\s+with/i,
    /^comment\s+below/i,
    /^tag\s+a\s+friend/i,
    /^double\s+tap/i,
    /^dm\s+me/i,
  ]

  for (const pattern of ctaStartPatterns) {
    if (pattern.test(text)) return false
  }

  // Skip if starts with markdown link pattern
  if (text.startsWith('[') || text.includes('](/')) return false

  // Skip copyright text
  if (text.includes('©')) return false

  // Skip if it's just "on Instagram" pattern without content
  if (/^\s*\w+\s+on\s+instagram\s*$/i.test(text)) return false

  // Skip if it's only hashtags (no actual content)
  const textWithoutHashtags = text.replace(/#\w+/g, '').trim()
  if (textWithoutHashtags.length < 5) return false

  // Skip if it looks like just a username mention
  if (/^@\w+\s*$/.test(text)) return false

  // Skip "X likes" or "X views" standalone patterns
  if (/^\d+\s*(likes?|views?|comments?)\s*$/i.test(text)) return false

  return true
}

/**
 * Generate a descriptive title for Instagram content using AI.
 *
 * This function:
 * 1. Tries to extract caption from full_content using multiple strategies
 * 2. If caption is too short (<50 chars), combines with OG description for more context
 * 3. Generates AI title with retry logic for transient failures
 * 4. Falls back to URL-based title if all else fails
 *
 * @param url - The Instagram URL
 * @param content - The full content from Parallel AI or OG description
 * @param contentType - The type of content (reel, post, etc.)
 * @param ogDescription - Optional OG description to use as fallback content
 * @param hashtags - Optional hashtags extracted from the content for additional context
 * @param carouselImageCount - Optional number of images in carousel (enables carousel-aware prompting)
 * @returns A descriptive title
 */
export async function generateInstagramTitle(
  url: string,
  content: string | null,
  contentType: 'reel' | 'post' | 'story' | 'unknown',
  ogDescription?: string | null,
  hashtags?: string[],
  carouselImageCount?: number
): Promise<string> {
  // Try to extract the actual caption from the full content
  const username = extractInstagramUsername(url)
  const isCarousel = carouselImageCount !== undefined && carouselImageCount >= 2
  let caption = content ? extractCaptionFromContent(content, username, isCarousel) : null

  debugLog(`[instagram] Initial caption extraction: "${caption?.slice(0, 100) ?? 'null'}..."`)
  debugLog(`[instagram] OG description available: "${ogDescription?.slice(0, 100) ?? 'null'}..."`)
  debugLog(`[instagram] Carousel: ${isCarousel ? `yes (${carouselImageCount} images)` : 'no'}`)

  // TEMPORARY DEBUG: Log caption extraction
  console.log(`[DEBUG:INSTAGRAM] Caption extraction:`)
  console.log(`[DEBUG:INSTAGRAM]   caption length: ${caption?.length ?? 0} chars`)
  console.log(`[DEBUG:INSTAGRAM]   caption (first 100): "${caption?.slice(0, 100) ?? 'null'}"`)
  console.log(`[DEBUG:INSTAGRAM]   isCarousel: ${isCarousel}`)
  console.log(`[DEBUG:INSTAGRAM]   carouselImageCount: ${carouselImageCount ?? 'N/A'}`)

  // If caption is too short, try to use OG description as additional context
  // Use relaxed threshold for carousels (30 chars instead of 50)
  const shortCaptionThreshold = isCarousel ? 30 : 50
  if (caption && caption.length < shortCaptionThreshold && ogDescription && ogDescription.trim().length > 20) {
    if (isValidCaption(ogDescription)) {
      // Combine short caption with OG description for more context
      const combinedCaption = `${caption} ${ogDescription.trim()}`
      debugLog(`[instagram] Caption too short, combining with OG description: "${combinedCaption.slice(0, 100)}..."`)
      caption = combinedCaption
    }
  }

  // If no caption found from content, try to use OG description directly
  if (!caption && ogDescription && ogDescription.trim().length > 10) {
    // Check if OG description is usable (not just boilerplate)
    if (isValidCaption(ogDescription)) {
      caption = ogDescription.trim()
      debugLog(`[instagram] Using OG description as caption fallback`)
    }
  }

  // If still no caption found, use fallback title
  if (!caption || caption.trim() === '') {
    debugLog('[instagram] Could not extract caption, using fallback title')
    return generateFallbackTitle(url, 'instagram')
  }

  debugLog(`[instagram] Final caption for title generation: "${caption.slice(0, 150)}..."`)

  const contentTypeLabel =
    contentType === 'reel'
      ? 'Instagram Reel'
      : contentType === 'post'
        ? 'Instagram Post'
        : 'Instagram content'

  // Build hashtag context if available
  const hashtagContext = hashtags && hashtags.length > 0
    ? `\nHashtags: #${hashtags.slice(0, 5).join(' #')}`
    : ''

  // Build carousel context hint for AI
  const carouselContext = isCarousel
    ? `\n\nIMPORTANT: This is a carousel post with ${carouselImageCount} images. The caption may be minimal (e.g., "Save these!") because the main content is in the images themselves. Focus on any topic indicators in the caption, hashtags, or context clues. If the caption mentions a list or collection (tools, tips, movies, etc.), emphasize that in the title.`
    : ''

  const prompt = `Generate a short, descriptive title (5-10 words max) for this ${contentTypeLabel}.

Caption: "${caption.slice(0, 400)}"${hashtagContext}${carouselContext}

CRITICAL Requirements:
- Create a clear, descriptive title that captures the MAIN TOPIC of the content
- Extract the key subject matter from the caption (what is it actually about?)
- If it mentions AI tools, software, apps, or tech - include "AI Tools" or the specific category
- If it mentions a specific number of items (e.g., "31 AI tools", "10 movies"), include that number
- If it's about recommendations or lists, mention what's being listed
- Do NOT include usernames or account names
- Do NOT mention "Instagram" or "Sign up" or "Log in"
- Do NOT use phrases like "Join X's Journey" or any personal names from CTAs
- Do NOT default to generic categories like "movies" unless that's clearly the topic
- IGNORE any "Join X on Instagram" or "Keep up with X" text - that's not the actual content
- Keep it concise and informative

Examples of good titles:
- "31 Must-Have AI Tools After Testing 1240+"
- "Top Productivity Apps for Remote Work"
- "Best Photography Tips for Beginners"
- "5 Books That Changed My Perspective"

Return ONLY the title, nothing else.`

  // Try to generate title with retry logic for transient errors
  let lastError: unknown = null
  let delayMs = AI_RETRY_DELAY_MS

  for (let attempt = 1; attempt <= AI_RETRY_ATTEMPTS; attempt++) {
    try {
      const { text } = await generateText({
        model: google('gemini-2.0-flash'),
        prompt,
        maxOutputTokens: 50,
      })

      const title = text.trim()

      // Validate the generated title
      if (title && title.length > 0 && !isTitleBad(title, url)) {
        return title
      }

      // If AI returned an invalid title, don't retry - it's not a transient error
      debugLog(`[instagram] AI generated invalid title, using fallback`)
      break
    } catch (error) {
      lastError = error
      const errorMessage = error instanceof Error ? error.message : String(error)

      // Check if this is a retryable error
      if (isRetryableError(error) && attempt < AI_RETRY_ATTEMPTS) {
        debugLog(`[instagram] AI title generation attempt ${attempt} failed, retrying...`)
        await sleep(delayMs)
        delayMs *= AI_RETRY_MULTIPLIER
      } else {
        // Non-retryable error or last attempt - log only on final failure
        console.error(`[instagram] Extraction failed: ${errorMessage}`)
        break
      }
    }
  }

  // Fallback to URL-based title
  return generateFallbackTitle(url, 'instagram')
}

/**
 * Build carousel metadata from Instagram media info
 */
function buildCarouselMetadata(mediaInfo: InstagramMediaInfo): {
  isCarousel: boolean
  itemCount: number
  hasVideos: boolean
  carouselItems: InstagramCarouselItem[]
} | null {
  if (!mediaInfo.isCarousel || !mediaInfo.carouselItems) {
    return null
  }

  const carouselItems: InstagramCarouselItem[] = mediaInfo.carouselItems.map((item) => ({
    isVideo: item.isVideo,
    url: item.url,
    thumbnailUrl: item.thumbnailUrl,
  }))

  return {
    isCarousel: true,
    itemCount: carouselItems.length,
    hasVideos: carouselItems.some((item) => item.isVideo),
    carouselItems,
  }
}

/**
 * Result from extracting media URLs, including warnings about incomplete extraction
 */
interface ExtractMediaUrlsResult {
  /** Array of extracted media URLs (primary + fallbacks) */
  mediaUrls: string[]
  /** Warning message if some URLs couldn't be extracted */
  imageUrlWarning?: string
  /** Number of carousel items with missing primary URLs */
  missingPrimaryCount: number
}

/**
 * Extract all media URLs from carousel items and OG metadata.
 *
 * This function extracts URLs in priority order:
 * 1. Carousel item primary URLs (highest quality)
 * 2. Carousel item thumbnail URLs (fallback for video items or missing primary)
 * 3. Post thumbnail URL
 * 4. OG image (lowest quality fallback)
 *
 * If some carousel items don't have accessible primary URLs, a warning is generated
 * to inform downstream processing that OCR quality may be degraded.
 */
function extractMediaUrls(
  mediaInfo: InstagramMediaInfo | null,
  ogImage: string | undefined
): ExtractMediaUrlsResult {
  const mediaUrls: string[] = []
  let missingPrimaryCount = 0

  // Add carousel item URLs first (they're the actual content)
  if (mediaInfo?.isCarousel && mediaInfo.carouselItems) {
    for (const item of mediaInfo.carouselItems) {
      if (item.url) {
        // Primary URL is available
        if (!mediaUrls.includes(item.url)) {
          mediaUrls.push(item.url)
        }
      } else if (item.thumbnailUrl) {
        // No primary URL - use thumbnail as fallback
        missingPrimaryCount++
        if (!mediaUrls.includes(item.thumbnailUrl)) {
          mediaUrls.push(item.thumbnailUrl)
        }
      } else {
        // Neither primary nor thumbnail available
        missingPrimaryCount++
      }

      // Also store thumbnail URLs as additional fallbacks for video items
      // Video thumbnails are useful for OCR since the video frame may contain text
      if (item.isVideo && item.thumbnailUrl && !mediaUrls.includes(item.thumbnailUrl)) {
        mediaUrls.push(item.thumbnailUrl)
      }
    }
  }

  // Add post thumbnail URL if available and not already included
  if (mediaInfo?.thumbnailUrl && !mediaUrls.includes(mediaInfo.thumbnailUrl)) {
    mediaUrls.push(mediaInfo.thumbnailUrl)
  }

  // Add OG image as final fallback if not already included
  if (ogImage && !mediaUrls.includes(ogImage)) {
    mediaUrls.push(ogImage)
  }

  // Generate warning if some carousel images couldn't be extracted
  let imageUrlWarning: string | undefined
  if (missingPrimaryCount > 0) {
    const totalItems = mediaInfo?.carouselItems?.length ?? 0
    const fetchedCount = totalItems - missingPrimaryCount
    imageUrlWarning = `Only ${fetchedCount}/${totalItems} carousel images could be extracted. OCR accuracy may be limited.`
    debugLog(`[instagram] ${imageUrlWarning}`)
  }

  return {
    mediaUrls: mediaUrls.length > 0 ? mediaUrls : [],
    imageUrlWarning,
    missingPrimaryCount,
  }
}

/**
 * Extract content from an Instagram URL
 *
 * Uses a multi-step extraction approach:
 * 1. Fetch Instagram media info (GraphQL) for carousel/video detection
 * 2. Try Parallel AI for content extraction
 * 3. Fall back to OG metadata extraction
 * 4. Always attempt AI title generation for posts with captions
 *
 * @param url - The Instagram URL to extract content from
 * @returns Extracted content or null if extraction fails
 */
export async function extractInstagramContent(url: string): Promise<ExtractedContent | null> {
  const contentType = detectInstagramContentType(url)
  const username = extractInstagramUsername(url)

  // First, fetch Instagram media info for carousel/video detection
  debugLog(`[instagram] Fetching media info for carousel detection...`)
  let mediaInfo: InstagramMediaInfo | null = null
  try {
    mediaInfo = await getInstagramMediaInfo(url)
    if (mediaInfo) {
      if (mediaInfo.isCarousel) {
        debugLog(`[instagram] Detected carousel with ${mediaInfo.carouselItems?.length ?? 0} items`)
      } else if (mediaInfo.isVideo) {
        debugLog(`[instagram] Detected video post`)
      } else {
        debugLog(`[instagram] Detected single image post`)
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    debugLog(`[instagram] Media info fetch failed: ${message}`)
  }

  // Try Parallel AI for content extraction
  debugLog(`[instagram] Trying Parallel AI extraction...`)
  let parallelResult = null
  try {
    parallelResult = await extractWithParallel(url)

    // Comprehensive debug logging for Parallel AI response
    if (parallelResult) {
      debugLog(`[instagram] Parallel AI response received:`)
      debugLog(`[instagram]   - title: "${parallelResult.title ?? 'null'}"`)
      debugLog(`[instagram]   - full_content length: ${parallelResult.full_content?.length ?? 0} chars`)
      debugLog(`[instagram]   - full_content preview:\n---\n${parallelResult.full_content?.slice(0, 800) ?? 'null'}${(parallelResult.full_content?.length ?? 0) > 800 ? '\n...(truncated)' : ''}\n---`)
      debugLog(`[instagram]   - excerpts: ${JSON.stringify(parallelResult.excerpts?.slice(0, 3) ?? null)}`)

      // TEMPORARY DEBUG: Always log for bookmark f8ef83a4-aa07-4fc2-86ff-c33530137323
      console.log(`[DEBUG:INSTAGRAM] Parallel AI returned:`)
      console.log(`[DEBUG:INSTAGRAM]   title: "${parallelResult.title ?? 'null'}"`)
      console.log(`[DEBUG:INSTAGRAM]   full_content length: ${parallelResult.full_content?.length ?? 0} chars`)
      console.log(`[DEBUG:INSTAGRAM]   full_content (first 100): "${parallelResult.full_content?.slice(0, 100) ?? 'null'}"`)
    } else {
      debugLog(`[instagram] Parallel AI returned null`)
      console.log(`[DEBUG:INSTAGRAM] Parallel AI returned null`)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[instagram] Extraction failed: ${message}`)
    console.log(`[DEBUG:INSTAGRAM] Parallel AI extraction error: ${message}`)
  }

  // Also get OG metadata early for image and description fallback
  const ogMetadata = await extractOGMetadata(url)
  const ogDescription = ogMetadata?.ogDescription || ogMetadata?.metaDescription || null

  // Debug log OG metadata
  if (ogMetadata) {
    debugLog(`[instagram] OG metadata received:`)
    debugLog(`[instagram]   - ogTitle: "${ogMetadata.ogTitle ?? 'null'}"`)
    debugLog(`[instagram]   - ogDescription: "${ogMetadata.ogDescription?.slice(0, 200) ?? 'null'}"`)
    debugLog(`[instagram]   - ogImage: ${ogMetadata.ogImage ? 'present' : 'null'}`)
  } else {
    debugLog(`[instagram] OG metadata returned null`)
  }

  // Build carousel metadata if applicable
  const carouselData = mediaInfo ? buildCarouselMetadata(mediaInfo) : null

  // Extract all media URLs (carousel items + OG image) with warning for missing images
  const mediaUrlResult = extractMediaUrls(mediaInfo, ogMetadata?.ogImage)
  const { mediaUrls: allMediaUrls, imageUrlWarning } = mediaUrlResult

  // TEMPORARY DEBUG: Log carousel detection and media URLs
  console.log(`[DEBUG:INSTAGRAM] Carousel detection:`)
  console.log(`[DEBUG:INSTAGRAM]   isCarousel: ${carouselData?.isCarousel ?? false}`)
  console.log(`[DEBUG:INSTAGRAM]   itemCount: ${carouselData?.itemCount ?? 0}`)
  console.log(`[DEBUG:INSTAGRAM]   mediaUrls count: ${allMediaUrls.length}`)
  console.log(`[DEBUG:INSTAGRAM]   mediaUrls (first 3): ${JSON.stringify(allMediaUrls.slice(0, 3).map(u => u.slice(0, 60) + '...'))}`)
  if (imageUrlWarning) {
    console.log(`[DEBUG:INSTAGRAM]   imageUrlWarning: ${imageUrlWarning}`)
  }

  if (parallelResult && parallelResult.full_content && parallelResult.full_content.length > MIN_CONTENT_LENGTH) {
    debugLog(`[instagram] Extraction method: Parallel AI (success)`)

    // Extract hashtags and mentions from content
    const hashtags = extractHashtags(parallelResult.full_content)
    const mentions = extractMentions(parallelResult.full_content)

    // Always attempt AI title generation for posts with captions
    // Only use Parallel title if it's actually good (not generic)
    let title = parallelResult.title || ''
    const hasCaption = parallelResult.full_content && parallelResult.full_content.trim().length > 0

    // TEMPORARY DEBUG: Log title generation decision
    console.log(`[DEBUG:INSTAGRAM] Title generation decision:`)
    console.log(`[DEBUG:INSTAGRAM]   original title: "${title}"`)
    console.log(`[DEBUG:INSTAGRAM]   isTitleBad: ${isTitleBad(title, url)}`)
    console.log(`[DEBUG:INSTAGRAM]   hasCaption: ${hasCaption}`)
    console.log(`[DEBUG:INSTAGRAM]   isCarousel: ${carouselData?.isCarousel ?? false}`)

    if (isTitleBad(title, url) || (hasCaption && carouselData?.isCarousel)) {
      // For carousel posts with captions, always try AI title generation
      // to get a descriptive title based on the actual content
      debugLog(`[instagram] Generating AI title from caption`)
      console.log(`[DEBUG:INSTAGRAM] Triggering AI title generation...`)
      // Pass carousel image count for carousel-aware title generation
      const carouselImageCount = carouselData?.isCarousel ? carouselData.itemCount : undefined
      title = await generateInstagramTitle(url, parallelResult.full_content, contentType, ogDescription, hashtags, carouselImageCount)
      console.log(`[DEBUG:INSTAGRAM] AI-generated title: "${title}"`)
    }

    // Build Instagram metadata
    const instagramMeta: InstagramMetadata = {
      postType: contentType !== 'unknown' ? contentType : undefined,
      caption: parallelResult.full_content,
      hashtags: hashtags.length > 0 ? hashtags : undefined,
      mentions: mentions.length > 0 ? mentions : undefined,
    }

    // Add carousel metadata if present
    if (carouselData) {
      instagramMeta.isCarousel = carouselData.isCarousel
      instagramMeta.carouselItems = carouselData.carouselItems
    }

    return {
      url,
      source: 'instagram',
      title,
      content: parallelResult.full_content,
      author: username ? `@${username}` : undefined,
      mediaUrls: allMediaUrls.length > 0 ? allMediaUrls : undefined,
      ogImage: ogMetadata?.ogImage,
      rawMetadata: {
        instagram: instagramMeta,
        excerpts: parallelResult.excerpts,
        ...(carouselData && {
          carouselInfo: {
            isCarousel: carouselData.isCarousel,
            itemCount: carouselData.itemCount,
            hasVideos: carouselData.hasVideos,
          },
        }),
        ...(imageUrlWarning && { imageUrlWarning }),
      },
    }
  }

  // Log why Parallel AI was not used (only in debug mode)
  if (parallelResult) {
    const contentLength = parallelResult.full_content?.length ?? 0
    debugLog(`[instagram] Parallel AI content too short (${contentLength} chars), using OG metadata fallback`)
  } else {
    debugLog(`[instagram] Parallel AI failed, using OG metadata fallback`)
  }

  // OG metadata was already fetched above, reuse it
  if (ogMetadata) {
    debugLog(`[instagram] Extraction method: OG metadata (fallback)`)
  }

  if (!ogMetadata) {
    debugLog(`[instagram] All extractors failed, using fallback title`)
    const fallbackTitle = generateFallbackTitle(url, 'instagram')

    // Build minimal Instagram metadata
    const instagramMeta: InstagramMetadata = {
      postType: contentType !== 'unknown' ? contentType : undefined,
    }

    // Add carousel metadata if present
    if (carouselData) {
      instagramMeta.isCarousel = carouselData.isCarousel
      instagramMeta.carouselItems = carouselData.carouselItems
    }

    // Return minimal content with fallback title
    return {
      url,
      source: 'instagram',
      title: fallbackTitle,
      content: '',
      author: username ? `@${username}` : undefined,
      mediaUrls: allMediaUrls.length > 0 ? allMediaUrls : undefined,
      rawMetadata: {
        instagram: instagramMeta,
        ...(carouselData && {
          carouselInfo: {
            isCarousel: carouselData.isCarousel,
            itemCount: carouselData.itemCount,
            hasVideos: carouselData.hasVideos,
          },
        }),
        ...(imageUrlWarning && { imageUrlWarning }),
      },
    }
  }

  // Check if OG title is generic (just "Instagram" or similar)
  let title = ogMetadata.ogTitle || ogMetadata.pageTitle || ''
  const description = ogMetadata.ogDescription || ogMetadata.metaDescription || ''

  // Extract hashtags and mentions from description if available
  let hashtags: string[] = []
  let mentions: string[] = []
  if (description) {
    hashtags = extractHashtags(description)
    mentions = extractMentions(description)
  }

  // Always attempt AI title generation if we have content
  // Fall back to generic title only if caption extraction AND AI generation fail
  if (isTitleBad(title, url) || (description && description.trim().length > 10)) {
    debugLog(`[instagram] Generating AI title from description`)
    // Pass carousel image count for carousel-aware title generation
    const carouselImageCount = carouselData?.isCarousel ? carouselData.itemCount : undefined
    title = await generateInstagramTitle(url, description, contentType, description, hashtags, carouselImageCount)
  }

  // Build Instagram metadata
  const instagramMeta: InstagramMetadata = {
    postType: contentType !== 'unknown' ? contentType : undefined,
    caption: description || undefined,
    hashtags: hashtags.length > 0 ? hashtags : undefined,
    mentions: mentions.length > 0 ? mentions : undefined,
  }

  // Add carousel metadata if present
  if (carouselData) {
    instagramMeta.isCarousel = carouselData.isCarousel
    instagramMeta.carouselItems = carouselData.carouselItems
  }

  // Build raw metadata
  const rawMetadata: RawMetadata = {
    og: {
      title: ogMetadata.ogTitle,
      description: ogMetadata.ogDescription,
      image: ogMetadata.ogImage,
      siteName: ogMetadata.ogSiteName,
      type: ogMetadata.ogType,
    },
    instagram: instagramMeta,
    ...(carouselData && {
      carouselInfo: {
        isCarousel: carouselData.isCarousel,
        itemCount: carouselData.itemCount,
        hasVideos: carouselData.hasVideos,
      },
    }),
    ...(imageUrlWarning && { imageUrlWarning }),
  }

  return {
    url,
    source: 'instagram',
    title,
    content: description,
    author: username ? `@${username}` : ogMetadata.metaAuthor,
    mediaUrls: allMediaUrls.length > 0 ? allMediaUrls : undefined,
    ogTitle: ogMetadata.ogTitle,
    ogDescription: ogMetadata.ogDescription,
    ogImage: ogMetadata.ogImage,
    ogSiteName: ogMetadata.ogSiteName,
    ogType: ogMetadata.ogType,
    metaDescription: ogMetadata.metaDescription,
    metaAuthor: ogMetadata.metaAuthor,
    rawMetadata,
  }
}
