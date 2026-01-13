/**
 * Tests for Instagram Carousel Image Processing
 *
 * Tests the enhanced carousel handling functionality:
 * - MAX_CAROUSEL_IMAGES constant (10 vs default 4)
 * - Carousel detection from rawMetadata.instagram.isCarousel
 * - Carousel-specific prompts for classification and summarization
 * - Batch processing for large carousels (>10 images)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ExtractedContent, InstagramMetadata, InstagramCarouselItem } from '@plukd/shared'

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

// Import after mocking
import {
  classifyContent,
  summarizeContent,
  extractListItems,
  processContent,
} from '../process'

import {
  getValidImageUrls,
  MAX_CAROUSEL_IMAGES,
  buildClassificationPrompt,
  detectListIndicators,
} from '../prompts'

import { buildSummarizationPrompt } from '../prompts/summarization'

// Helper to create carousel item
function createCarouselItem(index: number): InstagramCarouselItem {
  return {
    isVideo: false,
    url: `https://scontent.cdninstagram.com/image${index}.jpg`,
    thumbnailUrl: `https://scontent.cdninstagram.com/thumb${index}.jpg`,
  }
}

// Helper to create Instagram carousel content
function createCarouselContent(
  imageCount: number,
  overrides: Partial<ExtractedContent> = {}
): ExtractedContent {
  const carouselItems = Array.from({ length: imageCount }, (_, i) =>
    createCarouselItem(i + 1)
  )

  const instagramMeta: InstagramMetadata = {
    postType: 'post',
    isCarousel: true,
    carouselItems,
  }

  return {
    url: 'https://instagram.com/p/test123',
    source: 'instagram',
    title: 'Top 31 AI Tools You Need in 2024',
    content:
      'Here are 31 amazing AI tools that will boost your productivity. Each slide shows a different tool with its name and description. Follow for more AI content!',
    author: '@aitools',
    mediaUrls: carouselItems.map((item) => item.url),
    rawMetadata: {
      instagram: instagramMeta,
    },
    ...overrides,
  }
}

// Helper to create non-carousel content
function createNonCarouselContent(
  overrides: Partial<ExtractedContent> = {}
): ExtractedContent {
  return {
    url: 'https://example.com/article',
    source: 'web',
    title: 'Example Article',
    content:
      'This is example content for testing AI processing. It includes multiple sentences with enough detail to pass the minimum content length requirement of 100 characters for AI analysis.',
    author: 'Test Author',
    mediaUrls: [
      'https://pbs.twimg.com/media/image1.jpg',
      'https://pbs.twimg.com/media/image2.jpg',
      'https://pbs.twimg.com/media/image3.jpg',
      'https://pbs.twimg.com/media/image4.jpg',
      'https://pbs.twimg.com/media/image5.jpg',
      'https://pbs.twimg.com/media/image6.jpg',
    ],
    ...overrides,
  }
}

describe('Carousel Image Processing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('MAX_CAROUSEL_IMAGES constant', () => {
    it('should be set to 10', () => {
      expect(MAX_CAROUSEL_IMAGES).toBe(10)
    })
  })

  describe('getValidImageUrls', () => {
    it('should limit to 4 images by default (MAX_IMAGES)', () => {
      const urls = [
        'https://pbs.twimg.com/media/1.jpg',
        'https://pbs.twimg.com/media/2.jpg',
        'https://pbs.twimg.com/media/3.jpg',
        'https://pbs.twimg.com/media/4.jpg',
        'https://pbs.twimg.com/media/5.jpg',
        'https://pbs.twimg.com/media/6.jpg',
      ]

      const result = getValidImageUrls(urls)
      expect(result).toHaveLength(4)
    })

    it('should accept custom limit parameter for carousels', () => {
      const urls = Array.from(
        { length: 15 },
        (_, i) => `https://pbs.twimg.com/media/${i + 1}.jpg`
      )

      const result = getValidImageUrls(urls, MAX_CAROUSEL_IMAGES)
      expect(result).toHaveLength(10)
    })

    it('should filter untrusted domains', () => {
      const urls = [
        'https://pbs.twimg.com/media/trusted1.jpg',
        'https://evil.com/malicious.jpg',
        'https://scontent.cdninstagram.com/trusted2.jpg',
        'https://phishing.net/image.jpg',
      ]

      const result = getValidImageUrls(urls, MAX_CAROUSEL_IMAGES)
      expect(result).toHaveLength(2)
      expect(result).toContain('https://pbs.twimg.com/media/trusted1.jpg')
      expect(result).toContain('https://scontent.cdninstagram.com/trusted2.jpg')
    })

    it('should return all URLs if fewer than limit', () => {
      const urls = [
        'https://pbs.twimg.com/media/1.jpg',
        'https://pbs.twimg.com/media/2.jpg',
      ]

      const result = getValidImageUrls(urls, MAX_CAROUSEL_IMAGES)
      expect(result).toHaveLength(2)
    })

    it('should handle empty array', () => {
      const result = getValidImageUrls([])
      expect(result).toHaveLength(0)
    })

    it('should handle undefined', () => {
      const result = getValidImageUrls(undefined)
      expect(result).toHaveLength(0)
    })
  })

  describe('Carousel Detection', () => {
    describe('classifyContent', () => {
      it('should detect carousel and use 10 image limit', async () => {
        const content = createCarouselContent(15)

        mockGenerateObject.mockResolvedValueOnce({
          object: {
            category: 'ai',
            tags: ['tool', 'resource'],
            contentType: 'list',
          },
        })

        // Spy on console.log to verify carousel detection
        const consoleSpy = vi.spyOn(console, 'log')

        await classifyContent(content)

        // Verify carousel was detected
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Carousel detected')
        )
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('15 total images')
        )
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('analyzing 10 images')
        )
      })

      it('should use default 4 image limit for non-carousel content', async () => {
        const content = createNonCarouselContent()

        mockGenerateObject.mockResolvedValueOnce({
          object: {
            category: 'ai',
            tags: ['tutorial'],
            contentType: 'article',
          },
        })

        const consoleSpy = vi.spyOn(console, 'log')

        await classifyContent(content)

        // Should NOT log carousel detection
        expect(consoleSpy).not.toHaveBeenCalledWith(
          expect.stringContaining('Carousel detected')
        )
      })

      it('should not detect carousel when isCarousel is false', async () => {
        const content = createCarouselContent(10)
        // Override to set isCarousel to false
        const instagram = content.rawMetadata?.instagram as InstagramMetadata
        instagram.isCarousel = false

        mockGenerateObject.mockResolvedValueOnce({
          object: {
            category: 'ai',
            tags: ['tool'],
            contentType: 'article',
          },
        })

        const consoleSpy = vi.spyOn(console, 'log')

        await classifyContent(content)

        expect(consoleSpy).not.toHaveBeenCalledWith(
          expect.stringContaining('Carousel detected')
        )
      })
    })

    describe('summarizeContent', () => {
      it('should use carousel image limit for Instagram carousels', async () => {
        const content = createCarouselContent(12)
        const classification = {
          category: 'ai' as const,
          tags: ['tool' as const, 'resource' as const],
          contentType: 'list' as const,
        }

        mockGenerateObject.mockResolvedValueOnce({
          object: {
            blurb: 'Discover 31 AI tools to boost productivity.',
            summary: '• Tool 1\n• Tool 2\n• Tool 3',
            keyTakeaways: [{ text: 'Try these tools', type: 'action' }],
            extractedResources: [
              { name: 'Tool 1', description: 'First tool', category: 'tool' },
              { name: 'Tool 2', description: 'Second tool', category: 'tool' },
            ],
            resourceLayoutHint: 'grid',
          },
        })

        const result = await summarizeContent(content, classification)

        expect(result).toBeDefined()
        expect(result.blurb).toContain('AI tools')
      })
    })

    describe('extractListItems', () => {
      it('should use multimodal messages for carousel list extraction', async () => {
        const content = createCarouselContent(8)
        const listIndicators = {
          isLikelyList: true,
          estimatedItemCount: 31,
          confidence: 'high' as const,
          patterns: ['list-phrases'],
        }

        mockGenerateObject.mockResolvedValueOnce({
          object: {
            totalItemsMentioned: 8,
            extractedResources: [
              { name: 'Mixo.io', description: 'Launch websites in seconds', category: 'tool' },
              { name: 'Fireflies.ai', description: 'Meeting notes AI', category: 'tool' },
            ],
            resourceLayoutHint: 'grid',
            extractionConfidence: 'partial',
          },
        })

        const result = await extractListItems(content, listIndicators)

        expect(result.extractedResources).toHaveLength(2)
        expect(mockGenerateObject).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: expect.any(Array),
          })
        )
      })
    })
  })

  describe('Classification Prompt', () => {
    it('should include carousel context in prompt', () => {
      const content = createCarouselContent(15)
      const carouselInfo = {
        isCarousel: true,
        totalImages: 15,
        visibleImages: 10,
      }

      const prompt = buildClassificationPrompt(content, true, undefined, carouselInfo)

      expect(prompt).toContain('CAROUSEL POST')
      expect(prompt).toContain('15 total images')
      expect(prompt).toContain('10 are visible')
    })

    it('should not include carousel context for non-carousel', () => {
      const content = createNonCarouselContent()

      const prompt = buildClassificationPrompt(content, true)

      expect(prompt).not.toContain('CAROUSEL POST')
      expect(prompt).not.toContain('total images')
    })
  })

  describe('Summarization Prompt', () => {
    it('should include carousel extraction instructions', () => {
      const content = createCarouselContent(12)
      const classification = {
        category: 'ai' as const,
        tags: ['tool' as const],
        contentType: 'list' as const,
      }
      const carouselInfo = {
        isCarousel: true,
        totalImages: 12,
        visibleImages: 10,
      }

      const prompt = buildSummarizationPrompt(
        content,
        classification,
        true,
        undefined,
        carouselInfo
      )

      expect(prompt).toContain('CRITICAL CAROUSEL EXTRACTION')
      expect(prompt).toContain('12 total slides')
      expect(prompt).toContain('10 visible')
    })

    it('should include hidden slides note when carousel has more than visible', () => {
      const content = createCarouselContent(15)
      const classification = {
        category: 'ai' as const,
        tags: ['tool' as const],
        contentType: 'list' as const,
      }
      const carouselInfo = {
        isCarousel: true,
        totalImages: 15,
        visibleImages: 10,
      }

      const prompt = buildSummarizationPrompt(
        content,
        classification,
        true,
        undefined,
        carouselInfo
      )

      expect(prompt).toContain('15 total slides')
      expect(prompt).toContain('only 10 are visible')
    })
  })

  describe('Full Pipeline with Carousel', () => {
    it('should process carousel content with correct image limit', async () => {
      const content = createCarouselContent(8)

      // Mock classification
      mockGenerateObject.mockResolvedValueOnce({
        object: {
          category: 'ai',
          tags: ['tool', 'resource'],
          contentType: 'list',
        },
      })

      // Mock summarization
      mockGenerateObject.mockResolvedValueOnce({
        object: {
          blurb: '31 AI tools for productivity.',
          summary: '• Tool summaries...',
          keyTakeaways: [{ text: 'Try these', type: 'action' }],
          extractedResources: [
            { name: 'Tool 1', category: 'tool' },
            { name: 'Tool 2', category: 'tool' },
          ],
          resourceLayoutHint: 'grid',
        },
      })

      // Mock list extraction
      mockGenerateObject.mockResolvedValueOnce({
        object: {
          totalItemsMentioned: 8,
          extractedResources: [
            { name: 'Mixo.io', description: 'Launch websites', category: 'tool' },
            { name: 'Fireflies.ai', description: 'Meeting notes', category: 'tool' },
            { name: 'Claude', description: 'AI assistant', category: 'tool' },
          ],
          resourceLayoutHint: 'grid',
          extractionConfidence: 'partial',
        },
      })

      const result = await processContent(content)

      expect(result.category).toBe('ai')
      expect(result.contentType).toBe('list')
      // Should use dedicated extraction results (3 items) over summarization (2 items)
      expect(result.extractedResources).toHaveLength(3)
    })

    it('should process large carousel and trigger batch processing', async () => {
      // Create carousel with 20 images (more than MAX_CAROUSEL_IMAGES)
      const content = createCarouselContent(20)

      // Mock classification
      mockGenerateObject.mockResolvedValueOnce({
        object: {
          category: 'ai',
          tags: ['tool', 'resource'],
          contentType: 'list',
        },
      })

      // Mock summarization
      mockGenerateObject.mockResolvedValueOnce({
        object: {
          blurb: '31 AI tools for productivity.',
          summary: '• Tool summaries...',
          keyTakeaways: [{ text: 'Try these', type: 'action' }],
          extractedResources: [
            { name: 'Tool 1', category: 'tool' },
            { name: 'Tool 2', category: 'tool' },
            { name: 'Tool 3', category: 'tool' },
          ],
          resourceLayoutHint: 'grid',
        },
      })

      // Mock list extraction
      mockGenerateObject.mockResolvedValueOnce({
        object: {
          totalItemsMentioned: 10,
          extractedResources: Array.from({ length: 10 }, (_, i) => ({
            name: `Tool ${i + 1}`,
            description: `Description ${i + 1}`,
            category: 'tool',
          })),
          resourceLayoutHint: 'grid',
          extractionConfidence: 'complete',
        },
      })

      // Mock batch extraction for images 11-20
      mockGenerateObject.mockResolvedValueOnce({
        object: {
          extractedResources: Array.from({ length: 10 }, (_, i) => ({
            name: `Tool ${i + 11}`,
            description: `Description ${i + 11}`,
            category: 'tool',
          })),
        },
      })

      const consoleSpy = vi.spyOn(console, 'log')

      const result = await processContent(content)

      // Should have processed additional batch
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('additional carousel images')
      )

      // Final result should have 20 resources (10 from list extraction + 10 from batch)
      expect(result.extractedResources?.length).toBe(20)
    })
  })

  describe('Batch Processing', () => {
    it('should not trigger batch processing for small carousels', async () => {
      const content = createCarouselContent(8) // Less than MAX_CAROUSEL_IMAGES

      mockGenerateObject
        .mockResolvedValueOnce({
          object: {
            category: 'ai',
            tags: ['tool'],
            contentType: 'list',
          },
        })
        .mockResolvedValueOnce({
          object: {
            blurb: 'Tools list',
            summary: '• Tools...',
            extractedResources: [{ name: 'Tool 1', category: 'tool' }],
            resourceLayoutHint: 'grid',
          },
        })
        .mockResolvedValueOnce({
          object: {
            totalItemsMentioned: 8,
            extractedResources: [
              { name: 'Tool 1', category: 'tool' },
              { name: 'Tool 2', category: 'tool' },
            ],
            resourceLayoutHint: 'grid',
            extractionConfidence: 'partial',
          },
        })

      const consoleSpy = vi.spyOn(console, 'log')

      await processContent(content)

      // Should NOT log batch processing
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('additional carousel images')
      )
    })

    it('should merge batch results avoiding duplicates', async () => {
      const content = createCarouselContent(15)

      mockGenerateObject
        .mockResolvedValueOnce({
          object: {
            category: 'ai',
            tags: ['tool'],
            contentType: 'list',
          },
        })
        .mockResolvedValueOnce({
          object: {
            blurb: 'Tools list',
            summary: '• Tools...',
            extractedResources: [],
            resourceLayoutHint: 'grid',
          },
        })
        .mockResolvedValueOnce({
          object: {
            totalItemsMentioned: 10,
            extractedResources: [
              { name: 'Tool 1', category: 'tool' },
              { name: 'Tool 2', category: 'tool' },
            ],
            resourceLayoutHint: 'grid',
            extractionConfidence: 'complete',
          },
        })
        .mockResolvedValueOnce({
          object: {
            extractedResources: [
              { name: 'Tool 1', category: 'tool' }, // Duplicate - should be filtered
              { name: 'Tool 3', category: 'tool' }, // New
            ],
          },
        })

      const result = await processContent(content)

      // Should have 3 unique resources (Tool 1 duplicate filtered out)
      expect(result.extractedResources?.length).toBe(3)
      expect(result.extractedResources?.map((r) => r.name)).toEqual([
        'Tool 1',
        'Tool 2',
        'Tool 3',
      ])
    })
  })

  describe('Edge Cases', () => {
    it('should handle carousel with empty carouselItems array', async () => {
      const content = createCarouselContent(0)

      mockGenerateObject.mockResolvedValueOnce({
        object: {
          category: 'ai',
          tags: ['tool'],
          contentType: 'article',
        },
      })

      mockGenerateObject.mockResolvedValueOnce({
        object: {
          blurb: 'Content summary',
          summary: '• Points...',
          keyTakeaways: [{ text: 'Key point', type: 'action' }],
        },
      })

      const consoleSpy = vi.spyOn(console, 'log')

      await processContent(content)

      // Should NOT detect as carousel
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Carousel detected')
      )
    })

    it('should handle missing rawMetadata gracefully', async () => {
      const content: ExtractedContent = {
        url: 'https://instagram.com/p/test',
        source: 'instagram',
        title: 'Test Post',
        content:
          'This is a test post with enough content to pass the minimum length requirement for AI processing. Adding more text here.',
        // No rawMetadata
      }

      mockGenerateObject
        .mockResolvedValueOnce({
          object: {
            category: 'ai',
            tags: ['tool'],
            contentType: 'article',
          },
        })
        .mockResolvedValueOnce({
          object: {
            blurb: 'Test blurb',
            summary: '• Points',
            keyTakeaways: [{ text: 'Point', type: 'action' }],
          },
        })

      const result = await processContent(content)

      expect(result).toBeDefined()
      expect(result.category).toBe('ai')
    })
  })
})
