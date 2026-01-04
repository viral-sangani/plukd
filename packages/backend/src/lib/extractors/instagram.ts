import { google } from '@ai-sdk/google'
import { generateText } from 'ai'
import { generateFallbackTitle, isTitleBad } from '@plukd/shared'
import type { ExtractedContent, RawMetadata, InstagramMetadata } from '@plukd/shared'
import { extractOGMetadata } from './og-metadata'
import { extractWithParallel } from './parallel-client'

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
 * Generate a descriptive title for Instagram content using AI
 *
 * This is called when OG metadata doesn't provide a good title
 * (e.g., just "Instagram" or empty)
 *
 * @param url - The Instagram URL
 * @param ogDescription - The OG description if available
 * @param contentType - The type of content (reel, post, etc.)
 * @returns A descriptive title
 */
/**
 * Extract the actual caption/post content from Instagram page content.
 * The full_content from Parallel AI contains login prompts and other junk.
 * This function extracts just the meaningful caption text.
 */
function extractCaptionFromContent(content: string, username: string | null): string | null {
  // Try to find the caption after the username mention
  // Pattern: [username](/username/) followed by caption text
  if (username) {
    // Look for pattern: [username](/username/)\n\nCaption text
    const usernamePattern = new RegExp(`\\[${username}\\]\\(/[^)]+/\\)\\s*\\n\\n([^\\n\\[]+)`, 'i')
    const match = content.match(usernamePattern)
    if (match && match[1]) {
      const caption = match[1].trim()
      // Filter out navigation/UI text
      if (caption.length > 5 && !caption.toLowerCase().includes('log in') && !caption.toLowerCase().includes('sign up')) {
        return caption
      }
    }
  }

  // Try to find any line that looks like a caption (not UI elements)
  const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 10)
  for (const line of lines) {
    // Skip UI elements and Instagram's personalized CTAs
    const lowerLine = line.toLowerCase()
    if (lowerLine.includes('log in') ||
        lowerLine.includes('sign up') ||
        lowerLine.includes('never miss') ||
        lowerLine.includes('follow') ||
        lowerLine.includes('join ') && lowerLine.includes(' on instagram') || // "Join X on Instagram" CTA
        lowerLine.includes('keep up with') || // "Keep up with what's new from X" CTA
        line.includes('](/') ||
        line.startsWith('[') ||
        line.includes('©')) {
      continue
    }
    // Found a potential caption
    if (line.length > 10 && line.length < 500) {
      return line
    }
  }

  return null
}

export async function generateInstagramTitle(
  url: string,
  content: string | null,
  contentType: 'reel' | 'post' | 'story' | 'unknown'
): Promise<string> {
  // Try to extract the actual caption from the full content
  const username = extractInstagramUsername(url)
  const caption = content ? extractCaptionFromContent(content, username) : null

  // If no caption found, use fallback title
  if (!caption || caption.trim() === '') {
    console.log('[instagram] Could not extract caption, using fallback title')
    return generateFallbackTitle(url, 'instagram')
  }

  console.log(`[instagram] Extracted caption for title generation: "${caption.slice(0, 100)}"`)

  const contentTypeLabel =
    contentType === 'reel'
      ? 'Instagram Reel'
      : contentType === 'post'
        ? 'Instagram Post'
        : 'Instagram content'

  const prompt = `Generate a short, descriptive title (5-10 words max) for this ${contentTypeLabel}.

Caption: "${caption.slice(0, 300)}"

Requirements:
- Create a clear, descriptive title that captures the main topic
- If it's about recommendations (movies, books, shows), include what's being recommended
- If it mentions specific items (movie names, show titles), include them
- Do NOT include usernames or account names
- Do NOT mention "Instagram" or "Sign up" or "Log in"
- Do NOT use phrases like "Join X's Journey" or any personal names from CTAs
- IGNORE any "Join X on Instagram" or "Keep up with X" text - that's not the actual content
- Keep it concise and informative

Return ONLY the title, nothing else.`

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
  } catch (error) {
    console.error('[instagram] AI title generation failed:', error)
  }

  // Fallback to URL-based title
  return generateFallbackTitle(url, 'instagram')
}

/**
 * Extract content from an Instagram URL
 *
 * Uses a multi-step extraction approach:
 * 1. Try Parallel AI first (best for social media content extraction)
 * 2. Fall back to OG metadata extraction
 * 3. Generate AI title when OG title is generic
 *
 * @param url - The Instagram URL to extract content from
 * @returns Extracted content or null if extraction fails
 */
export async function extractInstagramContent(url: string): Promise<ExtractedContent | null> {
  console.log(`[instagram] Extracting content from: ${url}`)

  const contentType = detectInstagramContentType(url)
  const username = extractInstagramUsername(url)

  // First, try Parallel AI which is better at extracting social media content
  console.log(`[instagram] Trying Parallel AI extraction...`)
  let parallelResult = null
  try {
    parallelResult = await extractWithParallel(url)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[instagram] Parallel AI extraction error: ${message}`)
  }

  if (parallelResult && parallelResult.full_content && parallelResult.full_content.length > 50) {
    console.log(`[instagram] Parallel AI extracted content: ${parallelResult.full_content.slice(0, 100)}...`)

    // Generate AI title from content if title is bad
    let title = parallelResult.title || ''
    if (isTitleBad(title, url)) {
      console.log(`[instagram] Parallel title is generic ("${title}"), generating AI title`)
      title = await generateInstagramTitle(url, parallelResult.full_content, contentType)
    }

    // Also get OG image for the thumbnail
    const ogMetadata = await extractOGMetadata(url)

    return {
      url,
      source: 'instagram',
      title,
      content: parallelResult.full_content,
      author: username ? `@${username}` : undefined,
      mediaUrls: ogMetadata?.ogImage ? [ogMetadata.ogImage] : undefined,
      ogImage: ogMetadata?.ogImage,
      rawMetadata: {
        instagram: {
          postType: contentType !== 'unknown' ? contentType : undefined,
          caption: parallelResult.full_content,
        } as InstagramMetadata,
        excerpts: parallelResult.excerpts,
      },
    }
  }

  console.log(`[instagram] Parallel AI failed or returned no content, trying OG metadata...`)

  // Fall back to OG metadata extraction
  const ogMetadata = await extractOGMetadata(url)

  if (ogMetadata) {
    console.log(`[instagram] OG metadata extracted:`)
    console.log(`  - ogTitle: "${ogMetadata.ogTitle}"`)
    console.log(`  - ogDescription: "${ogMetadata.ogDescription?.slice(0, 100)}..."`)
    console.log(`  - pageTitle: "${ogMetadata.pageTitle}"`)
    console.log(`  - metaDescription: "${ogMetadata.metaDescription?.slice(0, 100)}..."`)
    console.log(`  - ogImage: "${ogMetadata.ogImage?.slice(0, 50)}..."`)
  }

  if (!ogMetadata) {
    console.log(`[instagram] OG metadata extraction failed for: ${url}`)
    // Return minimal content with fallback title
    return {
      url,
      source: 'instagram',
      title: generateFallbackTitle(url, 'instagram'),
      content: '',
      author: username ? `@${username}` : undefined,
      rawMetadata: {
        instagram: {
          postType: contentType !== 'unknown' ? contentType : undefined,
        } as InstagramMetadata,
      },
    }
  }

  // Check if OG title is generic (just "Instagram" or similar)
  let title = ogMetadata.ogTitle || ogMetadata.pageTitle || ''
  const description = ogMetadata.ogDescription || ogMetadata.metaDescription || ''

  // If title is bad, generate one using AI
  if (isTitleBad(title, url)) {
    console.log(`[instagram] OG title is generic ("${title}"), generating AI title from description`)
    title = await generateInstagramTitle(url, description, contentType)
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
    instagram: {
      postType: contentType !== 'unknown' ? contentType : undefined,
      caption: description || undefined,
    } as InstagramMetadata,
  }

  return {
    url,
    source: 'instagram',
    title,
    content: description,
    author: username ? `@${username}` : ogMetadata.metaAuthor,
    mediaUrls: ogMetadata.ogImage ? [ogMetadata.ogImage] : undefined,
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
