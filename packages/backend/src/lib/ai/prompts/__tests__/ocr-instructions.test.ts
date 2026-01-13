/**
 * Tests for OCR instruction improvements in AI prompts
 *
 * These tests verify that the prompts include explicit OCR instructions
 * for extracting text from carousel images, which is critical for
 * content like "Top 10 AI Tools" Instagram posts.
 */

import { describe, it, expect } from 'vitest'
import type { ExtractedContent } from '@plukd/shared'
import {
  buildClassificationPrompt,
  detectListIndicators,
  type CarouselInfo,
  type ListIndicators,
} from '../classification'
import { buildSummarizationPrompt } from '../summarization'
import { buildListExtractionPrompt } from '../list-extraction'
import type { ClassificationResult } from '../../schemas'

// Helper to create mock extracted content
function createMockContent(overrides: Partial<ExtractedContent> = {}): ExtractedContent {
  return {
    url: 'https://instagram.com/p/abc123',
    source: 'instagram',
    title: 'Top 10 AI Tools',
    content: 'Check out these amazing AI tools that will change how you work.',
    author: 'aitools_daily',
    mediaUrls: [
      'https://scontent.cdninstagram.com/image1.jpg',
      'https://scontent.cdninstagram.com/image2.jpg',
      'https://scontent.cdninstagram.com/image3.jpg',
    ],
    ...overrides,
  }
}

// Helper to create mock classification result
function createMockClassification(overrides: Partial<ClassificationResult> = {}): ClassificationResult {
  return {
    category: 'ai',
    tags: ['tool', 'resource'],
    contentType: 'list',
    ...overrides,
  }
}

// Helper to create mock carousel info
function createCarouselInfo(overrides: Partial<CarouselInfo> = {}): CarouselInfo {
  return {
    isCarousel: true,
    totalImages: 10,
    visibleImages: 8,
    ...overrides,
  }
}

// Helper to create mock list indicators
function createListIndicators(overrides: Partial<ListIndicators> = {}): ListIndicators {
  return {
    isLikelyList: true,
    estimatedItemCount: 10,
    confidence: 'high',
    patterns: ['list-phrases'],
    ...overrides,
  }
}

describe('OCR Instructions in AI Prompts', () => {
  describe('Classification Prompt', () => {
    it('should include OCR instructions when images are present', () => {
      const content = createMockContent()
      const prompt = buildClassificationPrompt(content, true)

      expect(prompt).toContain('OCR')
      expect(prompt).toContain('READ ALL TEXT')
      expect(prompt).toContain('visible in every image')
    })

    it('should not include OCR instructions when no images', () => {
      const content = createMockContent({ mediaUrls: [] })
      const prompt = buildClassificationPrompt(content, false)

      expect(prompt).not.toContain('OCR')
      expect(prompt).not.toContain('IMAGE CONTENT ANALYSIS')
    })

    it('should include carousel-specific OCR instructions when carousel info provided', () => {
      const content = createMockContent()
      const carouselInfo = createCarouselInfo()
      const prompt = buildClassificationPrompt(content, true, undefined, carouselInfo)

      expect(prompt).toContain('CAROUSEL POST')
      expect(prompt).toContain('10 total images')
      expect(prompt).toContain('8 are visible')
      expect(prompt).toContain('Analyze EACH image separately')
      expect(prompt).toContain('do NOT skip any slides')
    })

    it('should mention extracting tool names and descriptions', () => {
      const content = createMockContent()
      const prompt = buildClassificationPrompt(content, true)

      expect(prompt).toContain('Tool/app/book/movie names')
      expect(prompt).toContain('descriptions')
      expect(prompt).toContain('URLs or website names')
    })

    it('should include example carousel format for list detection', () => {
      const content = createMockContent()
      const carouselInfo = createCarouselInfo()
      const prompt = buildClassificationPrompt(content, true, undefined, carouselInfo)

      expect(prompt).toContain('Mixo.io')
      expect(prompt).toContain('list')
    })
  })

  describe('Summarization Prompt', () => {
    it('should include explicit OCR instructions when images are present', () => {
      const content = createMockContent()
      const classification = createMockClassification()
      const prompt = buildSummarizationPrompt(content, classification, true)

      expect(prompt).toContain('OCR REQUIRED')
      expect(prompt).toContain('Read and extract ALL visible text')
    })

    it('should include carousel OCR instructions when carousel info provided', () => {
      const content = createMockContent()
      const classification = createMockClassification()
      const carouselInfo = createCarouselInfo()
      const prompt = buildSummarizationPrompt(content, classification, true, undefined, carouselInfo)

      expect(prompt).toContain('CRITICAL CAROUSEL EXTRACTION')
      expect(prompt).toContain('10 total slides')
      expect(prompt).toContain('8 visible')
      expect(prompt).toContain('analyze EACH visible image')
    })

    it('should include example extraction format', () => {
      const content = createMockContent()
      const classification = createMockClassification()
      const carouselInfo = createCarouselInfo()
      const prompt = buildSummarizationPrompt(content, classification, true, undefined, carouselInfo)

      expect(prompt).toContain('Mixo.io')
      expect(prompt).toContain('Launch websites in seconds')
      expect(prompt).toContain('extractedResources')
    })

    it('should explicitly tell model not to just say names are in images', () => {
      const content = createMockContent()
      const classification = createMockClassification()
      const prompt = buildSummarizationPrompt(content, classification, true)

      expect(prompt).toContain('Do NOT say "names are in images"')
      expect(prompt).toContain('actually READ and EXTRACT')
    })

    it('should include extraction targets for various content types', () => {
      const content = createMockContent()
      const classification = createMockClassification()
      const prompt = buildSummarizationPrompt(content, classification, true)

      expect(prompt).toContain('Tool/app names')
      expect(prompt).toContain('Book/movie titles')
      expect(prompt).toContain('Numbered lists')
      expect(prompt).toContain('URLs or website names')
    })
  })

  describe('List Extraction Prompt', () => {
    it('should include image OCR instructions when images are present', () => {
      const content = createMockContent()
      const listIndicators = createListIndicators()
      const prompt = buildListExtractionPrompt(content, listIndicators, true)

      expect(prompt).toContain('IMAGE/CAROUSEL OCR INSTRUCTIONS')
      expect(prompt).toContain('read text from EACH image using OCR')
    })

    it('should include carousel extraction example', () => {
      const content = createMockContent()
      const listIndicators = createListIndicators()
      const prompt = buildListExtractionPrompt(content, listIndicators, true)

      expect(prompt).toContain('CAROUSEL EXTRACTION EXAMPLE')
      expect(prompt).toContain('Top 10 AI Tools')
      expect(prompt).toContain('Mixo.io')
      expect(prompt).toContain('Fireflies.ai')
      expect(prompt).toContain('Perplexity')
    })

    it('should include detailed extraction format example', () => {
      const content = createMockContent()
      const listIndicators = createListIndicators()
      const prompt = buildListExtractionPrompt(content, listIndicators, true)

      expect(prompt).toContain('"name": "Mixo.io"')
      expect(prompt).toContain('"description": "Launch websites in seconds"')
      expect(prompt).toContain('"category": "tool"')
      expect(prompt).toContain('"url": "https://mixo.io"')
    })

    it('should mention checking images when text count is incomplete', () => {
      const content = createMockContent()
      const listIndicators = createListIndicators()
      const prompt = buildListExtractionPrompt(content, listIndicators, true)

      expect(prompt).toContain('check images for remaining items')
    })

    it('should instruct to infer URLs from tool names', () => {
      const content = createMockContent()
      const listIndicators = createListIndicators()
      const prompt = buildListExtractionPrompt(content, listIndicators, true)

      expect(prompt).toContain('infer URLs from names')
      expect(prompt).toContain('Mixo')
      expect(prompt).toContain('https://mixo.io')
    })

    it('should not include image instructions when no images present', () => {
      const content = createMockContent({ mediaUrls: [] })
      const listIndicators = createListIndicators()
      const prompt = buildListExtractionPrompt(content, listIndicators, false)

      expect(prompt).not.toContain('IMAGE/CAROUSEL OCR INSTRUCTIONS')
      expect(prompt).not.toContain('CAROUSEL EXTRACTION EXAMPLE')
    })

    it('should mention carousel slide format patterns', () => {
      const content = createMockContent()
      const listIndicators = createListIndicators()
      const prompt = buildListExtractionPrompt(content, listIndicators, true)

      expect(prompt).toContain('1/')
      expect(prompt).toContain('#1')
      expect(prompt).toContain('Item number')
      expect(prompt).toContain('Tool/item name')
      expect(prompt).toContain('Description/tagline')
    })

    it('should include extraction from ALL images rule', () => {
      const content = createMockContent()
      const listIndicators = createListIndicators()
      const prompt = buildListExtractionPrompt(content, listIndicators, true)

      expect(prompt).toContain('READ TEXT FROM ALL IMAGES')
    })
  })

  describe('List Indicator Detection', () => {
    it('should detect "Top 10" style content as list', () => {
      const content = 'Check out my top 10 favorite AI tools for productivity'
      const indicators = detectListIndicators(content)

      expect(indicators.isLikelyList).toBe(true)
      expect(indicators.estimatedItemCount).toBe(10)
      expect(indicators.confidence).toBe('high')
    })

    it('should detect numbered items pattern', () => {
      const content = `
        1. First tool
        2. Second tool
        3. Third tool
        4. Fourth tool
      `
      const indicators = detectListIndicators(content)

      expect(indicators.isLikelyList).toBe(true)
      expect(indicators.patterns).toContain('numbered-items')
    })

    it('should detect "best tools" phrasing', () => {
      const content = 'Here are the 7 best AI tools you need to try'
      const indicators = detectListIndicators(content)

      expect(indicators.isLikelyList).toBe(true)
      expect(indicators.estimatedItemCount).toBe(7)
    })

    it('should return low confidence for non-list content', () => {
      const content = 'This is just a regular article about machine learning concepts.'
      const indicators = detectListIndicators(content)

      expect(indicators.isLikelyList).toBe(false)
      expect(indicators.confidence).toBe('low')
    })
  })

  describe('Carousel Content Extraction Scenarios', () => {
    it('should handle 10-image carousel with tools', () => {
      const content = createMockContent({
        title: 'Top 10 AI Tools for 2026',
        content: 'Save this post for later! These AI tools will transform your workflow.',
        mediaUrls: Array(10).fill('https://scontent.cdninstagram.com/image.jpg'),
      })
      const classification = createMockClassification()
      const carouselInfo = createCarouselInfo({ totalImages: 10, visibleImages: 10 })
      const listIndicators = createListIndicators({ estimatedItemCount: 10 })

      const classificationPrompt = buildClassificationPrompt(content, true, listIndicators, carouselInfo)
      const summarizationPrompt = buildSummarizationPrompt(content, classification, true, listIndicators, carouselInfo)
      const listExtractionPrompt = buildListExtractionPrompt(content, listIndicators, true)

      // All prompts should have OCR instructions
      expect(classificationPrompt).toContain('OCR')
      expect(summarizationPrompt).toContain('OCR')
      expect(listExtractionPrompt).toContain('OCR')

      // Should mention expected item count
      expect(summarizationPrompt).toContain('10 items')
      expect(listExtractionPrompt).toContain('10 items')
    })

    it('should handle partial carousel visibility', () => {
      const content = createMockContent()
      const classification = createMockClassification()
      const carouselInfo = createCarouselInfo({ totalImages: 31, visibleImages: 10 })

      const prompt = buildSummarizationPrompt(content, classification, true, undefined, carouselInfo)

      expect(prompt).toContain('31 total slides')
      expect(prompt).toContain('10 visible')
      expect(prompt).toContain('Extract ALL items from the 10 visible images')
    })
  })
})
