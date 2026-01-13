/**
 * Comprehensive tests for AI Processing Pipeline
 *
 * Tests the three-pass AI processing system:
 * - Pass 1: Classification (Gemini Flash) - category, tags, contentType
 * - Pass 2: Summarization (Gemini Pro) - blurb, summary, keyTakeaways
 * - Pass 3: List Extraction (Gemini Pro, conditional) - extractedResources
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ExtractedContent } from '@plukd/shared'
import type { ClassificationResult, SummarizationResult } from '../schemas'
import type { ListIndicators, ListExtractionResult } from '../prompts'

// Use vi.hoisted to define mocks before vi.mock hoisting
const { mockGenerateObject } = vi.hoisted(() => {
  return {
    mockGenerateObject: vi.fn(),
  }
})

vi.mock('ai', () => {
  return {
    generateObject: mockGenerateObject,
  }
})

vi.mock('@ai-sdk/google', () => ({
  google: vi.fn(() => ({})),
}))

// Now import the functions to test
import {
  classifyContent,
  summarizeContent,
  extractListItems,
  processContent,
  processContentWithRetry,
  isContentSufficient,
  INSUFFICIENT_CONTENT_MARKER,
  INSUFFICIENT_CONTENT_BLURB,
} from '../process'

// Helper to create mock extracted content
// Content must be at least 100 characters to pass the sufficiency check
function createMockContent(overrides: Partial<ExtractedContent> = {}): ExtractedContent {
  return {
    url: 'https://example.com/article',
    source: 'web',
    title: 'Example Article',
    content: 'This is example content for testing AI processing. It includes multiple sentences with enough detail to pass the minimum content length requirement of 100 characters for AI analysis.',
    author: 'Test Author',
    authorUrl: 'https://example.com/author',
    mediaUrls: [],
    ...overrides,
  }
}

// Helper to create mock classification result
function createMockClassification(overrides: Partial<ClassificationResult> = {}): ClassificationResult {
  return {
    category: 'ai',
    tags: ['tutorial', 'guide'],
    contentType: 'article',
    ...overrides,
  }
}

// Helper to create mock summarization result
function createMockSummarization(overrides: Partial<SummarizationResult> = {}): SummarizationResult {
  return {
    blurb: 'This is a concise 2-3 sentence summary that captures the essence of the content for display in list views.',
    summary: '• **First key point** with important details\n• **Second key point** providing context\n• **Third key point** with actionable insights\n• **Fourth key point** summarizing the conclusion\n• **Fifth key point** wrapping up the content',
    keyTakeaways: [
      { text: 'Try implementing this technique', type: 'action' },
      { text: 'Share this insight with team', type: 'idea' },
      { text: 'Revisit this concept next week', type: 'reminder' },
    ],
    ...overrides,
  }
}

// Helper to create list indicators
function createListIndicators(overrides: Partial<ListIndicators> = {}): ListIndicators {
  return {
    isLikelyList: false,
    estimatedItemCount: 0,
    confidence: 'low',
    patterns: [],
    ...overrides,
  }
}

describe('AI Processing Pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('classifyContent', () => {
    it('should classify text content with category, tags, and contentType', async () => {
      const mockClassification = createMockClassification()
      mockGenerateObject.mockResolvedValue({
        object: mockClassification,
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      })

      const content = createMockContent()
      const result = await classifyContent(content)

      expect(result).toEqual(mockClassification)
      expect(mockGenerateObject).toHaveBeenCalledTimes(1)
      expect(mockGenerateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.any(String),
        })
      )
    })

    it('should handle multimodal content with images', async () => {
      const mockClassification = createMockClassification()
      mockGenerateObject.mockResolvedValue({
        object: mockClassification,
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      })

      const content = createMockContent({
        mediaUrls: ['https://pbs.twimg.com/media/image1.jpg'],
      })
      const result = await classifyContent(content)

      expect(result).toEqual(mockClassification)
      expect(mockGenerateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.arrayContaining([
                expect.objectContaining({ type: 'text' }),
                expect.objectContaining({ type: 'image' }),
              ]),
            }),
          ]),
        })
      )
    })

    it('should classify as AI category', async () => {
      const classification = createMockClassification({ category: 'ai' })
      mockGenerateObject.mockResolvedValue({
        object: classification,
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      })

      const content = createMockContent({
        title: 'Introduction to Machine Learning',
        content: 'Machine learning is a subset of artificial intelligence...',
      })
      const result = await classifyContent(content)

      expect(result.category).toBe('ai')
    })

    it('should classify as blockchain category', async () => {
      const classification = createMockClassification({ category: 'blockchain' })
      mockGenerateObject.mockResolvedValue({
        object: classification,
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      })

      const content = createMockContent({
        title: 'Understanding Smart Contracts',
        content: 'Smart contracts are self-executing contracts on blockchain...',
      })
      const result = await classifyContent(content)

      expect(result.category).toBe('blockchain')
    })

    it('should classify as startups category', async () => {
      const classification = createMockClassification({ category: 'startups' })
      mockGenerateObject.mockResolvedValue({
        object: classification,
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      })

      const content = createMockContent({
        title: 'How to Raise Your Seed Round',
        content: 'Fundraising for early-stage startups requires...',
      })
      const result = await classifyContent(content)

      expect(result.category).toBe('startups')
    })

    it('should classify as design category', async () => {
      const classification = createMockClassification({ category: 'design' })
      mockGenerateObject.mockResolvedValue({
        object: classification,
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      })

      const content = createMockContent({
        title: 'Principles of Modern UI Design',
        content: 'User interface design principles for 2025...',
      })
      const result = await classifyContent(content)

      expect(result.category).toBe('design')
    })

    it('should return tutorial and guide tags', async () => {
      const classification = createMockClassification({ tags: ['tutorial', 'guide'] })
      mockGenerateObject.mockResolvedValue({
        object: classification,
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      })

      const content = createMockContent()
      const result = await classifyContent(content)

      expect(result.tags).toContain('tutorial')
      expect(result.tags).toContain('guide')
    })

    it('should return video and tutorial tags', async () => {
      const classification = createMockClassification({ tags: ['video', 'tutorial'] })
      mockGenerateObject.mockResolvedValue({
        object: classification,
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      })

      const content = createMockContent({ source: 'youtube' })
      const result = await classifyContent(content)

      expect(result.tags).toContain('video')
      expect(result.tags).toContain('tutorial')
    })

    it('should return news and announcement tags', async () => {
      const classification = createMockClassification({ tags: ['news', 'announcement'] })
      mockGenerateObject.mockResolvedValue({
        object: classification,
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      })

      const content = createMockContent({
        title: 'Breaking: New AI Model Released',
      })
      const result = await classifyContent(content)

      expect(result.tags).toContain('news')
      expect(result.tags).toContain('announcement')
    })

    it('should classify as article contentType', async () => {
      const classification = createMockClassification({ contentType: 'article' })
      mockGenerateObject.mockResolvedValue({
        object: classification,
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      })

      const content = createMockContent()
      const result = await classifyContent(content)

      expect(result.contentType).toBe('article')
    })

    it('should classify as thread contentType', async () => {
      const classification = createMockClassification({ contentType: 'thread' })
      mockGenerateObject.mockResolvedValue({
        object: classification,
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      })

      const content = createMockContent({ source: 'twitter' })
      const result = await classifyContent(content)

      expect(result.contentType).toBe('thread')
    })

    it('should classify as video contentType', async () => {
      const classification = createMockClassification({ contentType: 'video' })
      mockGenerateObject.mockResolvedValue({
        object: classification,
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      })

      const content = createMockContent({ source: 'youtube' })
      const result = await classifyContent(content)

      expect(result.contentType).toBe('video')
    })

    it('should classify as discussion contentType', async () => {
      const classification = createMockClassification({ contentType: 'discussion' })
      mockGenerateObject.mockResolvedValue({
        object: classification,
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      })

      const content = createMockContent({ source: 'reddit' })
      const result = await classifyContent(content)

      expect(result.contentType).toBe('discussion')
    })

    it('should classify as list contentType', async () => {
      const classification = createMockClassification({ contentType: 'list' })
      mockGenerateObject.mockResolvedValue({
        object: classification,
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      })

      const content = createMockContent({
        title: 'Top 10 AI Tools for Developers',
        content: '1. Tool One\n2. Tool Two\n3. Tool Three...',
      })
      const result = await classifyContent(content)

      expect(result.contentType).toBe('list')
    })

    it('should handle very short content', async () => {
      const classification = createMockClassification()
      mockGenerateObject.mockResolvedValue({
        object: classification,
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      })

      const content = createMockContent({ content: 'Short.' })
      const result = await classifyContent(content)

      expect(result).toEqual(classification)
    })

    it('should handle very long content', async () => {
      const classification = createMockClassification()
      mockGenerateObject.mockResolvedValue({
        object: classification,
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      })

      const longContent = 'a'.repeat(10000)
      const content = createMockContent({ content: longContent })
      const result = await classifyContent(content)

      expect(result).toEqual(classification)
    })

    it('should handle content with special characters', async () => {
      const classification = createMockClassification()
      mockGenerateObject.mockResolvedValue({
        object: classification,
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      })

      const content = createMockContent({
        content: 'Content with émojis 🚀 and ñ special çhars',
      })
      const result = await classifyContent(content)

      expect(result).toEqual(classification)
    })

    it('should propagate API errors', async () => {
      mockGenerateObject.mockRejectedValue(new Error('API quota exceeded'))

      const content = createMockContent()

      await expect(classifyContent(content)).rejects.toThrow('API quota exceeded')
    })

    it('should use list indicators for adaptive truncation', async () => {
      const classification = createMockClassification({ contentType: 'list' })
      mockGenerateObject.mockResolvedValue({
        object: classification,
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      })

      const listIndicators = createListIndicators({
        isLikelyList: true,
        estimatedItemCount: 10,
        confidence: 'high',
        patterns: ['numbered-items'],
      })

      const content = createMockContent()
      const result = await classifyContent(content, listIndicators)

      expect(result.contentType).toBe('list')
    })
  })

  describe('summarizeContent', () => {
    it('should generate blurb and summary', async () => {
      const mockSummarization = createMockSummarization()
      mockGenerateObject.mockResolvedValue({
        object: mockSummarization,
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      })

      const content = createMockContent()
      const classification = createMockClassification()
      const result = await summarizeContent(content, classification)

      expect(result.blurb).toBe(mockSummarization.blurb)
      expect(result.summary).toBe(mockSummarization.summary)
      expect(result.keyTakeaways).toEqual(mockSummarization.keyTakeaways)
    })

    it('should use classification context in prompt', async () => {
      const mockSummarization = createMockSummarization()
      mockGenerateObject.mockResolvedValue({
        object: mockSummarization,
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      })

      const content = createMockContent()
      const classification = createMockClassification({
        category: 'ai',
        tags: ['tutorial', 'guide'],
        contentType: 'article',
      })
      await summarizeContent(content, classification)

      expect(mockGenerateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('ai'),
        })
      )
    })

    it('should support multimodal content with images', async () => {
      const mockSummarization = createMockSummarization()
      mockGenerateObject.mockResolvedValue({
        object: mockSummarization,
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      })

      const content = createMockContent({
        mediaUrls: ['https://pbs.twimg.com/media/image1.jpg'],
      })
      const classification = createMockClassification()
      await summarizeContent(content, classification)

      expect(mockGenerateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.arrayContaining([
                expect.objectContaining({ type: 'text' }),
                expect.objectContaining({ type: 'image' }),
              ]),
            }),
          ]),
        })
      )
    })

    it('should handle empty content gracefully', async () => {
      const mockSummarization = createMockSummarization()
      mockGenerateObject.mockResolvedValue({
        object: mockSummarization,
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      })

      const content = createMockContent({ content: '' })
      const classification = createMockClassification()
      const result = await summarizeContent(content, classification)

      expect(result).toEqual(mockSummarization)
    })

    it('should handle minimal content', async () => {
      const mockSummarization = createMockSummarization()
      mockGenerateObject.mockResolvedValue({
        object: mockSummarization,
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      })

      const content = createMockContent({ content: 'Minimal.' })
      const classification = createMockClassification()
      const result = await summarizeContent(content, classification)

      expect(result).toEqual(mockSummarization)
    })

    it('should propagate API errors', async () => {
      mockGenerateObject.mockRejectedValue(new Error('Service unavailable'))

      const content = createMockContent()
      const classification = createMockClassification()

      await expect(summarizeContent(content, classification)).rejects.toThrow(
        'Service unavailable'
      )
    })

    it('should generate blurb with 2-3 sentences constraint', async () => {
      const mockSummarization = createMockSummarization({
        blurb: 'First sentence here. Second sentence here. Third sentence here.',
      })
      mockGenerateObject.mockResolvedValue({
        object: mockSummarization,
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      })

      const content = createMockContent()
      const classification = createMockClassification()
      const result = await summarizeContent(content, classification)

      const sentenceCount = result.blurb.split('. ').length
      expect(sentenceCount).toBeGreaterThanOrEqual(2)
      expect(sentenceCount).toBeLessThanOrEqual(3)
    })

    it('should generate detailed summary longer than blurb', async () => {
      const mockSummarization = createMockSummarization()
      mockGenerateObject.mockResolvedValue({
        object: mockSummarization,
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      })

      const content = createMockContent()
      const classification = createMockClassification()
      const result = await summarizeContent(content, classification)

      expect(result.summary.length).toBeGreaterThan(result.blurb.length)
    })

    it('should generate 3-5 key takeaways', async () => {
      const mockSummarization = createMockSummarization()
      mockGenerateObject.mockResolvedValue({
        object: mockSummarization,
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      })

      const content = createMockContent()
      const classification = createMockClassification()
      const result = await summarizeContent(content, classification)

      expect(result.keyTakeaways?.length).toBeGreaterThanOrEqual(3)
      expect(result.keyTakeaways?.length).toBeLessThanOrEqual(5)
    })

    it('should extract resources for list content', async () => {
      const mockSummarization = createMockSummarization({
        extractedResources: [
          { name: 'Tool 1', description: 'A great tool', url: 'https://tool1.com' },
          { name: 'Tool 2', description: 'Another tool', url: 'https://tool2.com' },
        ],
        resourceLayoutHint: 'grid',
      })
      mockGenerateObject.mockResolvedValue({
        object: mockSummarization,
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      })

      const content = createMockContent()
      const classification = createMockClassification({ contentType: 'list' })
      const result = await summarizeContent(content, classification)

      expect(result.extractedResources).toHaveLength(2)
      expect(result.resourceLayoutHint).toBe('grid')
    })

    it('should use list indicators for enhanced extraction', async () => {
      const mockSummarization = createMockSummarization()
      mockGenerateObject.mockResolvedValue({
        object: mockSummarization,
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      })

      const content = createMockContent()
      const classification = createMockClassification({ contentType: 'list' })
      const listIndicators = createListIndicators({
        isLikelyList: true,
        estimatedItemCount: 5,
        confidence: 'high',
      })

      await summarizeContent(content, classification, listIndicators)

      expect(mockGenerateObject).toHaveBeenCalledTimes(1)
    })
  })

  describe('extractListItems', () => {
    it('should extract list items with titles and descriptions', async () => {
      const mockExtraction: ListExtractionResult = {
        totalItemsMentioned: 3,
        extractedResources: [
          { name: 'Item 1', description: 'First item', category: 'tool' },
          { name: 'Item 2', description: 'Second item', category: 'tool' },
          { name: 'Item 3', description: 'Third item', category: 'tool' },
        ],
        resourceLayoutHint: 'grid',
        extractionConfidence: 'complete',
      }
      mockGenerateObject.mockResolvedValue({
        object: mockExtraction,
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      })

      const content = createMockContent()
      const listIndicators = createListIndicators({
        isLikelyList: true,
        estimatedItemCount: 3,
        confidence: 'high',
      })
      const result = await extractListItems(content, listIndicators)

      expect(result.extractedResources).toHaveLength(3)
      expect(result.totalItemsMentioned).toBe(3)
      expect(result.extractionConfidence).toBe('complete')
    })

    it('should return minimal result when no list items found', async () => {
      const mockExtraction: ListExtractionResult = {
        totalItemsMentioned: 0,
        extractedResources: [],
        resourceLayoutHint: 'simple-list',
        extractionConfidence: 'uncertain',
      }
      mockGenerateObject.mockResolvedValue({
        object: mockExtraction,
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      })

      const content = createMockContent()
      const listIndicators = createListIndicators()
      const result = await extractListItems(content, listIndicators)

      expect(result.extractedResources).toHaveLength(0)
    })

    it('should use full content for maximum extraction accuracy', async () => {
      const mockExtraction: ListExtractionResult = {
        totalItemsMentioned: 10,
        extractedResources: Array.from({ length: 10 }, (_, i) => ({
          name: `Item ${i + 1}`,
          description: `Description ${i + 1}`,
        })),
        resourceLayoutHint: 'numbered-steps',
        extractionConfidence: 'complete',
      }
      mockGenerateObject.mockResolvedValue({
        object: mockExtraction,
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      })

      const longContent = 'Item 1: description\n'.repeat(10)
      const content = createMockContent({ content: longContent })
      const listIndicators = createListIndicators({
        isLikelyList: true,
        estimatedItemCount: 10,
        confidence: 'high',
      })
      const result = await extractListItems(content, listIndicators)

      expect(result.extractedResources).toHaveLength(10)
    })

    it('should handle partial extraction confidence', async () => {
      const mockExtraction: ListExtractionResult = {
        totalItemsMentioned: 5,
        extractedResources: [
          { name: 'Item 1', description: 'First' },
          { name: 'Item 2', description: 'Second' },
        ],
        resourceLayoutHint: 'simple-list',
        extractionConfidence: 'partial',
      }
      mockGenerateObject.mockResolvedValue({
        object: mockExtraction,
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      })

      const content = createMockContent()
      const listIndicators = createListIndicators({
        isLikelyList: true,
        estimatedItemCount: 5,
        confidence: 'medium',
      })
      const result = await extractListItems(content, listIndicators)

      expect(result.extractionConfidence).toBe('partial')
      expect(result.extractedResources!.length).toBeLessThan(result.totalItemsMentioned)
    })

    it('should propagate API errors', async () => {
      mockGenerateObject.mockRejectedValue(new Error('Network error'))

      const content = createMockContent()
      const listIndicators = createListIndicators()

      await expect(extractListItems(content, listIndicators)).rejects.toThrow('Network error')
    })
  })

  describe('processContent', () => {
    it('should orchestrate classification and summarization', async () => {
      const mockClassification = createMockClassification()
      const mockSummarization = createMockSummarization()

      mockGenerateObject
        .mockResolvedValueOnce({
          object: mockClassification,
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        })
        .mockResolvedValueOnce({
          object: mockSummarization,
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        })

      const content = createMockContent()
      const result = await processContent(content)

      expect(result.category).toBe(mockClassification.category)
      expect(result.tags).toEqual(mockClassification.tags)
      expect(result.blurb).toBe(mockSummarization.blurb)
      expect(result.summary).toBe(mockSummarization.summary)
      expect(mockGenerateObject).toHaveBeenCalledTimes(2)
    })

    it('should trigger list extraction for list content', async () => {
      const mockClassification = createMockClassification({ contentType: 'list' })
      const mockSummarization = createMockSummarization({
        extractedResources: [
          { name: 'Item 1' },
          { name: 'Item 2' },
        ],
      })
      const mockListExtraction: ListExtractionResult = {
        totalItemsMentioned: 5,
        extractedResources: [
          { name: 'Item 1' },
          { name: 'Item 2' },
          { name: 'Item 3' },
          { name: 'Item 4' },
          { name: 'Item 5' },
        ],
        resourceLayoutHint: 'grid',
        extractionConfidence: 'complete',
      }

      mockGenerateObject
        .mockResolvedValueOnce({
          object: mockClassification,
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        })
        .mockResolvedValueOnce({
          object: mockSummarization,
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        })
        .mockResolvedValueOnce({
          object: mockListExtraction,
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        })

      const content = createMockContent()
      const result = await processContent(content)

      expect(result.contentType).toBe('list')
      expect(mockGenerateObject).toHaveBeenCalledTimes(3) // classification + summarization + list extraction
    })

    it('should use dedicated extraction when it finds more items', async () => {
      const mockClassification = createMockClassification({ contentType: 'list' })
      const mockSummarization = createMockSummarization({
        extractedResources: [{ name: 'Item 1' }, { name: 'Item 2' }],
      })
      const mockListExtraction: ListExtractionResult = {
        totalItemsMentioned: 5,
        extractedResources: [
          { name: 'Item 1' },
          { name: 'Item 2' },
          { name: 'Item 3' },
          { name: 'Item 4' },
          { name: 'Item 5' },
        ],
        resourceLayoutHint: 'grid',
        extractionConfidence: 'complete',
      }

      mockGenerateObject
        .mockResolvedValueOnce({
          object: mockClassification,
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        })
        .mockResolvedValueOnce({
          object: mockSummarization,
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        })
        .mockResolvedValueOnce({
          object: mockListExtraction,
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        })

      const content = createMockContent()
      const result = await processContent(content)

      expect(result.extractedResources).toHaveLength(5)
      expect(result.extractedResources).toEqual(mockListExtraction.extractedResources)
    })

    it('should propagate classification errors', async () => {
      mockGenerateObject.mockRejectedValue(new Error('Classification failed'))

      const content = createMockContent()

      await expect(processContent(content)).rejects.toThrow('Classification failed')
    })

    it('should handle list extraction failure gracefully', async () => {
      const mockClassification = createMockClassification({ contentType: 'list' })
      const mockSummarization = createMockSummarization({
        extractedResources: [{ name: 'Item 1' }],
      })

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      mockGenerateObject
        .mockResolvedValueOnce({
          object: mockClassification,
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        })
        .mockResolvedValueOnce({
          object: mockSummarization,
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        })
        .mockRejectedValueOnce(new Error('List extraction failed'))

      const content = createMockContent()
      const result = await processContent(content)

      // Should not throw, should use summarization results
      expect(result.extractedResources).toEqual(mockSummarization.extractedResources)
      expect(consoleWarnSpy).toHaveBeenCalled()

      consoleWarnSpy.mockRestore()
    })
  })

  describe('processContentWithRetry', () => {
    it('should succeed on first attempt', async () => {
      const mockClassification = createMockClassification()
      const mockSummarization = createMockSummarization()

      mockGenerateObject
        .mockResolvedValueOnce({
          object: mockClassification,
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        })
        .mockResolvedValueOnce({
          object: mockSummarization,
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        })

      const content = createMockContent()
      const result = await processContentWithRetry(content)

      expect(result.category).toBe(mockClassification.category)
      expect(mockGenerateObject).toHaveBeenCalledTimes(2) // Only 2 calls (no retries)
    })

    it('should retry on failure and succeed on second attempt', async () => {
      const mockClassification = createMockClassification()
      const mockSummarization = createMockSummarization()

      mockGenerateObject
        // First attempt - fail
        .mockRejectedValueOnce(new Error('Temporary failure'))
        // Second attempt - succeed
        .mockResolvedValueOnce({
          object: mockClassification,
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        })
        .mockResolvedValueOnce({
          object: mockSummarization,
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        })

      const content = createMockContent()
      const result = await processContentWithRetry(content)

      expect(result.category).toBe(mockClassification.category)
      expect(mockGenerateObject).toHaveBeenCalledTimes(3) // 1 failed + 2 successful
    })

    it('should throw error after all retry attempts exhausted', async () => {
      mockGenerateObject.mockRejectedValue(new Error('Persistent failure'))

      const content = createMockContent()

      await expect(processContentWithRetry(content, 3)).rejects.toThrow('AI processing failed after 3 attempts')
    })
  })

  describe('Content Sufficiency Detection', () => {

    it('should mark empty content as insufficient', () => {
      const content = createMockContent({ content: '' })
      const result = isContentSufficient(content)

      expect(result.isSufficient).toBe(false)
      expect(result.reason).toBe('Content is empty')
    })

    it('should mark whitespace-only content as insufficient', () => {
      const content = createMockContent({ content: '   \n\n\t  ' })
      const result = isContentSufficient(content)

      expect(result.isSufficient).toBe(false)
      expect(result.reason).toBe('Content is empty')
    })

    it('should mark content matching URL as insufficient', () => {
      const url = 'https://example.com/article'
      const content = createMockContent({ url, content: url })
      const result = isContentSufficient(content)

      expect(result.isSufficient).toBe(false)
      expect(result.reason).toBe('Content is just the URL')
    })

    it('should mark fallback placeholder pattern as insufficient', () => {
      const content = createMockContent({ content: 'Content from https://example.com/article' })
      const result = isContentSufficient(content)

      expect(result.isSufficient).toBe(false)
      expect(result.reason).toBe('Content is a fallback placeholder')
    })

    it('should mark short content (< 100 chars) as insufficient', () => {
      const content = createMockContent({ content: 'This is a very short content.' })
      const result = isContentSufficient(content)

      expect(result.isSufficient).toBe(false)
      expect(result.reason).toContain('Content too short')
      expect(result.reason).toContain('minimum 100')
    })

    it('should mark content at exactly 99 chars as insufficient', () => {
      const content = createMockContent({ content: 'a'.repeat(99) })
      const result = isContentSufficient(content)

      expect(result.isSufficient).toBe(false)
      expect(result.reason).toContain('Content too short')
    })

    it('should mark content at exactly 100 chars as sufficient', () => {
      const content = createMockContent({ content: 'a'.repeat(100) })
      const result = isContentSufficient(content)

      expect(result.isSufficient).toBe(true)
      expect(result.reason).toBeUndefined()
    })

    it('should mark long content as sufficient', () => {
      const content = createMockContent({ content: 'This is a sufficiently long content that should pass the minimum length check and be considered valid for AI processing.' })
      const result = isContentSufficient(content)

      expect(result.isSufficient).toBe(true)
      expect(result.reason).toBeUndefined()
    })

    it('should trim content before checking length', () => {
      // 100 chars of content with surrounding whitespace
      const content = createMockContent({ content: '   ' + 'a'.repeat(100) + '   ' })
      const result = isContentSufficient(content)

      expect(result.isSufficient).toBe(true)
    })

    it('should have correct INSUFFICIENT_CONTENT_BLURB message', () => {
      expect(INSUFFICIENT_CONTENT_BLURB).toBe(
        'Content extraction in progress. Please check back later or visit the URL directly.'
      )
    })

    it('should have correct INSUFFICIENT_CONTENT_MARKER', () => {
      expect(INSUFFICIENT_CONTENT_MARKER).toBe('__INSUFFICIENT_CONTENT__')
    })
  })

  describe('processContent with insufficient content', () => {
    it('should return insufficient content result for empty content', async () => {
      const content = createMockContent({ content: '' })
      const result = await processContent(content)

      expect(result.summary).toBe('__INSUFFICIENT_CONTENT__')
      expect(result.blurb).toBe('Content extraction in progress. Please check back later or visit the URL directly.')
      expect(result.category).toBeNull()
      expect(result.tags).toEqual([])
      expect(result.contentType).toBe('other')

      // AI should not be called
      expect(mockGenerateObject).not.toHaveBeenCalled()
    })

    it('should return insufficient content result for fallback placeholder', async () => {
      const content = createMockContent({
        content: 'Content from https://example.com/some-url',
      })
      const result = await processContent(content)

      expect(result.summary).toBe('__INSUFFICIENT_CONTENT__')
      expect(result.blurb).toBe('Content extraction in progress. Please check back later or visit the URL directly.')

      // AI should not be called
      expect(mockGenerateObject).not.toHaveBeenCalled()
    })

    it('should return insufficient content result for short content', async () => {
      const content = createMockContent({ content: 'Short content only.' })
      const result = await processContent(content)

      expect(result.summary).toBe('__INSUFFICIENT_CONTENT__')

      // AI should not be called
      expect(mockGenerateObject).not.toHaveBeenCalled()
    })

    it('should process normal content and call AI', async () => {
      const mockClassification = createMockClassification()
      const mockSummarization = createMockSummarization()

      mockGenerateObject
        .mockResolvedValueOnce({
          object: mockClassification,
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        })
        .mockResolvedValueOnce({
          object: mockSummarization,
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        })

      const content = createMockContent({
        content: 'This is a sufficiently long content that should pass the minimum length check and trigger the AI processing pipeline for classification and summarization.',
      })
      const result = await processContent(content)

      expect(result.summary).not.toBe('__INSUFFICIENT_CONTENT__')
      expect(result.category).toBe(mockClassification.category)
      expect(mockGenerateObject).toHaveBeenCalledTimes(2)
    })
  })

  describe('Instagram Carousel Content Sufficiency', () => {
    describe('carousel with images and minimal caption', () => {
      it('should accept carousel with 2+ images and 20-char caption', () => {
        const content = createMockContent({
          source: 'instagram',
          content: 'Save these later ok!', // 20 characters
          mediaUrls: ['https://instagram.com/img1.jpg', 'https://instagram.com/img2.jpg'],
          rawMetadata: {
            instagram: {
              isCarousel: true,
              carouselItems: [
                { isVideo: false, url: 'https://instagram.com/img1.jpg' },
                { isVideo: false, url: 'https://instagram.com/img2.jpg' },
              ],
            },
            carouselInfo: {
              isCarousel: true,
              itemCount: 2,
              hasVideos: false,
            },
          },
        })

        const result = isContentSufficient(content)

        // Carousel posts with 2+ images get relaxed content requirements (20 chars minimum)
        // This allows carousel posts with short captions like "Save these!" to be processed
        expect(result.isSufficient).toBe(true)
        expect(result.isCarouselRelaxed).toBe(true)
      })

      it('should accept carousel with 10 images and 50-char caption', () => {
        const content = createMockContent({
          source: 'instagram',
          content: 'Check out these amazing AI tools I found recently!', // 50 characters
          mediaUrls: Array.from({ length: 10 }, (_, i) => `https://instagram.com/img${i}.jpg`),
          rawMetadata: {
            instagram: {
              isCarousel: true,
              carouselItems: Array.from({ length: 10 }, (_, i) => ({
                isVideo: false,
                url: `https://instagram.com/img${i}.jpg`,
              })),
            },
            carouselInfo: {
              isCarousel: true,
              itemCount: 10,
              hasVideos: false,
            },
          },
        })

        const result = isContentSufficient(content)

        // Carousel posts with 2+ images get relaxed content requirements (20 chars minimum)
        // 50 chars is above the carousel minimum, so should pass with carousel relaxation
        expect(result.isSufficient).toBe(true)
        expect(result.isCarouselRelaxed).toBe(true)
      })

      it('should reject carousel with 2+ images and 15-char caption', () => {
        const content = createMockContent({
          source: 'instagram',
          content: 'Save these now', // 14 characters
          mediaUrls: ['https://instagram.com/img1.jpg', 'https://instagram.com/img2.jpg'],
          rawMetadata: {
            instagram: {
              isCarousel: true,
              carouselItems: [
                { isVideo: false, url: 'https://instagram.com/img1.jpg' },
                { isVideo: false, url: 'https://instagram.com/img2.jpg' },
              ],
            },
            carouselInfo: {
              isCarousel: true,
              itemCount: 2,
              hasVideos: false,
            },
          },
        })

        const result = isContentSufficient(content)

        expect(result.isSufficient).toBe(false)
        expect(result.reason).toContain('Content too short')
      })
    })

    describe('single-image posts maintain existing requirements', () => {
      it('should require 100-char caption for single-image posts', () => {
        const content = createMockContent({
          source: 'instagram',
          content: 'This is a single image post with a longer caption', // 50 characters
          mediaUrls: ['https://instagram.com/img.jpg'],
          rawMetadata: {
            instagram: {
              isCarousel: false,
            },
          },
        })

        const result = isContentSufficient(content)

        expect(result.isSufficient).toBe(false)
        expect(result.reason).toContain('Content too short')
        expect(result.reason).toContain('minimum 100')
      })

      it('should accept single-image posts with 100+ char caption', () => {
        const content = createMockContent({
          source: 'instagram',
          content: 'This is a sufficiently long caption for a single image post that contains at least 100 characters of text to ensure it has enough content for AI processing and analysis.',
          mediaUrls: ['https://instagram.com/img.jpg'],
          rawMetadata: {
            instagram: {
              isCarousel: false,
            },
          },
        })

        const result = isContentSufficient(content)

        expect(result.isSufficient).toBe(true)
        expect(result.reason).toBeUndefined()
      })
    })

    describe('non-carousel content behavior unchanged', () => {
      it('should maintain existing behavior for non-Instagram content', () => {
        const content = createMockContent({
          source: 'web',
          content: 'This is a short web article', // 28 characters
        })

        const result = isContentSufficient(content)

        expect(result.isSufficient).toBe(false)
        expect(result.reason).toContain('Content too short')
      })

      it('should maintain existing behavior for Twitter threads', () => {
        const content = createMockContent({
          source: 'twitter',
          content: 'This is a sufficiently long Twitter thread with multiple tweets that contain enough content for analysis.',
        })

        const result = isContentSufficient(content)

        expect(result.isSufficient).toBe(true)
      })
    })
  })
})
