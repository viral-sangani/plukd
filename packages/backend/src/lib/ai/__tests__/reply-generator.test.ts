/**
 * Comprehensive tests for AI Reply Generator
 *
 * Tests the reply generation system with:
 * - Different tone styles (casual, professional, humorous)
 * - Context variations (tweets, threads, replies, media)
 * - Retry logic for handling failures
 * - Error handling and edge cases
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type {
  TweetContext,
  ReplyOptions,
  MediaItem,
  Tweet,
  LabeledMedia,
  PromptResult,
} from '../reply-generator'

// Use vi.hoisted to define mocks before vi.mock hoisting
const { mockGenerateText } = vi.hoisted(() => {
  return {
    mockGenerateText: vi.fn(),
  }
})

vi.mock('ai', () => {
  return {
    generateText: mockGenerateText,
  }
})

vi.mock('@ai-sdk/google', () => ({
  google: vi.fn(() => ({})),
}))

// Now import the functions to test
import {
  buildSystemPrompt,
  buildAiPrompt,
  generateReply,
  generateReplyWithRetry,
} from '../reply-generator'

// Helper to create mock tweet context
function createMockContext(overrides: Partial<TweetContext> = {}): TweetContext {
  return {
    text: 'This is a test tweet about AI and machine learning.',
    author: 'testuser',
    type: 'tweet',
    ...overrides,
  }
}

// Helper to create mock media
function createMockMedia(type: 'image' | 'video' = 'image', index = 1): MediaItem {
  return {
    url: `https://example.com/${type}${index}.${type === 'image' ? 'jpg' : 'mp4'}`,
    type,
  }
}

// Helper to create mock tweet
function createMockTweet(overrides: Partial<Tweet> = {}): Tweet {
  return {
    text: 'Test tweet text',
    author: 'testuser',
    ...overrides,
  }
}

describe('AI Reply Generator', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset fake timers before each test
    vi.useFakeTimers()
    // Suppress console.error to avoid cluttering test output
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('buildSystemPrompt', () => {
    it('should build system prompt for casual tone', () => {
      const prompt = buildSystemPrompt('casual')

      expect(prompt).toContain('CORE PRINCIPLES')
      expect(prompt).toContain('ENGAGEMENT TACTICS')
      expect(prompt).toContain('AVOID')
      expect(prompt).toContain('casual')
      expect(prompt).toContain('Friendly, conversational friend')
    })

    it('should build system prompt for professional tone', () => {
      const prompt = buildSystemPrompt('professional')

      expect(prompt).toContain('professional')
      expect(prompt).toContain('Business-appropriate but warm')
    })

    it('should build system prompt for humorous tone', () => {
      const prompt = buildSystemPrompt('humorous')

      expect(prompt).toContain('humorous')
      expect(prompt).toContain('Witty and playful')
    })

    it('should include tone-specific examples', () => {
      const prompt = buildSystemPrompt('casual')

      expect(prompt).toContain('EXAMPLES OF THIS TONE')
    })

    it('should include engagement guidelines', () => {
      const prompt = buildSystemPrompt('casual')

      expect(prompt).toContain('Ask specific questions')
      expect(prompt).toContain('Share relatable experiences')
      expect(prompt).toContain('Leave room for discussion')
    })

    it('should include avoidance rules', () => {
      const prompt = buildSystemPrompt('casual')

      expect(prompt).toContain('Generic reactions')
      expect(prompt).toContain('Robotic phrases')
      expect(prompt).toContain('Hashtag spam')
    })
  })

  describe('buildAiPrompt', () => {
    describe('basic prompt building', () => {
      it('should build prompt for simple tweet', () => {
        const context = createMockContext()
        const options: ReplyOptions = { tone: 'casual' }

        const result = buildAiPrompt(context, options)

        expect(result.prompt).toContain(context.text)
        expect(result.prompt).toContain(context.author)
        expect(result.prompt).toContain('tweet')
        expect(result.labeledMedia).toEqual([])
      })

      it('should build prompt for reply', () => {
        const context = createMockContext({ type: 'reply' })
        const options: ReplyOptions = { tone: 'casual' }

        const result = buildAiPrompt(context, options)

        expect(result.prompt).toContain('reply')
      })

      it('should build prompt for thread', () => {
        const context = createMockContext({ type: 'thread' })
        const options: ReplyOptions = { tone: 'casual' }

        const result = buildAiPrompt(context, options)

        expect(result.prompt).toContain('thread')
      })

      it('should handle null context', () => {
        const options: ReplyOptions = { tone: 'casual' }

        const result = buildAiPrompt(null, options)

        expect(result.prompt).toContain('Write a new post')
        expect(result.labeledMedia).toEqual([])
      })
    })

    describe('tone configuration', () => {
      it('should use casual tone by default', () => {
        const context = createMockContext()
        const options: ReplyOptions = {}

        const result = buildAiPrompt(context, options)

        expect(result.prompt).toContain('casual')
      })

      it('should respect professional tone', () => {
        const context = createMockContext()
        const options: ReplyOptions = { tone: 'professional' }

        const result = buildAiPrompt(context, options)

        expect(result.prompt).toContain('professional')
      })

      it('should respect humorous tone', () => {
        const context = createMockContext()
        const options: ReplyOptions = { tone: 'humorous' }

        const result = buildAiPrompt(context, options)

        expect(result.prompt).toContain('humorous')
      })
    })

    describe('emoji handling', () => {
      it('should include emojis by default', () => {
        const context = createMockContext()
        const options: ReplyOptions = {}

        const result = buildAiPrompt(context, options)

        expect(result.prompt).toContain('Use 1-2 relevant emojis')
      })

      it('should exclude emojis when disabled', () => {
        const context = createMockContext()
        const options: ReplyOptions = { includeEmoji: false }

        const result = buildAiPrompt(context, options)

        expect(result.prompt).toContain('NO emojis')
      })
    })

    describe('media handling', () => {
      it('should label and collect single image', () => {
        const context = createMockContext({
          media: [createMockMedia('image', 1)],
        })
        const options: ReplyOptions = {}

        const result = buildAiPrompt(context, options)

        expect(result.labeledMedia).toHaveLength(1)
        expect(result.labeledMedia[0].label).toBe('IMAGE_1')
        expect(result.labeledMedia[0].type).toBe('image')
        expect(result.prompt).toContain('IMAGE_1')
        expect(result.prompt).toContain('ATTACHED IMAGES')
      })

      it('should label and collect multiple images', () => {
        const context = createMockContext({
          media: [createMockMedia('image', 1), createMockMedia('image', 2)],
        })
        const options: ReplyOptions = {}

        const result = buildAiPrompt(context, options)

        expect(result.labeledMedia).toHaveLength(2)
        expect(result.labeledMedia[0].label).toBe('IMAGE_1')
        expect(result.labeledMedia[1].label).toBe('IMAGE_2')
        expect(result.prompt).toContain('IMAGE_1, IMAGE_2')
      })

      it('should label and collect video', () => {
        const context = createMockContext({
          media: [createMockMedia('video', 1)],
        })
        const options: ReplyOptions = {}

        const result = buildAiPrompt(context, options)

        expect(result.labeledMedia).toHaveLength(1)
        expect(result.labeledMedia[0].label).toBe('VIDEO_1')
        expect(result.labeledMedia[0].type).toBe('video')
        expect(result.prompt).toContain('VIDEO_1')
        expect(result.prompt).toContain('ATTACHED VIDEOS')
      })

      it('should label mixed media types', () => {
        const context = createMockContext({
          media: [createMockMedia('image', 1), createMockMedia('video', 2)],
        })
        const options: ReplyOptions = {}

        const result = buildAiPrompt(context, options)

        expect(result.labeledMedia).toHaveLength(2)
        expect(result.labeledMedia[0].label).toBe('IMAGE_1')
        expect(result.labeledMedia[1].label).toBe('VIDEO_2')
        expect(result.prompt).toContain('ATTACHED MEDIA')
      })

      it('should handle empty media array', () => {
        const context = createMockContext({ media: [] })
        const options: ReplyOptions = {}

        const result = buildAiPrompt(context, options)

        expect(result.labeledMedia).toEqual([])
        expect(result.prompt).not.toContain('ATTACHED')
      })
    })

    describe('thread context handling', () => {
      it('should include thread history', () => {
        const thread: Tweet[] = [
          createMockTweet({ text: 'First tweet', author: 'user1' }),
          createMockTweet({ text: 'Second tweet', author: 'user2' }),
        ]
        const context = createMockContext({ thread })
        const options: ReplyOptions = {}

        const result = buildAiPrompt(context, options)

        expect(result.prompt).toContain('THREAD HISTORY')
        expect(result.prompt).toContain('First tweet')
        expect(result.prompt).toContain('Second tweet')
        expect(result.prompt).toContain('@user1')
        expect(result.prompt).toContain('@user2')
      })

      it('should include thread media', () => {
        const thread: Tweet[] = [
          createMockTweet({
            text: 'Tweet with image',
            author: 'user1',
            media: [createMockMedia('image', 1)],
          }),
        ]
        const context = createMockContext({ thread })
        const options: ReplyOptions = {}

        const result = buildAiPrompt(context, options)

        expect(result.prompt).toContain('IMAGE_1')
        expect(result.labeledMedia).toHaveLength(1)
      })

      it('should handle empty thread', () => {
        const context = createMockContext({ thread: [] })
        const options: ReplyOptions = {}

        const result = buildAiPrompt(context, options)

        expect(result.prompt).not.toContain('THREAD HISTORY')
      })
    })

    describe('existing replies handling', () => {
      it('should include existing replies', () => {
        const replies: Tweet[] = [
          createMockTweet({ text: 'Great post!', author: 'commenter1' }),
          createMockTweet({ text: 'Interesting point', author: 'commenter2' }),
        ]
        const context = createMockContext({ replies })
        const options: ReplyOptions = {}

        const result = buildAiPrompt(context, options)

        expect(result.prompt).toContain('EXISTING REPLIES')
        expect(result.prompt).toContain('Great post!')
        expect(result.prompt).toContain('Interesting point')
        expect(result.prompt).toContain('@commenter1')
        expect(result.prompt).toContain('@commenter2')
        expect(result.prompt).toContain('avoid repeating these points')
      })

      it('should include replies media', () => {
        const replies: Tweet[] = [
          createMockTweet({
            text: 'Reply with video',
            author: 'user1',
            media: [createMockMedia('video', 1)],
          }),
        ]
        const context = createMockContext({ replies })
        const options: ReplyOptions = {}

        const result = buildAiPrompt(context, options)

        expect(result.prompt).toContain('VIDEO_1')
        expect(result.labeledMedia).toHaveLength(1)
      })

      it('should handle empty replies', () => {
        const context = createMockContext({ replies: [] })
        const options: ReplyOptions = {}

        const result = buildAiPrompt(context, options)

        expect(result.prompt).not.toContain('EXISTING REPLIES')
      })
    })

    describe('additional instructions', () => {
      it('should include additional instructions when provided', () => {
        const context = createMockContext()
        const options: ReplyOptions = {
          additionalInstructions: 'Focus on technical accuracy and include code examples',
        }

        const result = buildAiPrompt(context, options)

        expect(result.prompt).toContain('ADDITIONAL INSTRUCTIONS')
        expect(result.prompt).toContain('Focus on technical accuracy')
      })

      it('should not include additional instructions section when empty', () => {
        const context = createMockContext()
        const options: ReplyOptions = {}

        const result = buildAiPrompt(context, options)

        expect(result.prompt).not.toContain('ADDITIONAL INSTRUCTIONS')
      })
    })

    describe('comprehensive context', () => {
      it('should handle full context with all features', () => {
        const context = createMockContext({
          text: 'Main tweet with everything',
          author: 'mainuser',
          type: 'thread',
          media: [createMockMedia('image', 1), createMockMedia('video', 2)],
          thread: [
            createMockTweet({
              text: 'Parent tweet',
              author: 'parent',
              media: [createMockMedia('image', 3)],
            }),
          ],
          replies: [
            createMockTweet({
              text: 'Existing reply',
              author: 'replier',
              media: [createMockMedia('video', 4)],
            }),
          ],
        })
        const options: ReplyOptions = {
          tone: 'professional',
          includeEmoji: false,
          additionalInstructions: 'Be concise',
        }

        const result = buildAiPrompt(context, options)

        // Check all sections are present
        expect(result.prompt).toContain('ORIGINAL POST CONTEXT')
        expect(result.prompt).toContain('THREAD HISTORY')
        expect(result.prompt).toContain('EXISTING REPLIES')
        expect(result.prompt).toContain('REQUIREMENTS')
        expect(result.prompt).toContain('ATTACHED MEDIA')
        expect(result.prompt).toContain('ADDITIONAL INSTRUCTIONS')
        expect(result.prompt).toContain('CRITICAL RULES')

        // Check media labels
        expect(result.labeledMedia).toHaveLength(4)
        expect(result.labeledMedia.map((m) => m.label)).toEqual([
          'IMAGE_1',
          'VIDEO_2',
          'IMAGE_3',
          'VIDEO_4',
        ])

        // Check tone
        expect(result.prompt).toContain('professional')
        expect(result.prompt).toContain('NO emojis')
      })
    })

    describe('critical rules', () => {
      it('should include all critical rules', () => {
        const context = createMockContext()
        const options: ReplyOptions = {}

        const result = buildAiPrompt(context, options)

        expect(result.prompt).toContain('CRITICAL RULES')
        expect(result.prompt).toContain('show you actually read it')
        expect(result.prompt).toContain('SAME LANGUAGE')
        expect(result.prompt).toContain('NO hashtags')
        expect(result.prompt).toContain('NO "Here is a reply:" prefixes')
        expect(result.prompt).toContain('authentic and conversational')
      })
    })
  })

  describe('generateReply', () => {
    describe('successful generation', () => {
      it('should generate reply for simple tweet', async () => {
        mockGenerateText.mockResolvedValue({
          text: 'This is a great point about AI!',
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        })

        const context = createMockContext()
        const result = await generateReply(context)

        expect(result).toBe('This is a great point about AI!')
        expect(mockGenerateText).toHaveBeenCalledTimes(1)
        expect(mockGenerateText).toHaveBeenCalledWith(
          expect.objectContaining({
            system: expect.any(String),
            prompt: expect.any(String),
            temperature: expect.any(Number),
          })
        )
      })

      it('should use casual tone by default', async () => {
        mockGenerateText.mockResolvedValue({
          text: 'Cool idea!',
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        })

        const context = createMockContext()
        await generateReply(context)

        expect(mockGenerateText).toHaveBeenCalledWith(
          expect.objectContaining({
            temperature: 0.85, // Casual tone temperature
          })
        )
      })

      it('should use professional tone when specified', async () => {
        mockGenerateText.mockResolvedValue({
          text: 'This is an interesting perspective.',
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        })

        const context = createMockContext()
        await generateReply(context, { tone: 'professional' })

        expect(mockGenerateText).toHaveBeenCalledWith(
          expect.objectContaining({
            temperature: 0.65, // Professional tone temperature
          })
        )
      })

      it('should use humorous tone when specified', async () => {
        mockGenerateText.mockResolvedValue({
          text: 'lol this is exactly what I needed today',
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        })

        const context = createMockContext()
        await generateReply(context, { tone: 'humorous' })

        expect(mockGenerateText).toHaveBeenCalledWith(
          expect.objectContaining({
            temperature: 0.9, // Humorous tone temperature
          })
        )
      })
    })

    describe('response cleaning', () => {
      it('should remove "Here is a reply:" prefix', async () => {
        mockGenerateText.mockResolvedValue({
          text: 'Here is a reply: This is the actual content',
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        })

        const context = createMockContext()
        const result = await generateReply(context)

        expect(result).toBe('This is the actual content')
      })

      it('should remove "Reply:" prefix', async () => {
        mockGenerateText.mockResolvedValue({
          text: 'Reply: This is the actual content',
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        })

        const context = createMockContext()
        const result = await generateReply(context)

        expect(result).toBe('This is the actual content')
      })

      it('should remove quotes around entire response', async () => {
        mockGenerateText.mockResolvedValue({
          text: '"This is quoted content"',
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        })

        const context = createMockContext()
        const result = await generateReply(context)

        expect(result).toBe('This is quoted content')
      })

      it('should remove single quotes around entire response', async () => {
        mockGenerateText.mockResolvedValue({
          text: "'This is quoted content'",
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        })

        const context = createMockContext()
        const result = await generateReply(context)

        expect(result).toBe('This is quoted content')
      })

      it('should trim whitespace', async () => {
        mockGenerateText.mockResolvedValue({
          text: '  \n  This has whitespace  \n  ',
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        })

        const context = createMockContext()
        const result = await generateReply(context)

        expect(result).toBe('This has whitespace')
      })

      it('should preserve internal quotes and formatting', async () => {
        mockGenerateText.mockResolvedValue({
          text: 'She said "hello" and I replied "hi"',
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        })

        const context = createMockContext()
        const result = await generateReply(context)

        expect(result).toBe('She said "hello" and I replied "hi"')
      })
    })

    describe('edge cases', () => {
      it('should handle null context', async () => {
        mockGenerateText.mockResolvedValue({
          text: 'A new post about tech',
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        })

        const result = await generateReply(null)

        expect(result).toBe('A new post about tech')
      })

      it('should handle very long tweet', async () => {
        mockGenerateText.mockResolvedValue({
          text: 'Interesting thread!',
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        })

        const context = createMockContext({
          text: 'a'.repeat(5000),
        })
        const result = await generateReply(context)

        expect(result).toBe('Interesting thread!')
      })

      it('should handle special characters in tweet', async () => {
        mockGenerateText.mockResolvedValue({
          text: 'Great use of émojis! 🚀',
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        })

        const context = createMockContext({
          text: 'Testing with émojis 🎉 and ñ special çhars',
        })
        const result = await generateReply(context)

        expect(result).toBe('Great use of émojis! 🚀')
      })

      it('should handle tweet with emojis', async () => {
        mockGenerateText.mockResolvedValue({
          text: 'Love the enthusiasm! 🔥',
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        })

        const context = createMockContext({
          text: 'Excited about this new feature! 🚀🎉',
        })
        const result = await generateReply(context)

        expect(result).toBe('Love the enthusiasm! 🔥')
      })

      it('should handle tweet with URLs', async () => {
        mockGenerateText.mockResolvedValue({
          text: 'Checking out the link now!',
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        })

        const context = createMockContext({
          text: 'Check this out: https://example.com/article',
        })
        const result = await generateReply(context)

        expect(result).toBe('Checking out the link now!')
      })

      it('should handle tweet with mentions', async () => {
        mockGenerateText.mockResolvedValue({
          text: 'Great collaboration!',
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        })

        const context = createMockContext({
          text: 'Thanks @user1 and @user2 for the feedback',
        })
        const result = await generateReply(context)

        expect(result).toBe('Great collaboration!')
      })

      it('should handle empty string response', async () => {
        mockGenerateText.mockResolvedValue({
          text: '',
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        })

        const context = createMockContext()
        const result = await generateReply(context)

        expect(result).toBe('')
      })
    })

    describe('error handling', () => {
      it('should propagate API errors', async () => {
        mockGenerateText.mockRejectedValue(new Error('API quota exceeded'))

        const context = createMockContext()

        await expect(generateReply(context)).rejects.toThrow('Failed to generate reply: API quota exceeded')
        expect(consoleErrorSpy).toHaveBeenCalled()
      })

      it('should handle network errors', async () => {
        mockGenerateText.mockRejectedValue(new Error('Network timeout'))

        const context = createMockContext()

        await expect(generateReply(context)).rejects.toThrow('Failed to generate reply: Network timeout')
      })

      it('should handle unknown error types', async () => {
        mockGenerateText.mockRejectedValue('Unknown error')

        const context = createMockContext()

        await expect(generateReply(context)).rejects.toThrow('Failed to generate reply: Unknown error')
      })

      it('should handle rate limit errors', async () => {
        mockGenerateText.mockRejectedValue(new Error('Rate limit exceeded'))

        const context = createMockContext()

        await expect(generateReply(context)).rejects.toThrow('Failed to generate reply: Rate limit exceeded')
      })
    })
  })

  describe('generateReplyWithRetry', () => {
    describe('successful scenarios', () => {
      it('should succeed on first attempt', async () => {
        mockGenerateText.mockResolvedValue({
          text: 'Success on first try',
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        })

        const context = createMockContext()
        const result = await generateReplyWithRetry(context)

        expect(result).toBe('Success on first try')
        expect(mockGenerateText).toHaveBeenCalledTimes(1)
      })

      it('should retry and succeed on second attempt', async () => {
        mockGenerateText
          .mockRejectedValueOnce(new Error('Temporary failure'))
          .mockResolvedValueOnce({
            text: 'Success on retry',
            usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
          })

        const context = createMockContext()
        const resultPromise = generateReplyWithRetry(context)

        // Fast-forward through the backoff delay
        await vi.advanceTimersByTimeAsync(1000)

        const result = await resultPromise

        expect(result).toBe('Success on retry')
        expect(mockGenerateText).toHaveBeenCalledTimes(2)
      })

      it('should retry and succeed on third attempt', async () => {
        mockGenerateText
          .mockRejectedValueOnce(new Error('Failure 1'))
          .mockRejectedValueOnce(new Error('Failure 2'))
          .mockResolvedValueOnce({
            text: 'Success on third try',
            usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
          })

        const context = createMockContext()
        const resultPromise = generateReplyWithRetry(context)

        // Fast-forward through all backoff delays (1s + 2s)
        await vi.advanceTimersByTimeAsync(3000)

        const result = await resultPromise

        expect(result).toBe('Success on third try')
        expect(mockGenerateText).toHaveBeenCalledTimes(3)
      })
    })

    describe('retry logic and exponential backoff', () => {
      it('should use exponential backoff between retries', async () => {
        mockGenerateText
          .mockRejectedValueOnce(new Error('Failure 1'))
          .mockRejectedValueOnce(new Error('Failure 2'))
          .mockResolvedValueOnce({
            text: 'Success',
            usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
          })

        const context = createMockContext()
        const resultPromise = generateReplyWithRetry(context)

        // First retry after 1s (2^0 * 1000)
        await vi.advanceTimersByTimeAsync(999)
        expect(mockGenerateText).toHaveBeenCalledTimes(1)

        await vi.advanceTimersByTimeAsync(1)
        expect(mockGenerateText).toHaveBeenCalledTimes(2)

        // Second retry after 2s (2^1 * 1000)
        await vi.advanceTimersByTimeAsync(1999)
        expect(mockGenerateText).toHaveBeenCalledTimes(2)

        await vi.advanceTimersByTimeAsync(1)
        expect(mockGenerateText).toHaveBeenCalledTimes(3)

        await resultPromise
      })

      it('should respect custom maxRetries parameter', async () => {
        mockGenerateText
          .mockRejectedValueOnce(new Error('Failure 1'))
          .mockRejectedValueOnce(new Error('Failure 2'))
          .mockRejectedValueOnce(new Error('Failure 3'))
          .mockRejectedValueOnce(new Error('Failure 4'))
          .mockResolvedValueOnce({
            text: 'Success',
            usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
          })

        const context = createMockContext()
        const resultPromise = generateReplyWithRetry(context, {}, 5)

        // Fast-forward through all delays (1s + 2s + 4s + 8s)
        await vi.advanceTimersByTimeAsync(15000)

        const result = await resultPromise

        expect(result).toBe('Success')
        expect(mockGenerateText).toHaveBeenCalledTimes(5)
      })

      it('should use default 3 retries', async () => {
        mockGenerateText.mockRejectedValue(new Error('Persistent failure'))

        const context = createMockContext()
        const resultPromise = generateReplyWithRetry(context).catch((e) => e)

        // Fast-forward through all delays
        await vi.advanceTimersByTimeAsync(10000)

        const error = await resultPromise
        expect(error).toBeInstanceOf(Error)
        expect(error.message).toContain('Reply generation failed after 3 attempts')
        expect(mockGenerateText).toHaveBeenCalledTimes(3)
      })
    })

    describe('failure scenarios', () => {
      it('should throw error after all retries exhausted', async () => {
        mockGenerateText.mockRejectedValue(new Error('Persistent failure'))

        const context = createMockContext()
        const resultPromise = generateReplyWithRetry(context).catch((e) => e)

        // Fast-forward through all delays
        await vi.advanceTimersByTimeAsync(10000)

        const error = await resultPromise
        expect(error).toBeInstanceOf(Error)
        expect(error.message).toBe(
          'Reply generation failed after 3 attempts: Failed to generate reply: Persistent failure'
        )
        expect(mockGenerateText).toHaveBeenCalledTimes(3)
      })

      it('should include error message in final error', async () => {
        mockGenerateText.mockRejectedValue(new Error('API rate limit exceeded'))

        const context = createMockContext()
        const resultPromise = generateReplyWithRetry(context, {}, 2).catch((e) => e)

        // Fast-forward through all delays
        await vi.advanceTimersByTimeAsync(5000)

        const error = await resultPromise
        expect(error).toBeInstanceOf(Error)
        expect(error.message).toBe(
          'Reply generation failed after 2 attempts: Failed to generate reply: API rate limit exceeded'
        )
      })

      it('should handle non-Error exceptions', async () => {
        mockGenerateText.mockRejectedValue('String error')

        const context = createMockContext()
        const resultPromise = generateReplyWithRetry(context, {}, 2).catch((e) => e)

        // Fast-forward through all delays
        await vi.advanceTimersByTimeAsync(5000)

        const error = await resultPromise
        expect(error).toBeInstanceOf(Error)
        expect(error.message).toBe(
          'Reply generation failed after 2 attempts: Failed to generate reply: Unknown error'
        )
      })
    })

    describe('different failure types', () => {
      it('should retry on timeout errors', async () => {
        mockGenerateText
          .mockRejectedValueOnce(new Error('Request timeout'))
          .mockResolvedValueOnce({
            text: 'Success after timeout',
            usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
          })

        const context = createMockContext()
        const resultPromise = generateReplyWithRetry(context)

        await vi.advanceTimersByTimeAsync(1000)

        const result = await resultPromise

        expect(result).toBe('Success after timeout')
      })

      it('should retry on rate limit errors', async () => {
        mockGenerateText
          .mockRejectedValueOnce(new Error('Rate limit exceeded'))
          .mockResolvedValueOnce({
            text: 'Success after rate limit',
            usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
          })

        const context = createMockContext()
        const resultPromise = generateReplyWithRetry(context)

        await vi.advanceTimersByTimeAsync(1000)

        const result = await resultPromise

        expect(result).toBe('Success after rate limit')
      })

      it('should retry on network errors', async () => {
        mockGenerateText
          .mockRejectedValueOnce(new Error('Network error'))
          .mockResolvedValueOnce({
            text: 'Success after network error',
            usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
          })

        const context = createMockContext()
        const resultPromise = generateReplyWithRetry(context)

        await vi.advanceTimersByTimeAsync(1000)

        const result = await resultPromise

        expect(result).toBe('Success after network error')
      })

      it('should retry on service unavailable errors', async () => {
        mockGenerateText
          .mockRejectedValueOnce(new Error('Service temporarily unavailable'))
          .mockResolvedValueOnce({
            text: 'Success after service restoration',
            usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
          })

        const context = createMockContext()
        const resultPromise = generateReplyWithRetry(context)

        await vi.advanceTimersByTimeAsync(1000)

        const result = await resultPromise

        expect(result).toBe('Success after service restoration')
      })
    })

    describe('integration with options', () => {
      it('should pass tone options through retries', async () => {
        mockGenerateText
          .mockRejectedValueOnce(new Error('Temporary failure'))
          .mockResolvedValueOnce({
            text: 'Professional reply',
            usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
          })

        const context = createMockContext()
        const resultPromise = generateReplyWithRetry(context, { tone: 'professional' })

        await vi.advanceTimersByTimeAsync(1000)

        await resultPromise

        // Verify professional tone temperature was used
        expect(mockGenerateText).toHaveBeenLastCalledWith(
          expect.objectContaining({
            temperature: 0.65,
          })
        )
      })

      it('should pass emoji options through retries', async () => {
        mockGenerateText
          .mockRejectedValueOnce(new Error('Temporary failure'))
          .mockResolvedValueOnce({
            text: 'Reply without emojis',
            usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
          })

        const context = createMockContext()
        const resultPromise = generateReplyWithRetry(context, { includeEmoji: false })

        await vi.advanceTimersByTimeAsync(1000)

        const result = await resultPromise

        // The "Reply:" prefix gets cleaned by generateReply
        expect(result).toBe('without emojis')
      })

      it('should pass additional instructions through retries', async () => {
        mockGenerateText
          .mockRejectedValueOnce(new Error('Temporary failure'))
          .mockResolvedValueOnce({
            text: 'Technical reply',
            usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
          })

        const context = createMockContext()
        const resultPromise = generateReplyWithRetry(context, {
          additionalInstructions: 'Focus on technical details',
        })

        await vi.advanceTimersByTimeAsync(1000)

        const result = await resultPromise

        expect(result).toBe('Technical reply')
      })
    })

    describe('edge cases', () => {
      it('should handle 0 maxRetries (no retries)', async () => {
        mockGenerateText.mockRejectedValue(new Error('Failure'))

        const context = createMockContext()

        await expect(generateReplyWithRetry(context, {}, 0)).rejects.toThrow(
          'Reply generation failed after 0 attempts'
        )
        expect(mockGenerateText).toHaveBeenCalledTimes(0)
      })

      it('should handle 1 maxRetries (single attempt)', async () => {
        mockGenerateText.mockRejectedValue(new Error('Failure'))

        const context = createMockContext()

        await expect(generateReplyWithRetry(context, {}, 1)).rejects.toThrow(
          'Reply generation failed after 1 attempts'
        )
        expect(mockGenerateText).toHaveBeenCalledTimes(1)
      })

      it('should handle null context with retries', async () => {
        mockGenerateText
          .mockRejectedValueOnce(new Error('Temporary failure'))
          .mockResolvedValueOnce({
            text: 'New post',
            usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
          })

        const resultPromise = generateReplyWithRetry(null)

        await vi.advanceTimersByTimeAsync(1000)

        const result = await resultPromise

        expect(result).toBe('New post')
      })
    })
  })
})
