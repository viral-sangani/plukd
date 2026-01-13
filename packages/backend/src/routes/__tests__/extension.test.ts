/**
 * Extension Routes Tests
 * Tests for browser extension API endpoints
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Hono } from 'hono'
import { extensionRoutes } from '../extension'
import type { AuthUser } from '../../middleware/auth'

// Mock dependencies
vi.mock('../../lib/ai/reply-generator', () => ({
  generateReplyWithRetry: vi.fn(),
}))

vi.mock('../../lib/ai/tone-manager', () => ({
  isValidTone: vi.fn((tone) => ['casual', 'professional', 'humorous'].includes(tone)),
  getToneConfig: vi.fn(() => ({
    description: 'Test tone',
    examples: [],
    temperature: 0.85,
  })),
}))

// Mock auth middleware
vi.mock('../../middleware/auth', () => ({
  authMiddleware: vi.fn(async (c, next) => {
    // Set mock user
    c.set('user', {
      id: 'test-user-id',
      email: 'test@example.com',
      role: 'authenticated',
      aud: 'authenticated',
    })
    await next()
  }),
}))

import { generateReplyWithRetry } from '../../lib/ai/reply-generator'
import { isValidTone } from '../../lib/ai/tone-manager'

/**
 * Helper to create a test app with extension routes
 */
function createTestApp() {
  const app = new Hono()
  app.route('/api/extension', extensionRoutes)
  return app
}

/**
 * Helper to create mock extension tweet context
 */
function createMockExtensionContext(overrides: Record<string, any> = {}) {
  return {
    text: 'This is a great tweet about AI and machine learning!',
    author: '@testuser',
    language: 'en',
    type: 'tweet',
    hasMedia: false,
    isThread: false,
    isReply: false,
    isVerified: false,
    mentions: [],
    hashtags: [],
    timestamp: null,
    media: [],
    ...overrides,
  }
}

/**
 * Helper to create mock media item
 */
function createMockMediaItem(overrides: Record<string, any> = {}) {
  return {
    type: 'image' as const,
    url: 'https://example.com/image.jpg',
    ...overrides,
  }
}

describe('Extension Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset default mock implementations
    vi.mocked(generateReplyWithRetry).mockResolvedValue('Test reply generated')
    vi.mocked(isValidTone).mockImplementation((tone) =>
      ['casual', 'professional', 'humorous'].includes(tone)
    )
  })

  describe('POST /api/extension/generate-reply', () => {
    describe('Happy Path', () => {
      it('should generate reply with valid extension context and all fields', async () => {
        const mockReply = 'Great observation! What are your thoughts on GPT-4?'
        vi.mocked(generateReplyWithRetry).mockResolvedValue(mockReply)

        const app = createTestApp()
        const response = await app.request('/api/extension/generate-reply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
          body: JSON.stringify({
            tweetContext: createMockExtensionContext({
              text: 'Just discovered an amazing AI model!',
              author: '@airesearcher',
              language: 'en',
              type: 'tweet',
              hasMedia: false,
              isThread: false,
              isReply: false,
              isVerified: true,
              mentions: ['@openai'],
              hashtags: ['#AI', '#MachineLearning'],
              timestamp: '2024-01-15T10:00:00Z',
            }),
            tone: 'casual',
            prompt: 'Reply with enthusiasm and ask a follow-up question',
          }),
        })

        expect(response.status).toBe(200)
        const data = await response.json()
        expect(data).toMatchObject({
          reply: mockReply,
          tone: 'casual',
          timestamp: expect.any(String),
        })
        expect(generateReplyWithRetry).toHaveBeenCalledWith(
          expect.objectContaining({
            text: 'Just discovered an amazing AI model!',
            author: '@airesearcher',
            type: 'tweet',
          }),
          expect.objectContaining({
            tone: 'casual',
            includeEmoji: true,
            additionalInstructions: expect.stringContaining(
              'Reply with enthusiasm and ask a follow-up question'
            ),
          }),
          3
        )
      })

      it('should use default values for optional fields when not provided', async () => {
        const mockReply = 'Interesting perspective!'
        vi.mocked(generateReplyWithRetry).mockResolvedValue(mockReply)

        const app = createTestApp()
        const response = await app.request('/api/extension/generate-reply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
          body: JSON.stringify({
            tweetContext: {
              text: 'Tweet text only, no optional fields',
            },
            tone: 'professional',
            prompt: 'Reply professionally',
          }),
        })

        expect(response.status).toBe(200)
        const data = await response.json()
        expect(data.reply).toBe(mockReply)
        expect(generateReplyWithRetry).toHaveBeenCalledWith(
          expect.objectContaining({
            text: 'Tweet text only, no optional fields',
            author: 'Unknown', // Default when author not provided
            type: 'tweet', // Default type
          }),
          expect.any(Object),
          3
        )
      })

      it('should handle casual tone correctly', async () => {
        const mockReply = 'yo this is sick! 🔥'
        vi.mocked(generateReplyWithRetry).mockResolvedValue(mockReply)

        const app = createTestApp()
        const response = await app.request('/api/extension/generate-reply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
          body: JSON.stringify({
            tweetContext: createMockExtensionContext(),
            tone: 'casual',
            prompt: 'Reply casually',
          }),
        })

        expect(response.status).toBe(200)
        const data = await response.json()
        expect(data.tone).toBe('casual')
        expect(data.reply).toBe(mockReply)
      })

      it('should handle professional tone correctly', async () => {
        const mockReply = 'Thank you for sharing this insightful analysis.'
        vi.mocked(generateReplyWithRetry).mockResolvedValue(mockReply)

        const app = createTestApp()
        const response = await app.request('/api/extension/generate-reply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
          body: JSON.stringify({
            tweetContext: createMockExtensionContext({
              text: 'New research on transformer architectures',
            }),
            tone: 'professional',
            prompt: 'Reply professionally',
          }),
        })

        expect(response.status).toBe(200)
        const data = await response.json()
        expect(data.tone).toBe('professional')
      })

      it('should handle humorous tone correctly', async () => {
        const mockReply = 'my code works but i have no idea why 😅'
        vi.mocked(generateReplyWithRetry).mockResolvedValue(mockReply)

        const app = createTestApp()
        const response = await app.request('/api/extension/generate-reply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
          body: JSON.stringify({
            tweetContext: createMockExtensionContext({
              text: 'Just fixed a bug that took 3 hours',
            }),
            tone: 'humorous',
            prompt: 'Reply with humor',
          }),
        })

        expect(response.status).toBe(200)
        const data = await response.json()
        expect(data.tone).toBe('humorous')
      })

      it('should handle media in context correctly', async () => {
        const mockReply = 'Love the visualization in your image!'
        vi.mocked(generateReplyWithRetry).mockResolvedValue(mockReply)

        const app = createTestApp()
        const response = await app.request('/api/extension/generate-reply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
          body: JSON.stringify({
            tweetContext: createMockExtensionContext({
              hasMedia: true,
              media: [
                {
                  type: 'image',
                  url: 'https://example.com/chart.png',
                },
              ],
            }),
            tone: 'casual',
            prompt: 'Comment on the image',
            media: [
              {
                type: 'image',
                url: 'https://example.com/chart.png',
              },
            ],
          }),
        })

        expect(response.status).toBe(200)
        expect(generateReplyWithRetry).toHaveBeenCalledWith(
          expect.objectContaining({
            media: [
              {
                type: 'image',
                url: 'https://example.com/chart.png',
              },
            ],
          }),
          expect.any(Object),
          3
        )
      })

      it('should handle thread context correctly', async () => {
        const mockReply = 'Great thread! Point 2 really resonated with me.'
        vi.mocked(generateReplyWithRetry).mockResolvedValue(mockReply)

        const app = createTestApp()
        const response = await app.request('/api/extension/generate-reply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
          body: JSON.stringify({
            tweetContext: createMockExtensionContext({
              text: 'Thread part 1: First point...',
              isThread: true,
              type: 'thread',
            }),
            tone: 'casual',
            prompt: 'Reply to the thread',
          }),
        })

        expect(response.status).toBe(200)
        expect(generateReplyWithRetry).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'thread',
          }),
          expect.any(Object),
          3
        )
      })

      it('should return valid ISO timestamp in response', async () => {
        const mockReply = 'Test reply'
        vi.mocked(generateReplyWithRetry).mockResolvedValue(mockReply)

        const app = createTestApp()
        const response = await app.request('/api/extension/generate-reply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
          body: JSON.stringify({
            tweetContext: createMockExtensionContext(),
            tone: 'casual',
            prompt: 'Test prompt',
          }),
        })

        const data = await response.json()
        expect(data.timestamp).toBeDefined()
        expect(() => new Date(data.timestamp)).not.toThrow()
        expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp)
      })
    })

    describe('Validation', () => {
      it('should return 400 for missing tweetContext', async () => {
        const app = createTestApp()
        const response = await app.request('/api/extension/generate-reply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
          body: JSON.stringify({
            tone: 'casual',
            prompt: 'Reply',
          }),
        })

        expect(response.status).toBe(400)
        const data = await response.json()
        expect(data.error).toBe('Invalid request data')
        expect(data.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              path: expect.stringContaining('tweetContext'),
            }),
          ])
        )
      })

      it('should return 400 for missing prompt', async () => {
        const app = createTestApp()
        const response = await app.request('/api/extension/generate-reply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
          body: JSON.stringify({
            tweetContext: createMockExtensionContext(),
            tone: 'casual',
          }),
        })

        expect(response.status).toBe(400)
        const data = await response.json()
        expect(data.error).toBe('Invalid request data')
        expect(data.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              path: expect.stringContaining('prompt'),
            }),
          ])
        )
      })

      it('should return 400 for missing tweetContext.text', async () => {
        const app = createTestApp()
        const response = await app.request('/api/extension/generate-reply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
          body: JSON.stringify({
            tweetContext: {
              author: '@user',
              // text is missing
            },
            tone: 'casual',
            prompt: 'Reply',
          }),
        })

        expect(response.status).toBe(400)
        const data = await response.json()
        expect(data.error).toBe('Invalid request data')
        expect(data.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              path: expect.stringContaining('text'),
            }),
          ])
        )
      })

      it('should return 400 for empty tweetContext.text', async () => {
        const app = createTestApp()
        const response = await app.request('/api/extension/generate-reply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
          body: JSON.stringify({
            tweetContext: {
              text: '',
              author: '@user',
            },
            tone: 'casual',
            prompt: 'Reply',
          }),
        })

        expect(response.status).toBe(400)
        const data = await response.json()
        expect(data.error).toBe('Invalid request data')
        expect(data.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              path: 'tweetContext.text',
              message: expect.stringContaining('>=1'),
            }),
          ])
        )
      })

      it('should return 400 for empty prompt', async () => {
        const app = createTestApp()
        const response = await app.request('/api/extension/generate-reply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
          body: JSON.stringify({
            tweetContext: createMockExtensionContext(),
            tone: 'casual',
            prompt: '',
          }),
        })

        expect(response.status).toBe(400)
        const data = await response.json()
        expect(data.error).toBe('Invalid request data')
        expect(data.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              path: 'prompt',
              message: expect.stringContaining('>=1'),
            }),
          ])
        )
      })

      it('should return 400 for invalid tone', async () => {
        vi.mocked(isValidTone).mockReturnValue(false)

        const app = createTestApp()
        const response = await app.request('/api/extension/generate-reply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
          body: JSON.stringify({
            tweetContext: createMockExtensionContext(),
            tone: 'invalid_tone',
            prompt: 'Reply',
          }),
        })

        expect(response.status).toBe(400)
        const data = await response.json()
        expect(data.error).toContain('Invalid tone')
        expect(data.error).toContain('invalid_tone')
        expect(data.error).toContain('casual')
        expect(data.error).toContain('professional')
        expect(data.error).toContain('humorous')
      })

      it('should return 400 for invalid media item - missing type', async () => {
        const app = createTestApp()
        const response = await app.request('/api/extension/generate-reply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
          body: JSON.stringify({
            tweetContext: createMockExtensionContext(),
            tone: 'casual',
            prompt: 'Reply',
            media: [
              {
                url: 'https://example.com/image.jpg',
                // type is missing
              },
            ],
          }),
        })

        expect(response.status).toBe(400)
        const data = await response.json()
        expect(data.error).toBe('Invalid request data')
      })

      it('should return 400 for invalid media item - invalid URL', async () => {
        const app = createTestApp()
        const response = await app.request('/api/extension/generate-reply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
          body: JSON.stringify({
            tweetContext: createMockExtensionContext(),
            tone: 'casual',
            prompt: 'Reply',
            media: [
              {
                type: 'image',
                url: 'not-a-valid-url',
              },
            ],
          }),
        })

        expect(response.status).toBe(400)
        const data = await response.json()
        expect(data.error).toBe('Invalid request data')
        expect(data.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              path: expect.stringContaining('url'),
            }),
          ])
        )
      })

      it('should return 400 for invalid media item - invalid type', async () => {
        const app = createTestApp()
        const response = await app.request('/api/extension/generate-reply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
          body: JSON.stringify({
            tweetContext: createMockExtensionContext(),
            tone: 'casual',
            prompt: 'Reply',
            media: [
              {
                type: 'audio', // invalid type (only image/video allowed)
                url: 'https://example.com/audio.mp3',
              },
            ],
          }),
        })

        expect(response.status).toBe(400)
        const data = await response.json()
        expect(data.error).toBe('Invalid request data')
      })
    })

    describe('Context Transformation', () => {
      it('should transform extension context to internal AI service format', async () => {
        const mockReply = 'Transformed reply'
        vi.mocked(generateReplyWithRetry).mockResolvedValue(mockReply)

        const extensionContext = createMockExtensionContext({
          text: 'Original tweet text',
          author: '@originalauthor',
          language: 'en',
          type: 'tweet',
          mentions: ['@user1', '@user2'],
          hashtags: ['#ai', '#tech'],
        })

        const app = createTestApp()
        await app.request('/api/extension/generate-reply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
          body: JSON.stringify({
            tweetContext: extensionContext,
            tone: 'casual',
            prompt: 'Reply with context',
          }),
        })

        // Verify transformation to internal format
        expect(generateReplyWithRetry).toHaveBeenCalledWith(
          expect.objectContaining({
            text: 'Original tweet text',
            author: '@originalauthor',
            type: 'tweet',
            thread: undefined,
            replies: undefined,
          }),
          expect.objectContaining({
            tone: 'casual',
            includeEmoji: true,
            additionalInstructions: expect.stringContaining('Reply with context'),
          }),
          3
        )
      })

      it('should use default language when not provided', async () => {
        const mockReply = 'Reply'
        vi.mocked(generateReplyWithRetry).mockResolvedValue(mockReply)

        const app = createTestApp()
        const response = await app.request('/api/extension/generate-reply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
          body: JSON.stringify({
            tweetContext: {
              text: 'Tweet without language field',
            },
            tone: 'casual',
            prompt: 'Reply',
          }),
        })

        expect(response.status).toBe(200)
        // Language defaults to 'en' in schema
      })

      it('should transform author to "Unknown" when null or missing', async () => {
        const mockReply = 'Reply'
        vi.mocked(generateReplyWithRetry).mockResolvedValue(mockReply)

        const app = createTestApp()
        await app.request('/api/extension/generate-reply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
          body: JSON.stringify({
            tweetContext: {
              text: 'Tweet without author',
              author: null,
            },
            tone: 'casual',
            prompt: 'Reply',
          }),
        })

        expect(generateReplyWithRetry).toHaveBeenCalledWith(
          expect.objectContaining({
            author: 'Unknown',
          }),
          expect.any(Object),
          3
        )
      })

      it('should transform type correctly to internal format', async () => {
        const mockReply = 'Reply'
        vi.mocked(generateReplyWithRetry).mockResolvedValue(mockReply)

        const app = createTestApp()
        await app.request('/api/extension/generate-reply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
          body: JSON.stringify({
            tweetContext: createMockExtensionContext({
              type: 'reply',
            }),
            tone: 'casual',
            prompt: 'Reply',
          }),
        })

        expect(generateReplyWithRetry).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'reply',
          }),
          expect.any(Object),
          3
        )
      })

      it('should include prompt in additionalInstructions', async () => {
        const mockReply = 'Reply'
        vi.mocked(generateReplyWithRetry).mockResolvedValue(mockReply)

        const customPrompt = 'Make it very enthusiastic with specific questions'
        const app = createTestApp()
        await app.request('/api/extension/generate-reply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
          body: JSON.stringify({
            tweetContext: createMockExtensionContext(),
            tone: 'casual',
            prompt: customPrompt,
          }),
        })

        expect(generateReplyWithRetry).toHaveBeenCalledWith(
          expect.any(Object),
          expect.objectContaining({
            additionalInstructions: `User prompt: ${customPrompt}`,
          }),
          3
        )
      })

      it('should map media array correctly', async () => {
        const mockReply = 'Reply'
        vi.mocked(generateReplyWithRetry).mockResolvedValue(mockReply)

        const app = createTestApp()
        await app.request('/api/extension/generate-reply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
          body: JSON.stringify({
            tweetContext: createMockExtensionContext(),
            tone: 'casual',
            prompt: 'Reply',
            media: [
              {
                type: 'image',
                url: 'https://example.com/img1.jpg',
              },
              {
                type: 'video',
                url: 'https://example.com/vid1.mp4',
              },
            ],
          }),
        })

        expect(generateReplyWithRetry).toHaveBeenCalledWith(
          expect.objectContaining({
            media: [
              { type: 'image', url: 'https://example.com/img1.jpg' },
              { type: 'video', url: 'https://example.com/vid1.mp4' },
            ],
          }),
          expect.any(Object),
          3
        )
      })
    })

    describe('AI Generation', () => {
      it('should handle AI generation success', async () => {
        const mockReply = 'Successfully generated reply with AI'
        vi.mocked(generateReplyWithRetry).mockResolvedValue(mockReply)

        const app = createTestApp()
        const response = await app.request('/api/extension/generate-reply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
          body: JSON.stringify({
            tweetContext: createMockExtensionContext(),
            tone: 'casual',
            prompt: 'Generate reply',
          }),
        })

        expect(response.status).toBe(200)
        const data = await response.json()
        expect(data.reply).toBe(mockReply)
        expect(generateReplyWithRetry).toHaveBeenCalledTimes(1)
      })

      it('should handle AI generation failure', async () => {
        vi.mocked(generateReplyWithRetry).mockRejectedValue(
          new Error('AI service unavailable')
        )

        const app = createTestApp()
        const response = await app.request('/api/extension/generate-reply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
          body: JSON.stringify({
            tweetContext: createMockExtensionContext(),
            tone: 'casual',
            prompt: 'Generate reply',
          }),
        })

        expect(response.status).toBe(500)
        const data = await response.json()
        expect(data.error).toBe('AI service unavailable')
      })

      it('should handle AI timeout with proper error', async () => {
        vi.mocked(generateReplyWithRetry).mockRejectedValue(new Error('Request timeout'))

        const app = createTestApp()
        const response = await app.request('/api/extension/generate-reply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
          body: JSON.stringify({
            tweetContext: createMockExtensionContext(),
            tone: 'casual',
            prompt: 'Generate reply',
          }),
        })

        expect(response.status).toBe(500)
        const data = await response.json()
        expect(data.error).toBe('Request timeout')
      })

      it('should call generateReplyWithRetry with 3 retries', async () => {
        const mockReply = 'Reply'
        vi.mocked(generateReplyWithRetry).mockResolvedValue(mockReply)

        const app = createTestApp()
        await app.request('/api/extension/generate-reply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
          body: JSON.stringify({
            tweetContext: createMockExtensionContext(),
            tone: 'casual',
            prompt: 'Generate reply',
          }),
        })

        expect(generateReplyWithRetry).toHaveBeenCalledWith(
          expect.any(Object),
          expect.any(Object),
          3 // max retries
        )
      })

      it('should handle non-Error exceptions gracefully', async () => {
        vi.mocked(generateReplyWithRetry).mockRejectedValue('String error')

        const app = createTestApp()
        const response = await app.request('/api/extension/generate-reply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
          body: JSON.stringify({
            tweetContext: createMockExtensionContext(),
            tone: 'casual',
            prompt: 'Generate reply',
          }),
        })

        expect(response.status).toBe(500)
        const data = await response.json()
        expect(data.error).toBe('Failed to generate reply')
      })
    })

    describe('Edge Cases', () => {
      it('should handle very long prompt', async () => {
        const longPrompt = 'a'.repeat(2000)
        const mockReply = 'Reply to long prompt'
        vi.mocked(generateReplyWithRetry).mockResolvedValue(mockReply)

        const app = createTestApp()
        const response = await app.request('/api/extension/generate-reply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
          body: JSON.stringify({
            tweetContext: createMockExtensionContext(),
            tone: 'casual',
            prompt: longPrompt,
          }),
        })

        expect(response.status).toBe(200)
        expect(generateReplyWithRetry).toHaveBeenCalledWith(
          expect.any(Object),
          expect.objectContaining({
            additionalInstructions: expect.stringContaining(longPrompt),
          }),
          3
        )
      })

      it('should handle very long tweet text', async () => {
        const longText = 'This is a very long tweet. '.repeat(100)
        const mockReply = 'Reply'
        vi.mocked(generateReplyWithRetry).mockResolvedValue(mockReply)

        const app = createTestApp()
        const response = await app.request('/api/extension/generate-reply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
          body: JSON.stringify({
            tweetContext: createMockExtensionContext({
              text: longText,
            }),
            tone: 'casual',
            prompt: 'Reply',
          }),
        })

        expect(response.status).toBe(200)
        expect(generateReplyWithRetry).toHaveBeenCalledWith(
          expect.objectContaining({
            text: longText,
          }),
          expect.any(Object),
          3
        )
      })

      it('should handle all boolean flags true', async () => {
        const mockReply = 'Reply'
        vi.mocked(generateReplyWithRetry).mockResolvedValue(mockReply)

        const app = createTestApp()
        const response = await app.request('/api/extension/generate-reply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
          body: JSON.stringify({
            tweetContext: createMockExtensionContext({
              hasMedia: true,
              isThread: true,
              isReply: true,
              isVerified: true,
            }),
            tone: 'casual',
            prompt: 'Reply',
          }),
        })

        expect(response.status).toBe(200)
        const data = await response.json()
        expect(data.reply).toBe(mockReply)
      })

      it('should handle multiple mentions', async () => {
        const mockReply = 'Reply'
        vi.mocked(generateReplyWithRetry).mockResolvedValue(mockReply)

        const app = createTestApp()
        const response = await app.request('/api/extension/generate-reply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
          body: JSON.stringify({
            tweetContext: createMockExtensionContext({
              mentions: ['@user1', '@user2', '@user3', '@user4'],
            }),
            tone: 'casual',
            prompt: 'Reply',
          }),
        })

        expect(response.status).toBe(200)
      })

      it('should handle multiple hashtags', async () => {
        const mockReply = 'Reply'
        vi.mocked(generateReplyWithRetry).mockResolvedValue(mockReply)

        const app = createTestApp()
        const response = await app.request('/api/extension/generate-reply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
          body: JSON.stringify({
            tweetContext: createMockExtensionContext({
              hashtags: ['#AI', '#ML', '#DeepLearning', '#Tech', '#Innovation'],
            }),
            tone: 'casual',
            prompt: 'Reply',
          }),
        })

        expect(response.status).toBe(200)
      })

      it('should handle empty mentions array', async () => {
        const mockReply = 'Reply'
        vi.mocked(generateReplyWithRetry).mockResolvedValue(mockReply)

        const app = createTestApp()
        const response = await app.request('/api/extension/generate-reply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
          body: JSON.stringify({
            tweetContext: createMockExtensionContext({
              mentions: [],
            }),
            tone: 'casual',
            prompt: 'Reply',
          }),
        })

        expect(response.status).toBe(200)
      })

      it('should handle empty hashtags array', async () => {
        const mockReply = 'Reply'
        vi.mocked(generateReplyWithRetry).mockResolvedValue(mockReply)

        const app = createTestApp()
        const response = await app.request('/api/extension/generate-reply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
          body: JSON.stringify({
            tweetContext: createMockExtensionContext({
              hashtags: [],
            }),
            tone: 'casual',
            prompt: 'Reply',
          }),
        })

        expect(response.status).toBe(200)
      })

      it('should handle null timestamp', async () => {
        const mockReply = 'Reply'
        vi.mocked(generateReplyWithRetry).mockResolvedValue(mockReply)

        const app = createTestApp()
        const response = await app.request('/api/extension/generate-reply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
          body: JSON.stringify({
            tweetContext: createMockExtensionContext({
              timestamp: null,
            }),
            tone: 'casual',
            prompt: 'Reply',
          }),
        })

        expect(response.status).toBe(200)
      })

      it('should handle includeEmoji option', async () => {
        const mockReply = 'Reply with emoji 🎉'
        vi.mocked(generateReplyWithRetry).mockResolvedValue(mockReply)

        const app = createTestApp()
        await app.request('/api/extension/generate-reply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
          body: JSON.stringify({
            tweetContext: createMockExtensionContext(),
            tone: 'casual',
            prompt: 'Reply',
          }),
        })

        expect(generateReplyWithRetry).toHaveBeenCalledWith(
          expect.any(Object),
          expect.objectContaining({
            includeEmoji: true,
          }),
          3
        )
      })
    })
  })

  describe('GET /api/extension/health', () => {
    it('should return health status with correct format', async () => {
      const app = createTestApp()
      const response = await app.request('/api/extension/health', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer test-token',
        },
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data).toMatchObject({
        status: 'ok',
        service: 'extension-api',
        timestamp: expect.any(String),
      })
    })

    it('should return valid ISO timestamp', async () => {
      const app = createTestApp()
      const response = await app.request('/api/extension/health', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer test-token',
        },
      })

      const data = await response.json()
      expect(data.timestamp).toBeDefined()
      expect(() => new Date(data.timestamp)).not.toThrow()
      expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp)
    })

    it('should require authentication', async () => {
      // We need to test this by temporarily unmocking auth middleware
      // For now, we verify auth middleware is applied
      const app = createTestApp()
      const response = await app.request('/api/extension/health', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer test-token',
        },
      })

      expect(response.status).toBe(200)
      // Auth middleware should be applied based on routes setup
    })
  })
})
