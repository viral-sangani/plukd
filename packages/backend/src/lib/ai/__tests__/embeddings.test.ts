/**
 * Comprehensive tests for Embeddings Module
 *
 * Tests the Google text-embedding-004 embedding generation:
 * - generateBookmarkEmbedding: Combines title, blurb, summary, key takeaways
 * - generateQueryEmbedding: Generates query embeddings
 * - Dimension validation: Ensures 768-dimensional vectors
 * - Error handling: API failures, network errors, invalid inputs
 * - Edge cases: Empty text, very long text, special characters
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { KeyTakeaway } from '@plukd/shared'

// Use vi.hoisted to define mocks before vi.mock hoisting
const { mockEmbed } = vi.hoisted(() => {
  return {
    mockEmbed: vi.fn(),
  }
})

vi.mock('ai', () => {
  return {
    embed: mockEmbed,
  }
})

vi.mock('@ai-sdk/google', () => ({
  google: {
    textEmbeddingModel: vi.fn(() => 'mocked-embedding-model'),
  },
}))

// Now import the functions to test
import {
  generateBookmarkEmbedding,
  generateQueryEmbedding,
  formatEmbeddingForPostgres,
  EmbeddingDimensionError,
  EXPECTED_EMBEDDING_DIMENSION,
} from '../embeddings'

// Helper to create a valid 768-dimensional embedding
function createMockEmbedding(dimension: number = EXPECTED_EMBEDDING_DIMENSION): number[] {
  return Array.from({ length: dimension }, () => Math.random())
}

// Helper to create mock key takeaways
function createMockKeyTakeaways(count: number = 3): KeyTakeaway[] {
  return Array.from({ length: count }, (_, i) => ({
    text: `Key takeaway ${i + 1}`,
    type: ['action', 'idea', 'reminder'][i % 3] as 'action' | 'idea' | 'reminder',
  }))
}

describe('Embeddings Module', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('generateBookmarkEmbedding', () => {
    it('should generate embedding from title, blurb, summary, and key takeaways', async () => {
      const mockEmbedding = createMockEmbedding()
      mockEmbed.mockResolvedValue({ embedding: mockEmbedding })

      const result = await generateBookmarkEmbedding(
        'Test Article Title',
        'This is a short blurb summarizing the content.',
        'This is a longer, detailed summary with more information.',
        createMockKeyTakeaways()
      )

      expect(result).toEqual(mockEmbedding)
      expect(result.length).toBe(EXPECTED_EMBEDDING_DIMENSION)
      expect(mockEmbed).toHaveBeenCalledTimes(1)
      expect(mockEmbed).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'mocked-embedding-model',
          value: expect.stringContaining('Title: Test Article Title'),
        })
      )
    })

    it('should include title with "Title:" prefix', async () => {
      const mockEmbedding = createMockEmbedding()
      mockEmbed.mockResolvedValue({ embedding: mockEmbedding })

      await generateBookmarkEmbedding(
        'Important Title',
        'Blurb',
        'Summary',
        null
      )

      expect(mockEmbed).toHaveBeenCalledWith(
        expect.objectContaining({
          value: expect.stringContaining('Title: Important Title'),
        })
      )
    })

    it('should include blurb with "Summary:" prefix', async () => {
      const mockEmbedding = createMockEmbedding()
      mockEmbed.mockResolvedValue({ embedding: mockEmbedding })

      await generateBookmarkEmbedding(
        'Title',
        'This is the blurb text',
        'Summary',
        null
      )

      expect(mockEmbed).toHaveBeenCalledWith(
        expect.objectContaining({
          value: expect.stringContaining('Summary: This is the blurb text'),
        })
      )
    })

    it('should include key takeaways with "Key points:" prefix', async () => {
      const mockEmbedding = createMockEmbedding()
      mockEmbed.mockResolvedValue({ embedding: mockEmbedding })

      const keyTakeaways: KeyTakeaway[] = [
        { text: 'First point', type: 'action' },
        { text: 'Second point', type: 'idea' },
      ]

      await generateBookmarkEmbedding(
        'Title',
        'Blurb',
        'Summary',
        keyTakeaways
      )

      expect(mockEmbed).toHaveBeenCalledWith(
        expect.objectContaining({
          value: expect.stringContaining('Key points: First point; Second point'),
        })
      )
    })

    it('should include summary with "Details:" prefix', async () => {
      const mockEmbedding = createMockEmbedding()
      mockEmbed.mockResolvedValue({ embedding: mockEmbedding })

      await generateBookmarkEmbedding(
        'Title',
        'Blurb',
        'This is the detailed summary content',
        null
      )

      expect(mockEmbed).toHaveBeenCalledWith(
        expect.objectContaining({
          value: expect.stringContaining('Details: This is the detailed summary content'),
        })
      )
    })

    it('should separate sections with double newlines', async () => {
      const mockEmbedding = createMockEmbedding()
      mockEmbed.mockResolvedValue({ embedding: mockEmbedding })

      await generateBookmarkEmbedding(
        'Title',
        'Blurb',
        'Summary',
        null
      )

      const callValue = mockEmbed.mock.calls[0][0].value
      expect(callValue).toContain('\n\n')
    })

    it('should handle empty title', async () => {
      const mockEmbedding = createMockEmbedding()
      mockEmbed.mockResolvedValue({ embedding: mockEmbedding })

      const result = await generateBookmarkEmbedding(
        '',
        'Blurb',
        'Summary',
        null
      )

      expect(result).toEqual(mockEmbedding)
      const callValue = mockEmbed.mock.calls[0][0].value
      expect(callValue).not.toContain('Title:')
    })

    it('should handle empty blurb', async () => {
      const mockEmbedding = createMockEmbedding()
      mockEmbed.mockResolvedValue({ embedding: mockEmbedding })

      const result = await generateBookmarkEmbedding(
        'Title',
        '',
        'Summary',
        null
      )

      expect(result).toEqual(mockEmbedding)
      const callValue = mockEmbed.mock.calls[0][0].value
      expect(callValue).not.toContain('Summary:')
    })

    it('should handle empty summary', async () => {
      const mockEmbedding = createMockEmbedding()
      mockEmbed.mockResolvedValue({ embedding: mockEmbedding })

      const result = await generateBookmarkEmbedding(
        'Title',
        'Blurb',
        '',
        null
      )

      expect(result).toEqual(mockEmbedding)
      const callValue = mockEmbed.mock.calls[0][0].value
      expect(callValue).not.toContain('Details:')
    })

    it('should handle null key takeaways', async () => {
      const mockEmbedding = createMockEmbedding()
      mockEmbed.mockResolvedValue({ embedding: mockEmbedding })

      const result = await generateBookmarkEmbedding(
        'Title',
        'Blurb',
        'Summary',
        null
      )

      expect(result).toEqual(mockEmbedding)
      const callValue = mockEmbed.mock.calls[0][0].value
      expect(callValue).not.toContain('Key points:')
    })

    it('should handle empty key takeaways array', async () => {
      const mockEmbedding = createMockEmbedding()
      mockEmbed.mockResolvedValue({ embedding: mockEmbedding })

      const result = await generateBookmarkEmbedding(
        'Title',
        'Blurb',
        'Summary',
        []
      )

      expect(result).toEqual(mockEmbedding)
      const callValue = mockEmbed.mock.calls[0][0].value
      expect(callValue).not.toContain('Key points:')
    })

    it('should truncate text longer than 8000 characters', async () => {
      const mockEmbedding = createMockEmbedding()
      mockEmbed.mockResolvedValue({ embedding: mockEmbedding })

      const longText = 'a'.repeat(10000)
      await generateBookmarkEmbedding(
        longText,
        longText,
        longText,
        null
      )

      const callValue = mockEmbed.mock.calls[0][0].value
      expect(callValue.length).toBeLessThanOrEqual(8000)
    })

    it('should handle text with special characters', async () => {
      const mockEmbedding = createMockEmbedding()
      mockEmbed.mockResolvedValue({ embedding: mockEmbedding })

      const result = await generateBookmarkEmbedding(
        'Title with émojis 🚀 and ñ special çhars',
        'Blurb with symbols: @#$%^&*()',
        'Summary with unicode: ∑∏∆∫',
        [{ text: 'Takeaway with 中文', type: 'action' }]
      )

      expect(result).toEqual(mockEmbedding)
      expect(result.length).toBe(EXPECTED_EMBEDDING_DIMENSION)
    })

    it('should handle very long key takeaways', async () => {
      const mockEmbedding = createMockEmbedding()
      mockEmbed.mockResolvedValue({ embedding: mockEmbedding })

      const manyTakeaways = createMockKeyTakeaways(20)
      const result = await generateBookmarkEmbedding(
        'Title',
        'Blurb',
        'Summary',
        manyTakeaways
      )

      expect(result).toEqual(mockEmbedding)
      const callValue = mockEmbed.mock.calls[0][0].value
      expect(callValue).toContain('Key points:')
    })

    it('should validate embedding dimension is 768', async () => {
      const mockEmbedding = createMockEmbedding(768)
      mockEmbed.mockResolvedValue({ embedding: mockEmbedding })

      const result = await generateBookmarkEmbedding(
        'Title',
        'Blurb',
        'Summary',
        null
      )

      expect(result.length).toBe(768)
    })

    it('should throw EmbeddingDimensionError when dimension is incorrect', async () => {
      const invalidEmbedding = createMockEmbedding(512) // Wrong dimension
      mockEmbed.mockResolvedValue({ embedding: invalidEmbedding })

      await expect(
        generateBookmarkEmbedding('Title', 'Blurb', 'Summary', null)
      ).rejects.toThrow(EmbeddingDimensionError)

      await expect(
        generateBookmarkEmbedding('Title', 'Blurb', 'Summary', null)
      ).rejects.toThrow('Invalid embedding dimension: expected 768, got 512')
    })

    it('should propagate API errors', async () => {
      mockEmbed.mockRejectedValue(new Error('API quota exceeded'))

      await expect(
        generateBookmarkEmbedding('Title', 'Blurb', 'Summary', null)
      ).rejects.toThrow('API quota exceeded')
    })

    it('should propagate network errors', async () => {
      mockEmbed.mockRejectedValue(new Error('Network timeout'))

      await expect(
        generateBookmarkEmbedding('Title', 'Blurb', 'Summary', null)
      ).rejects.toThrow('Network timeout')
    })

    it('should handle service unavailable errors', async () => {
      mockEmbed.mockRejectedValue(new Error('Service unavailable'))

      await expect(
        generateBookmarkEmbedding('Title', 'Blurb', 'Summary', null)
      ).rejects.toThrow('Service unavailable')
    })
  })

  describe('generateQueryEmbedding', () => {
    it('should generate embedding from query text', async () => {
      const mockEmbedding = createMockEmbedding()
      mockEmbed.mockResolvedValue({ embedding: mockEmbedding })

      const result = await generateQueryEmbedding('search query')

      expect(result).toEqual(mockEmbedding)
      expect(result.length).toBe(EXPECTED_EMBEDDING_DIMENSION)
      expect(mockEmbed).toHaveBeenCalledTimes(1)
      expect(mockEmbed).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'mocked-embedding-model',
          value: 'search query',
        })
      )
    })

    it('should handle empty query', async () => {
      const mockEmbedding = createMockEmbedding()
      mockEmbed.mockResolvedValue({ embedding: mockEmbedding })

      const result = await generateQueryEmbedding('')

      expect(result).toEqual(mockEmbedding)
      expect(mockEmbed).toHaveBeenCalledWith(
        expect.objectContaining({
          value: '',
        })
      )
    })

    it('should handle very short query', async () => {
      const mockEmbedding = createMockEmbedding()
      mockEmbed.mockResolvedValue({ embedding: mockEmbedding })

      const result = await generateQueryEmbedding('ai')

      expect(result).toEqual(mockEmbedding)
      expect(mockEmbed).toHaveBeenCalledWith(
        expect.objectContaining({
          value: 'ai',
        })
      )
    })

    it('should truncate query longer than 8000 characters', async () => {
      const mockEmbedding = createMockEmbedding()
      mockEmbed.mockResolvedValue({ embedding: mockEmbedding })

      const longQuery = 'a'.repeat(10000)
      await generateQueryEmbedding(longQuery)

      const callValue = mockEmbed.mock.calls[0][0].value
      expect(callValue.length).toBe(8000)
    })

    it('should handle query with special characters', async () => {
      const mockEmbedding = createMockEmbedding()
      mockEmbed.mockResolvedValue({ embedding: mockEmbedding })

      const result = await generateQueryEmbedding('query with émojis 🔍 and ñ çhars')

      expect(result).toEqual(mockEmbedding)
    })

    it('should handle query with unicode characters', async () => {
      const mockEmbedding = createMockEmbedding()
      mockEmbed.mockResolvedValue({ embedding: mockEmbedding })

      const result = await generateQueryEmbedding('搜索查询 مع العربية')

      expect(result).toEqual(mockEmbedding)
    })

    it('should validate embedding dimension is 768', async () => {
      const mockEmbedding = createMockEmbedding(768)
      mockEmbed.mockResolvedValue({ embedding: mockEmbedding })

      const result = await generateQueryEmbedding('query')

      expect(result.length).toBe(768)
    })

    it('should throw EmbeddingDimensionError when dimension is incorrect', async () => {
      const invalidEmbedding = createMockEmbedding(1024) // Wrong dimension
      mockEmbed.mockResolvedValue({ embedding: invalidEmbedding })

      await expect(generateQueryEmbedding('query')).rejects.toThrow(EmbeddingDimensionError)

      await expect(generateQueryEmbedding('query')).rejects.toThrow(
        'Invalid embedding dimension: expected 768, got 1024'
      )
    })

    it('should propagate API errors', async () => {
      mockEmbed.mockRejectedValue(new Error('API rate limit exceeded'))

      await expect(generateQueryEmbedding('query')).rejects.toThrow('API rate limit exceeded')
    })

    it('should propagate network errors', async () => {
      mockEmbed.mockRejectedValue(new Error('Connection refused'))

      await expect(generateQueryEmbedding('query')).rejects.toThrow('Connection refused')
    })
  })

  describe('formatEmbeddingForPostgres', () => {
    it('should format embedding as PostgreSQL vector literal', () => {
      const embedding = [0.1, 0.2, 0.3, 0.4, 0.5]
      const result = formatEmbeddingForPostgres(embedding)

      expect(result).toBe('[0.1,0.2,0.3,0.4,0.5]')
    })

    it('should format 768-dimensional embedding', () => {
      const embedding = createMockEmbedding()
      const result = formatEmbeddingForPostgres(embedding)

      expect(result).toMatch(/^\[[\d.,]+\]$/)
      expect(result.split(',').length).toBe(768)
    })

    it('should handle empty embedding array', () => {
      const embedding: number[] = []
      const result = formatEmbeddingForPostgres(embedding)

      expect(result).toBe('[]')
    })

    it('should handle single value embedding', () => {
      const embedding = [0.123456789]
      const result = formatEmbeddingForPostgres(embedding)

      expect(result).toBe('[0.123456789]')
    })

    it('should handle negative values', () => {
      const embedding = [-0.5, -0.3, 0.2, 0.4]
      const result = formatEmbeddingForPostgres(embedding)

      expect(result).toBe('[-0.5,-0.3,0.2,0.4]')
    })

    it('should preserve decimal precision', () => {
      const embedding = [0.123456789123456, 0.987654321987654]
      const result = formatEmbeddingForPostgres(embedding)

      expect(result).toBe('[0.123456789123456,0.987654321987654]')
    })

    it('should handle zero values', () => {
      const embedding = [0, 0, 0, 0]
      const result = formatEmbeddingForPostgres(embedding)

      expect(result).toBe('[0,0,0,0]')
    })

    it('should handle very small values', () => {
      const embedding = [0.0000001, 0.0000002]
      const result = formatEmbeddingForPostgres(embedding)

      // JavaScript uses scientific notation for very small numbers
      expect(result).toBe('[1e-7,2e-7]')
    })

    it('should handle very large values', () => {
      const embedding = [999999.999, 888888.888]
      const result = formatEmbeddingForPostgres(embedding)

      expect(result).toBe('[999999.999,888888.888]')
    })
  })

  describe('EmbeddingDimensionError', () => {
    it('should create error with correct message', () => {
      const error = new EmbeddingDimensionError(512)

      expect(error.message).toBe('Invalid embedding dimension: expected 768, got 512')
      expect(error.name).toBe('EmbeddingDimensionError')
    })

    it('should be instance of Error', () => {
      const error = new EmbeddingDimensionError(1024)

      expect(error).toBeInstanceOf(Error)
    })

    it('should have correct name property', () => {
      const error = new EmbeddingDimensionError(256)

      expect(error.name).toBe('EmbeddingDimensionError')
    })

    it('should include actual dimension in message', () => {
      const error = new EmbeddingDimensionError(384)

      expect(error.message).toContain('384')
    })

    it('should include expected dimension in message', () => {
      const error = new EmbeddingDimensionError(512)

      expect(error.message).toContain('768')
    })
  })

  describe('Integration scenarios', () => {
    it('should handle complete bookmark embedding generation workflow', async () => {
      const mockEmbedding = createMockEmbedding()
      mockEmbed.mockResolvedValue({ embedding: mockEmbedding })

      const embedding = await generateBookmarkEmbedding(
        'AI Advancements in 2025',
        'A comprehensive overview of the latest AI developments and their impact on various industries.',
        'The article explores recent breakthroughs in artificial intelligence, including improvements in large language models, computer vision systems, and autonomous agents. It discusses the implications for healthcare, education, and business automation.',
        [
          { text: 'AI is transforming healthcare diagnostics', type: 'action' },
          { text: 'Education systems are adapting to AI tutors', type: 'idea' },
          { text: 'Consider implementing AI automation in workflows', type: 'reminder' },
        ]
      )

      const formatted = formatEmbeddingForPostgres(embedding)

      expect(embedding.length).toBe(768)
      expect(formatted).toMatch(/^\[[\d.,\-]+\]$/)
    })

    it('should handle query embedding generation workflow', async () => {
      const mockEmbedding = createMockEmbedding()
      mockEmbed.mockResolvedValue({ embedding: mockEmbedding })

      const embedding = await generateQueryEmbedding('artificial intelligence machine learning')
      const formatted = formatEmbeddingForPostgres(embedding)

      expect(embedding.length).toBe(768)
      expect(formatted).toMatch(/^\[[\d.,\-]+\]$/)
    })

    it('should handle minimal bookmark content', async () => {
      const mockEmbedding = createMockEmbedding()
      mockEmbed.mockResolvedValue({ embedding: mockEmbedding })

      const embedding = await generateBookmarkEmbedding(
        'Short',
        'Brief',
        'Quick',
        null
      )

      expect(embedding.length).toBe(768)
    })

    it('should maintain embedding consistency for same input', async () => {
      const mockEmbedding1 = createMockEmbedding()
      const mockEmbedding2 = [...mockEmbedding1] // Same values

      mockEmbed
        .mockResolvedValueOnce({ embedding: mockEmbedding1 })
        .mockResolvedValueOnce({ embedding: mockEmbedding2 })

      const embedding1 = await generateBookmarkEmbedding('Title', 'Blurb', 'Summary', null)
      const embedding2 = await generateBookmarkEmbedding('Title', 'Blurb', 'Summary', null)

      expect(embedding1).toEqual(embedding2)
    })
  })
})
