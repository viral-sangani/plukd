/**
 * Extension Routes
 * Handles API requests from the Plukd browser extension
 */

import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth'
import {
  generateReplyWithRetry,
  type TweetContext,
  type ReplyOptions,
} from '../lib/ai/reply-generator'
import { isValidTone, type ToneType } from '../lib/ai/tone-manager'

export const extensionRoutes = new Hono()

// All routes require authentication
extensionRoutes.use('*', authMiddleware)

// Schema for media item from extension
const mediaItemSchema = z.object({
  type: z.enum(['image', 'video']),
  url: z.string().url(),
  base64: z.string().optional(),
  mimeType: z.string().optional(),
})

// Schema for tweet context from extension
const tweetContextSchema = z.object({
  text: z.string().min(1),
  author: z.string().nullable().optional(),
  language: z.string().default('en'),
  type: z.string().default('tweet'),
  hasMedia: z.boolean().default(false),
  isThread: z.boolean().default(false),
  isReply: z.boolean().default(false),
  isVerified: z.boolean().default(false),
  mentions: z.array(z.string()).default([]),
  hashtags: z.array(z.string()).default([]),
  timestamp: z.string().nullable().optional(),
  media: z.array(mediaItemSchema).optional(),
})

// Schema for extension generate-reply request
const extensionGenerateReplySchema = z.object({
  tweetContext: tweetContextSchema,
  tone: z.string().default('casual'),
  prompt: z.string().min(1),
  media: z.array(mediaItemSchema).optional(),
})

/**
 * POST /api/extension/generate-reply
 * Generate an AI-powered reply for the extension
 *
 * This endpoint accepts the extension's request format and adapts it
 * to work with the existing AI reply generation service.
 */
extensionRoutes.post('/generate-reply', async (c) => {
  const startTime = Date.now()

  try {
    const user = c.get('user')
    const body = await c.req.json()

    console.log('[extension] 🚀 Generate reply request received')
    console.log('[extension] User ID:', user.id)
    console.log('[extension] Request keys:', Object.keys(body))

    // Validate request body
    const validatedData = extensionGenerateReplySchema.parse(body)
    console.log('[extension] ✅ Request validated')

    const { tweetContext, tone, prompt, media } = validatedData

    // Validate tone
    if (!isValidTone(tone)) {
      console.error('[extension] ❌ Invalid tone:', tone)
      return c.json(
        {
          error: `Invalid tone: ${tone}. Must be one of: casual, professional, humorous, troll, bully, roasting`,
        },
        400
      )
    }

    // Transform extension tweet context to AI service format
    const aiTweetContext: TweetContext = {
      text: tweetContext.text,
      author: tweetContext.author || 'Unknown',
      type: tweetContext.type as 'tweet' | 'reply' | 'thread',
      media: media?.map((m) => ({
        url: m.url,
        type: m.type,
      })),
      thread: undefined,
      replies: undefined,
    }

    console.log('[extension] 📋 Tweet context:', {
      textLength: aiTweetContext.text.length,
      author: aiTweetContext.author,
      type: aiTweetContext.type,
      hasMedia: !!aiTweetContext.media && aiTweetContext.media.length > 0,
    })

    // Build options for AI service
    const options: ReplyOptions = {
      tone: tone as ToneType,
      includeEmoji: true, // Default for extension
      additionalInstructions: `User prompt: ${prompt}`,
    }

    console.log('[extension] 🤖 Generating reply with tone:', tone)

    // Generate reply with retry logic
    const reply = await generateReplyWithRetry(
      aiTweetContext,
      options,
      3 // max retries
    )

    const endTime = Date.now()
    console.log(`[extension] ✅ Reply generated in ${endTime - startTime}ms`)
    console.log('[extension] Reply length:', reply.length)

    return c.json({
      reply,
      tone,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const endTime = Date.now()
    console.error(`[extension] ❌ Error after ${endTime - startTime}ms:`, error)

    // Handle validation errors
    if (error instanceof z.ZodError) {
      console.error('[extension] Validation errors:', error.issues)
      return c.json(
        {
          error: 'Invalid request data',
          details: error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
        400
      )
    }

    // Handle AI generation errors
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to generate reply'

    console.error('[extension] Error message:', errorMessage)

    return c.json(
      {
        error: errorMessage,
      },
      500
    )
  }
})

/**
 * GET /api/extension/health
 * Health check endpoint for extension service
 */
extensionRoutes.get('/health', async (c) => {
  return c.json({
    status: 'ok',
    service: 'extension-api',
    timestamp: new Date().toISOString(),
  })
})
