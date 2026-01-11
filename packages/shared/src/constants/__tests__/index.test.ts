import { describe, it, expect } from 'vitest'
import * as LucideIcons from 'lucide-react'
import type { Category, Tag, ContentSource, ContentType, ResourceLayoutHint, ProcessingStatus } from '../../types'
import {
  CATEGORIES,
  CATEGORY_LABELS,
  CATEGORY_ICONS,
  TAGS,
  TAG_LABELS,
  SOURCE_COLORS,
  SOURCE_TEXT_COLORS,
  SOURCE_LABELS,
  SOURCE_ICONS,
  PROCESSING_STATUS_LABELS,
  PROCESSING_STATUS_COLORS,
  CONTENT_TYPES,
  CONTENT_TYPE_LABELS,
  CONTENT_TYPE_DESCRIPTIONS,
  RESOURCE_LAYOUT_HINTS,
  RESOURCE_LAYOUT_HINT_LABELS,
  RESOURCE_LAYOUT_HINT_DESCRIPTIONS,
} from '../index'

describe('Constants Integrity Tests', () => {
  // Helper function to check if a Lucide icon exists
  const isValidLucideIcon = (iconName: string): boolean => {
    return iconName in LucideIcons
  }

  // Helper function to validate Tailwind color classes
  const isValidTailwindColor = (colorClass: string): boolean => {
    // Matches: text-[#hexcode], bg-[#hexcode], or Tailwind utility classes
    const arbitraryValuePattern = /^(text|bg)-\[#[0-9a-fA-F]{6}\]$/
    const utilityPattern = /^(bg|text)-(yellow|blue|green|red|gray|slate|zinc|neutral|stone|orange|amber|lime|emerald|teal|cyan|sky|indigo|violet|purple|fuchsia|pink|rose)-(50|100|200|300|400|500|600|700|800|900)(\/\d{1,3})?( text-(yellow|blue|green|red|gray|slate|zinc|neutral|stone|orange|amber|lime|emerald|teal|cyan|sky|indigo|violet|purple|fuchsia|pink|rose)-(50|100|200|300|400|500|600|700|800|900))?$/
    return arbitraryValuePattern.test(colorClass) || utilityPattern.test(colorClass)
  }

  describe('CATEGORIES', () => {
    it('should contain exactly 38 categories', () => {
      expect(CATEGORIES).toHaveLength(38)
    })

    it('should have all categories as strings', () => {
      CATEGORIES.forEach((category) => {
        expect(typeof category).toBe('string')
        expect(category.length).toBeGreaterThan(0)
      })
    })

    it('should have unique category values', () => {
      const uniqueCategories = new Set(CATEGORIES)
      expect(uniqueCategories.size).toBe(CATEGORIES.length)
    })

    it('should have labels for all categories', () => {
      CATEGORIES.forEach((category) => {
        expect(CATEGORY_LABELS[category]).toBeDefined()
        expect(CATEGORY_LABELS[category].length).toBeGreaterThan(0)
      })
    })

    it('should have icons for all categories', () => {
      CATEGORIES.forEach((category) => {
        expect(CATEGORY_ICONS[category]).toBeDefined()
        expect(CATEGORY_ICONS[category].length).toBeGreaterThan(0)
      })
    })

    it('should have valid Lucide icons for all categories', () => {
      CATEGORIES.forEach((category) => {
        const iconName = CATEGORY_ICONS[category]
        expect(isValidLucideIcon(iconName)).toBe(true)
      })
    })

    it('should not have extra entries in CATEGORY_LABELS', () => {
      const labelKeys = Object.keys(CATEGORY_LABELS) as Category[]
      expect(labelKeys.sort()).toEqual([...CATEGORIES].sort())
    })

    it('should not have extra entries in CATEGORY_ICONS', () => {
      const iconKeys = Object.keys(CATEGORY_ICONS) as Category[]
      expect(iconKeys.sort()).toEqual([...CATEGORIES].sort())
    })

    it('should have meaningful labels (not empty or just whitespace)', () => {
      CATEGORIES.forEach((category) => {
        expect(CATEGORY_LABELS[category].trim().length).toBeGreaterThan(0)
      })
    })
  })

  describe('TAGS', () => {
    it('should contain exactly 20 tags', () => {
      expect(TAGS).toHaveLength(20)
    })

    it('should have all tags as strings', () => {
      TAGS.forEach((tag) => {
        expect(typeof tag).toBe('string')
        expect(tag.length).toBeGreaterThan(0)
      })
    })

    it('should have unique tag values', () => {
      const uniqueTags = new Set(TAGS)
      expect(uniqueTags.size).toBe(TAGS.length)
    })

    it('should have labels for all tags', () => {
      TAGS.forEach((tag) => {
        expect(TAG_LABELS[tag]).toBeDefined()
        expect(TAG_LABELS[tag].length).toBeGreaterThan(0)
      })
    })

    it('should not have extra entries in TAG_LABELS', () => {
      const labelKeys = Object.keys(TAG_LABELS) as Tag[]
      expect(labelKeys.sort()).toEqual([...TAGS].sort())
    })

    it('should have meaningful labels (not empty or just whitespace)', () => {
      TAGS.forEach((tag) => {
        expect(TAG_LABELS[tag].trim().length).toBeGreaterThan(0)
      })
    })
  })

  describe('SOURCE constants', () => {
    const EXPECTED_SOURCES: ContentSource[] = ['twitter', 'reddit', 'linkedin', 'youtube', 'instagram', 'web']

    it('should have consistent keys across all SOURCE_* objects', () => {
      const colorKeys = Object.keys(SOURCE_COLORS).sort()
      const textColorKeys = Object.keys(SOURCE_TEXT_COLORS).sort()
      const labelKeys = Object.keys(SOURCE_LABELS).sort()
      const iconKeys = Object.keys(SOURCE_ICONS).sort()

      expect(colorKeys).toEqual(EXPECTED_SOURCES.sort())
      expect(textColorKeys).toEqual(EXPECTED_SOURCES.sort())
      expect(labelKeys).toEqual(EXPECTED_SOURCES.sort())
      expect(iconKeys).toEqual(EXPECTED_SOURCES.sort())
    })

    it('should have valid Tailwind background color classes', () => {
      Object.entries(SOURCE_COLORS).forEach(([source, color]) => {
        expect(isValidTailwindColor(color)).toBe(true)
        expect(color).toMatch(/^bg-\[#[0-9a-fA-F]{6}\]$/)
      })
    })

    it('should have valid Tailwind text color classes', () => {
      Object.entries(SOURCE_TEXT_COLORS).forEach(([source, color]) => {
        expect(isValidTailwindColor(color)).toBe(true)
        expect(color).toMatch(/^text-\[#[0-9a-fA-F]{6}\]$/)
      })
    })

    it('should have non-empty labels for all sources', () => {
      EXPECTED_SOURCES.forEach((source) => {
        expect(SOURCE_LABELS[source]).toBeDefined()
        expect(SOURCE_LABELS[source].length).toBeGreaterThan(0)
        expect(SOURCE_LABELS[source].trim().length).toBeGreaterThan(0)
      })
    })

    it('should have valid Lucide icons for all sources', () => {
      EXPECTED_SOURCES.forEach((source) => {
        const iconName = SOURCE_ICONS[source]
        expect(iconName).toBeDefined()
        expect(isValidLucideIcon(iconName)).toBe(true)
      })
    })

    it('should have matching color hex codes between bg and text colors', () => {
      EXPECTED_SOURCES.forEach((source) => {
        const bgColor = SOURCE_COLORS[source]
        const textColor = SOURCE_TEXT_COLORS[source]

        // Extract hex code from bg-[#hexcode] and text-[#hexcode]
        const bgHex = bgColor.match(/#[0-9a-fA-F]{6}/)![0]
        const textHex = textColor.match(/#[0-9a-fA-F]{6}/)![0]

        expect(bgHex).toBe(textHex)
      })
    })
  })

  describe('PROCESSING_STATUS constants', () => {
    const EXPECTED_STATUSES: ProcessingStatus[] = ['pending', 'processing', 'completed', 'failed']

    it('should have labels for all processing statuses', () => {
      EXPECTED_STATUSES.forEach((status) => {
        expect(PROCESSING_STATUS_LABELS[status]).toBeDefined()
        expect(PROCESSING_STATUS_LABELS[status].length).toBeGreaterThan(0)
      })
    })

    it('should have colors for all processing statuses', () => {
      EXPECTED_STATUSES.forEach((status) => {
        expect(PROCESSING_STATUS_COLORS[status]).toBeDefined()
        expect(PROCESSING_STATUS_COLORS[status].length).toBeGreaterThan(0)
      })
    })

    it('should have valid Tailwind color classes for statuses', () => {
      EXPECTED_STATUSES.forEach((status) => {
        const colorClass = PROCESSING_STATUS_COLORS[status]
        expect(isValidTailwindColor(colorClass)).toBe(true)
      })
    })

    it('should not have extra entries in PROCESSING_STATUS_LABELS', () => {
      const labelKeys = Object.keys(PROCESSING_STATUS_LABELS).sort()
      expect(labelKeys).toEqual(EXPECTED_STATUSES.sort())
    })

    it('should not have extra entries in PROCESSING_STATUS_COLORS', () => {
      const colorKeys = Object.keys(PROCESSING_STATUS_COLORS).sort()
      expect(colorKeys).toEqual(EXPECTED_STATUSES.sort())
    })

    it('should have capitalized labels', () => {
      EXPECTED_STATUSES.forEach((status) => {
        const label = PROCESSING_STATUS_LABELS[status]
        expect(label[0]).toBe(label[0].toUpperCase())
      })
    })
  })

  describe('CONTENT_TYPES', () => {
    it('should contain exactly 7 content types', () => {
      expect(CONTENT_TYPES).toHaveLength(7)
    })

    it('should have all content types as strings', () => {
      CONTENT_TYPES.forEach((contentType) => {
        expect(typeof contentType).toBe('string')
        expect(contentType.length).toBeGreaterThan(0)
      })
    })

    it('should have unique content type values', () => {
      const uniqueContentTypes = new Set(CONTENT_TYPES)
      expect(uniqueContentTypes.size).toBe(CONTENT_TYPES.length)
    })

    it('should have labels for all content types', () => {
      CONTENT_TYPES.forEach((contentType) => {
        expect(CONTENT_TYPE_LABELS[contentType]).toBeDefined()
        expect(CONTENT_TYPE_LABELS[contentType].length).toBeGreaterThan(0)
      })
    })

    it('should have descriptions for all content types', () => {
      CONTENT_TYPES.forEach((contentType) => {
        expect(CONTENT_TYPE_DESCRIPTIONS[contentType]).toBeDefined()
        expect(CONTENT_TYPE_DESCRIPTIONS[contentType].length).toBeGreaterThan(0)
      })
    })

    it('should have meaningful descriptions (at least 10 characters)', () => {
      CONTENT_TYPES.forEach((contentType) => {
        expect(CONTENT_TYPE_DESCRIPTIONS[contentType].length).toBeGreaterThan(10)
      })
    })

    it('should not have extra entries in CONTENT_TYPE_LABELS', () => {
      const labelKeys = Object.keys(CONTENT_TYPE_LABELS) as ContentType[]
      expect(labelKeys.sort()).toEqual([...CONTENT_TYPES].sort())
    })

    it('should not have extra entries in CONTENT_TYPE_DESCRIPTIONS', () => {
      const descKeys = Object.keys(CONTENT_TYPE_DESCRIPTIONS) as ContentType[]
      expect(descKeys.sort()).toEqual([...CONTENT_TYPES].sort())
    })

    it('should have non-empty descriptions', () => {
      CONTENT_TYPES.forEach((contentType) => {
        const description = CONTENT_TYPE_DESCRIPTIONS[contentType]
        expect(description.trim().length).toBeGreaterThan(0)
      })
    })
  })

  describe('RESOURCE_LAYOUT_HINTS', () => {
    it('should contain exactly 7 layout hints', () => {
      expect(RESOURCE_LAYOUT_HINTS).toHaveLength(7)
    })

    it('should have all layout hints as strings', () => {
      RESOURCE_LAYOUT_HINTS.forEach((hint) => {
        expect(typeof hint).toBe('string')
        expect(hint.length).toBeGreaterThan(0)
      })
    })

    it('should have unique layout hint values', () => {
      const uniqueHints = new Set(RESOURCE_LAYOUT_HINTS)
      expect(uniqueHints.size).toBe(RESOURCE_LAYOUT_HINTS.length)
    })

    it('should have labels for all layout hints', () => {
      RESOURCE_LAYOUT_HINTS.forEach((hint) => {
        expect(RESOURCE_LAYOUT_HINT_LABELS[hint]).toBeDefined()
        expect(RESOURCE_LAYOUT_HINT_LABELS[hint].length).toBeGreaterThan(0)
      })
    })

    it('should have descriptions for all layout hints', () => {
      RESOURCE_LAYOUT_HINTS.forEach((hint) => {
        expect(RESOURCE_LAYOUT_HINT_DESCRIPTIONS[hint]).toBeDefined()
        expect(RESOURCE_LAYOUT_HINT_DESCRIPTIONS[hint].length).toBeGreaterThan(0)
      })
    })

    it('should have meaningful descriptions (at least 10 characters)', () => {
      RESOURCE_LAYOUT_HINTS.forEach((hint) => {
        expect(RESOURCE_LAYOUT_HINT_DESCRIPTIONS[hint].length).toBeGreaterThan(10)
      })
    })

    it('should not have extra entries in RESOURCE_LAYOUT_HINT_LABELS', () => {
      const labelKeys = Object.keys(RESOURCE_LAYOUT_HINT_LABELS) as ResourceLayoutHint[]
      expect(labelKeys.sort()).toEqual([...RESOURCE_LAYOUT_HINTS].sort())
    })

    it('should not have extra entries in RESOURCE_LAYOUT_HINT_DESCRIPTIONS', () => {
      const descKeys = Object.keys(RESOURCE_LAYOUT_HINT_DESCRIPTIONS) as ResourceLayoutHint[]
      expect(descKeys.sort()).toEqual([...RESOURCE_LAYOUT_HINTS].sort())
    })

    it('should use kebab-case for multi-word layout hints', () => {
      RESOURCE_LAYOUT_HINTS.forEach((hint) => {
        // Should not contain underscores or camelCase
        expect(hint).not.toMatch(/_/)
        expect(hint).not.toMatch(/[A-Z]/)
      })
    })
  })

  describe('Type Safety', () => {
    it('should have CATEGORIES matching Category type', () => {
      // This is a compile-time check, but we can verify runtime consistency
      const categorySet = new Set<Category>(CATEGORIES)
      expect(categorySet.size).toBe(CATEGORIES.length)
    })

    it('should have TAGS matching Tag type', () => {
      const tagSet = new Set<Tag>(TAGS)
      expect(tagSet.size).toBe(TAGS.length)
    })

    it('should have CONTENT_TYPES matching ContentType type', () => {
      const contentTypeSet = new Set<ContentType>(CONTENT_TYPES)
      expect(contentTypeSet.size).toBe(CONTENT_TYPES.length)
    })

    it('should have RESOURCE_LAYOUT_HINTS matching ResourceLayoutHint type', () => {
      const layoutHintSet = new Set<ResourceLayoutHint>(RESOURCE_LAYOUT_HINTS)
      expect(layoutHintSet.size).toBe(RESOURCE_LAYOUT_HINTS.length)
    })
  })

  describe('Cross-constant relationships', () => {
    it('should have "news" in both CATEGORIES and TAGS', () => {
      expect(CATEGORIES).toContain('news')
      expect(TAGS).toContain('news')
    })

    it('should have "thread" in both TAGS and CONTENT_TYPES', () => {
      expect(TAGS).toContain('thread')
      expect(CONTENT_TYPES).toContain('thread')
    })

    it('should have "video" in both TAGS and CONTENT_TYPES', () => {
      expect(TAGS).toContain('video')
      expect(CONTENT_TYPES).toContain('video')
    })

    it('should have "discussion" in both TAGS and CONTENT_TYPES', () => {
      expect(TAGS).toContain('discussion')
      expect(CONTENT_TYPES).toContain('discussion')
    })

    it('should have "announcement" in both TAGS and CONTENT_TYPES', () => {
      expect(TAGS).toContain('announcement')
      expect(CONTENT_TYPES).toContain('announcement')
    })
  })

  describe('Completeness checks', () => {
    it('should have all expected tech categories', () => {
      const techCategories = ['ai', 'machinelearning', 'blockchain', 'crypto', 'defi', 'web3',
                             'devops', 'cloud', 'security', 'mobile', 'frontend', 'backend',
                             'databases', 'apis', 'programming']
      techCategories.forEach((cat) => {
        expect(CATEGORIES).toContain(cat as Category)
      })
    })

    it('should have all expected business categories', () => {
      const businessCategories = ['startups', 'fundraising', 'investing', 'finance', 'marketing',
                                 'sales', 'growth', 'product', 'analytics', 'saas', 'enterprise']
      businessCategories.forEach((cat) => {
        expect(CATEGORIES).toContain(cat as Category)
      })
    })

    it('should have all expected creative and career categories', () => {
      const creativeCareerCategories = ['design', 'ux', 'career', 'leadership', 'productivity', 'learning']
      creativeCareerCategories.forEach((cat) => {
        expect(CATEGORIES).toContain(cat as Category)
      })
    })

    it('should have all expected industry categories', () => {
      const industryCategories = ['gaming', 'hardware', 'biotech', 'ecommerce']
      industryCategories.forEach((cat) => {
        expect(CATEGORIES).toContain(cat as Category)
      })
    })

    it('should have all expected general categories', () => {
      const generalCategories = ['news', 'other']
      generalCategories.forEach((cat) => {
        expect(CATEGORIES).toContain(cat as Category)
      })
    })

    it('should have all expected content sources', () => {
      const sources: ContentSource[] = ['twitter', 'reddit', 'linkedin', 'youtube', 'instagram', 'web']
      sources.forEach((source) => {
        expect(SOURCE_COLORS[source]).toBeDefined()
        expect(SOURCE_TEXT_COLORS[source]).toBeDefined()
        expect(SOURCE_LABELS[source]).toBeDefined()
        expect(SOURCE_ICONS[source]).toBeDefined()
      })
    })
  })
})
