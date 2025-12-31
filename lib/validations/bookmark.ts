import { z } from 'zod'

// Content sources
export const contentSourceSchema = z.enum([
  'twitter',
  'reddit',
  'linkedin',
  'youtube',
  'web',
])

// Categories
export const categorySchema = z.enum([
  // Tech
  'ai',
  'machinelearning',
  'blockchain',
  'crypto',
  'defi',
  'web3',
  'devops',
  'cloud',
  'security',
  'mobile',
  'frontend',
  'backend',
  'databases',
  'apis',
  'programming',
  // Business
  'startups',
  'fundraising',
  'investing',
  'finance',
  'marketing',
  'sales',
  'growth',
  'product',
  'analytics',
  'saas',
  'enterprise',
  // Creative & Career
  'design',
  'ux',
  'career',
  'leadership',
  'productivity',
  'learning',
  // Industry
  'gaming',
  'hardware',
  'biotech',
  'ecommerce',
  // General
  'news',
  'other',
])

// Tags
export const tagSchema = z.enum([
  'tutorial',
  'guide',
  'opinion',
  'news',
  'tool',
  'resource',
  'video',
  'thread',
  'discussion',
  'announcement',
  'review',
  'comparison',
  'reference',
  'insight',
  'analysis',
  'showcase',
  'launch',
  'update',
  'research',
  'interview',
])

// Processing status
export const processingStatusSchema = z.enum([
  'pending',
  'processing',
  'completed',
  'failed',
])

// Bookmark schema
export const bookmarkSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  url: z.string().url(),
  source: contentSourceSchema,
  title: z.string().min(1),
  author: z.string().nullable(),
  author_url: z.string().url().nullable(),
  content: z.string().nullable(),
  media_urls: z.array(z.string().url()).nullable(),
  published_at: z.string().datetime().nullable(),
  category: categorySchema,
  tags: z.array(tagSchema),
  blurb: z.string(),
  summary: z.string(),
  processing_status: processingStatusSchema,
  processing_error: z.string().nullable(),
  raw_metadata: z.record(z.string(), z.unknown()).nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

// User schema
export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().nullable(),
  avatar_url: z.string().url().nullable(),
  telegram_chat_id: z.string().nullable(),
  telegram_username: z.string().nullable(),
  telegram_linked_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

// Bookmark list params schema
export const bookmarkListParamsSchema = z.object({
  page: z.number().int().positive().optional().default(1),
  limit: z.number().int().positive().max(100).optional().default(20),
  category: categorySchema.optional(),
  tags: z.array(tagSchema).optional(),
  source: contentSourceSchema.optional(),
  search: z.string().optional(),
  status: processingStatusSchema.optional(),
  sortBy: z.enum(['created_at', 'title']).optional().default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
})

// Bookmark list response schema
export const bookmarkListResponseSchema = z.object({
  bookmarks: z.array(bookmarkSchema),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
  }),
})

// Update bookmark schema (partial update)
export const updateBookmarkSchema = z.object({
  title: z.string().min(1).optional(),
  category: categorySchema.optional(),
  tags: z.array(tagSchema).optional(),
  blurb: z.string().optional(),
  summary: z.string().optional(),
})

// API error response
export const apiErrorSchema = z.object({
  error: z.string(),
})

// Type exports
export type ContentSource = z.infer<typeof contentSourceSchema>
export type Category = z.infer<typeof categorySchema>
export type Tag = z.infer<typeof tagSchema>
export type ProcessingStatus = z.infer<typeof processingStatusSchema>
export type BookmarkSchema = z.infer<typeof bookmarkSchema>
export type UserSchema = z.infer<typeof userSchema>
export type BookmarkListParams = z.infer<typeof bookmarkListParamsSchema>
export type BookmarkListResponse = z.infer<typeof bookmarkListResponseSchema>
export type UpdateBookmark = z.infer<typeof updateBookmarkSchema>
