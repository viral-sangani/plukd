import { describe, it, expect } from 'vitest'
import {
  contentSourceSchema,
  categorySchema,
  tagSchema,
  processingStatusSchema,
  bookmarkSchema,
  userSchema,
  bookmarkListParamsSchema,
  bookmarkListResponseSchema,
  updateBookmarkSchema,
  type ContentSource,
  type Category,
  type Tag,
  type ProcessingStatus,
  type BookmarkSchema,
  type UserSchema,
  type BookmarkListParams,
  type BookmarkListResponse,
  type UpdateBookmark,
} from '../bookmark'

describe('Bookmark Validation Schemas', () => {
  describe('contentSourceSchema', () => {
    describe('valid sources', () => {
      it('should accept all valid sources', () => {
        const validSources: ContentSource[] = [
          'twitter',
          'reddit',
          'linkedin',
          'youtube',
          'web',
        ]

        validSources.forEach((source) => {
          const result = contentSourceSchema.safeParse(source)
          expect(result.success).toBe(true)
          if (result.success) {
            expect(result.data).toBe(source)
          }
        })
      })

      it('should infer correct TypeScript type', () => {
        const source: ContentSource = 'twitter'
        const result = contentSourceSchema.parse(source)
        expect(result).toBe('twitter')
      })
    })

    describe('invalid sources', () => {
      it('should reject invalid string sources', () => {
        const invalidSources = ['facebook', 'instagram', 'tiktok', 'snapchat']

        invalidSources.forEach((source) => {
          const result = contentSourceSchema.safeParse(source)
          expect(result.success).toBe(false)
        })
      })

      it('should reject null and undefined', () => {
        expect(contentSourceSchema.safeParse(null).success).toBe(false)
        expect(contentSourceSchema.safeParse(undefined).success).toBe(false)
      })

      it('should reject non-string types', () => {
        expect(contentSourceSchema.safeParse(123).success).toBe(false)
        expect(contentSourceSchema.safeParse(true).success).toBe(false)
        expect(contentSourceSchema.safeParse({}).success).toBe(false)
        expect(contentSourceSchema.safeParse([]).success).toBe(false)
      })

      it('should reject empty string', () => {
        expect(contentSourceSchema.safeParse('').success).toBe(false)
      })
    })
  })

  describe('categorySchema', () => {
    describe('valid categories', () => {
      it('should accept tech categories', () => {
        const techCategories: Category[] = [
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
        ]

        techCategories.forEach((category) => {
          const result = categorySchema.safeParse(category)
          expect(result.success).toBe(true)
        })
      })

      it('should accept business categories', () => {
        const businessCategories: Category[] = [
          'startups',
          'fundraising',
          'investing',
          'finance',
          'marketing',
          'sales',
          'growth',
          'product',
        ]

        businessCategories.forEach((category) => {
          const result = categorySchema.safeParse(category)
          expect(result.success).toBe(true)
        })
      })

      it('should accept creative and career categories', () => {
        const creativeCategories: Category[] = [
          'design',
          'ux',
          'career',
          'leadership',
          'productivity',
          'learning',
        ]

        creativeCategories.forEach((category) => {
          const result = categorySchema.safeParse(category)
          expect(result.success).toBe(true)
        })
      })

      it('should accept industry categories', () => {
        const industryCategories: Category[] = [
          'gaming',
          'hardware',
          'biotech',
          'ecommerce',
        ]

        industryCategories.forEach((category) => {
          const result = categorySchema.safeParse(category)
          expect(result.success).toBe(true)
        })
      })

      it('should accept general categories', () => {
        const generalCategories: Category[] = ['news', 'other']

        generalCategories.forEach((category) => {
          const result = categorySchema.safeParse(category)
          expect(result.success).toBe(true)
        })
      })
    })

    describe('invalid categories', () => {
      it('should reject invalid category strings', () => {
        const invalidCategories = [
          'invalid-category',
          'sports',
          'entertainment',
          'health',
          'science',
        ]

        invalidCategories.forEach((category) => {
          const result = categorySchema.safeParse(category)
          expect(result.success).toBe(false)
        })
      })

      it('should reject null and undefined', () => {
        expect(categorySchema.safeParse(null).success).toBe(false)
        expect(categorySchema.safeParse(undefined).success).toBe(false)
      })

      it('should reject non-string types', () => {
        expect(categorySchema.safeParse(123).success).toBe(false)
        expect(categorySchema.safeParse(true).success).toBe(false)
      })
    })
  })

  describe('tagSchema', () => {
    describe('valid tags', () => {
      it('should accept all valid tags', () => {
        const validTags: Tag[] = [
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
        ]

        validTags.forEach((tag) => {
          const result = tagSchema.safeParse(tag)
          expect(result.success).toBe(true)
        })
      })

      it('should accept review and analysis tags', () => {
        const reviewTags: Tag[] = [
          'review',
          'comparison',
          'reference',
          'insight',
          'analysis',
        ]

        reviewTags.forEach((tag) => {
          const result = tagSchema.safeParse(tag)
          expect(result.success).toBe(true)
        })
      })

      it('should accept content lifecycle tags', () => {
        const lifecycleTags: Tag[] = [
          'showcase',
          'launch',
          'update',
          'research',
          'interview',
        ]

        lifecycleTags.forEach((tag) => {
          const result = tagSchema.safeParse(tag)
          expect(result.success).toBe(true)
        })
      })
    })

    describe('invalid tags', () => {
      it('should reject invalid tag strings', () => {
        const invalidTags = ['blog', 'article', 'podcast', 'webinar', 'course']

        invalidTags.forEach((tag) => {
          const result = tagSchema.safeParse(tag)
          expect(result.success).toBe(false)
        })
      })

      it('should reject null and undefined', () => {
        expect(tagSchema.safeParse(null).success).toBe(false)
        expect(tagSchema.safeParse(undefined).success).toBe(false)
      })

      it('should reject non-string types', () => {
        expect(tagSchema.safeParse(123).success).toBe(false)
        expect(tagSchema.safeParse([]).success).toBe(false)
      })
    })
  })

  describe('processingStatusSchema', () => {
    describe('valid statuses', () => {
      it('should accept all valid processing statuses', () => {
        const validStatuses: ProcessingStatus[] = [
          'pending',
          'processing',
          'completed',
          'failed',
        ]

        validStatuses.forEach((status) => {
          const result = processingStatusSchema.safeParse(status)
          expect(result.success).toBe(true)
          if (result.success) {
            expect(result.data).toBe(status)
          }
        })
      })
    })

    describe('invalid statuses', () => {
      it('should reject invalid status strings', () => {
        const invalidStatuses = [
          'success',
          'error',
          'queued',
          'cancelled',
          'paused',
        ]

        invalidStatuses.forEach((status) => {
          const result = processingStatusSchema.safeParse(status)
          expect(result.success).toBe(false)
        })
      })

      it('should reject null and undefined', () => {
        expect(processingStatusSchema.safeParse(null).success).toBe(false)
        expect(processingStatusSchema.safeParse(undefined).success).toBe(false)
      })
    })
  })

  describe('bookmarkSchema', () => {
    const createValidBookmark = (): BookmarkSchema => ({
      id: '123e4567-e89b-12d3-a456-426614174000',
      user_id: '123e4567-e89b-12d3-a456-426614174001',
      url: 'https://example.com/article',
      source: 'web',
      title: 'Test Article Title',
      author: 'John Doe',
      author_url: 'https://example.com/authors/john',
      content: 'This is the article content.',
      media_urls: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
      published_at: '2024-01-01T12:00:00.000Z',
      category: 'programming',
      tags: ['tutorial', 'guide'],
      blurb: 'A short summary of the article.',
      summary: 'A detailed summary of the article content.',
      processing_status: 'completed',
      processing_error: null,
      raw_metadata: { og: { title: 'OG Title' } },
      created_at: '2024-01-01T12:00:00.000Z',
      updated_at: '2024-01-01T12:00:00.000Z',
    })

    describe('valid bookmarks', () => {
      it('should accept valid bookmark with all fields', () => {
        const bookmark = createValidBookmark()
        const result = bookmarkSchema.safeParse(bookmark)
        expect(result.success).toBe(true)
      })

      it('should accept bookmark with null optional fields', () => {
        const bookmark: BookmarkSchema = {
          ...createValidBookmark(),
          author: null,
          author_url: null,
          content: null,
          media_urls: null,
          published_at: null,
          processing_error: null,
          raw_metadata: null,
        }
        const result = bookmarkSchema.safeParse(bookmark)
        expect(result.success).toBe(true)
      })

      it('should accept bookmark with empty tags array', () => {
        const bookmark: BookmarkSchema = {
          ...createValidBookmark(),
          tags: [],
        }
        const result = bookmarkSchema.safeParse(bookmark)
        expect(result.success).toBe(true)
      })

      it('should accept bookmark with multiple valid tags', () => {
        const bookmark: BookmarkSchema = {
          ...createValidBookmark(),
          tags: ['tutorial', 'guide', 'tool', 'resource'],
        }
        const result = bookmarkSchema.safeParse(bookmark)
        expect(result.success).toBe(true)
      })

      it('should accept very long title', () => {
        const bookmark: BookmarkSchema = {
          ...createValidBookmark(),
          title: 'A'.repeat(1000),
        }
        const result = bookmarkSchema.safeParse(bookmark)
        expect(result.success).toBe(true)
      })

      it('should accept empty blurb and summary', () => {
        const bookmark: BookmarkSchema = {
          ...createValidBookmark(),
          blurb: '',
          summary: '',
        }
        const result = bookmarkSchema.safeParse(bookmark)
        expect(result.success).toBe(true)
      })
    })

    describe('invalid bookmarks - missing required fields', () => {
      it('should reject bookmark without id', () => {
        const bookmark = { ...createValidBookmark() }
        delete (bookmark as any).id
        const result = bookmarkSchema.safeParse(bookmark)
        expect(result.success).toBe(false)
      })

      it('should reject bookmark without user_id', () => {
        const bookmark = { ...createValidBookmark() }
        delete (bookmark as any).user_id
        const result = bookmarkSchema.safeParse(bookmark)
        expect(result.success).toBe(false)
      })

      it('should reject bookmark without url', () => {
        const bookmark = { ...createValidBookmark() }
        delete (bookmark as any).url
        const result = bookmarkSchema.safeParse(bookmark)
        expect(result.success).toBe(false)
      })

      it('should reject bookmark without title', () => {
        const bookmark = { ...createValidBookmark() }
        delete (bookmark as any).title
        const result = bookmarkSchema.safeParse(bookmark)
        expect(result.success).toBe(false)
      })

      it('should reject bookmark without category', () => {
        const bookmark = { ...createValidBookmark() }
        delete (bookmark as any).category
        const result = bookmarkSchema.safeParse(bookmark)
        expect(result.success).toBe(false)
      })

      it('should reject bookmark without tags', () => {
        const bookmark = { ...createValidBookmark() }
        delete (bookmark as any).tags
        const result = bookmarkSchema.safeParse(bookmark)
        expect(result.success).toBe(false)
      })
    })

    describe('invalid bookmarks - wrong types', () => {
      it('should reject invalid UUID format for id', () => {
        const bookmark: any = {
          ...createValidBookmark(),
          id: 'not-a-uuid',
        }
        const result = bookmarkSchema.safeParse(bookmark)
        expect(result.success).toBe(false)
      })

      it('should reject invalid UUID format for user_id', () => {
        const bookmark: any = {
          ...createValidBookmark(),
          user_id: '12345',
        }
        const result = bookmarkSchema.safeParse(bookmark)
        expect(result.success).toBe(false)
      })

      it('should reject invalid URL format', () => {
        const bookmark: any = {
          ...createValidBookmark(),
          url: 'not-a-url',
        }
        const result = bookmarkSchema.safeParse(bookmark)
        expect(result.success).toBe(false)
      })

      it('should reject invalid source enum', () => {
        const bookmark: any = {
          ...createValidBookmark(),
          source: 'facebook',
        }
        const result = bookmarkSchema.safeParse(bookmark)
        expect(result.success).toBe(false)
      })

      it('should reject empty title', () => {
        const bookmark: any = {
          ...createValidBookmark(),
          title: '',
        }
        const result = bookmarkSchema.safeParse(bookmark)
        expect(result.success).toBe(false)
      })

      it('should reject invalid author_url format', () => {
        const bookmark: any = {
          ...createValidBookmark(),
          author_url: 'not-a-url',
        }
        const result = bookmarkSchema.safeParse(bookmark)
        expect(result.success).toBe(false)
      })

      it('should reject invalid media_urls array with non-URL strings', () => {
        const bookmark: any = {
          ...createValidBookmark(),
          media_urls: ['not-a-url', 'also-not-a-url'],
        }
        const result = bookmarkSchema.safeParse(bookmark)
        expect(result.success).toBe(false)
      })

      it('should reject invalid datetime format for published_at', () => {
        const bookmark: any = {
          ...createValidBookmark(),
          published_at: '2024-01-01',
        }
        const result = bookmarkSchema.safeParse(bookmark)
        expect(result.success).toBe(false)
      })

      it('should reject invalid category enum', () => {
        const bookmark: any = {
          ...createValidBookmark(),
          category: 'invalid-category',
        }
        const result = bookmarkSchema.safeParse(bookmark)
        expect(result.success).toBe(false)
      })

      it('should reject tags array with invalid tag enum', () => {
        const bookmark: any = {
          ...createValidBookmark(),
          tags: ['tutorial', 'invalid-tag'],
        }
        const result = bookmarkSchema.safeParse(bookmark)
        expect(result.success).toBe(false)
      })

      it('should reject invalid processing_status enum', () => {
        const bookmark: any = {
          ...createValidBookmark(),
          processing_status: 'success',
        }
        const result = bookmarkSchema.safeParse(bookmark)
        expect(result.success).toBe(false)
      })

      it('should reject invalid datetime format for created_at', () => {
        const bookmark: any = {
          ...createValidBookmark(),
          created_at: 'invalid-date',
        }
        const result = bookmarkSchema.safeParse(bookmark)
        expect(result.success).toBe(false)
      })
    })

    describe('type inference', () => {
      it('should infer correct TypeScript type', () => {
        const bookmark = createValidBookmark()
        const result = bookmarkSchema.parse(bookmark)

        // Type check - this should compile
        const id: string = result.id
        const userId: string = result.user_id
        const url: string = result.url
        const source: ContentSource = result.source
        const category: Category = result.category
        const tags: Tag[] = result.tags

        expect(id).toBeDefined()
        expect(userId).toBeDefined()
        expect(url).toBeDefined()
        expect(source).toBeDefined()
        expect(category).toBeDefined()
        expect(tags).toBeDefined()
      })
    })
  })

  describe('userSchema', () => {
    const createValidUser = (): UserSchema => ({
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'test@example.com',
      name: 'John Doe',
      avatar_url: 'https://example.com/avatar.jpg',
      telegram_chat_id: '123456789',
      telegram_username: 'johndoe',
      telegram_linked_at: '2024-01-01T12:00:00.000Z',
      created_at: '2024-01-01T12:00:00.000Z',
      updated_at: '2024-01-01T12:00:00.000Z',
    })

    describe('valid users', () => {
      it('should accept valid user with all fields', () => {
        const user = createValidUser()
        const result = userSchema.safeParse(user)
        expect(result.success).toBe(true)
      })

      it('should accept user with null optional fields', () => {
        const user: UserSchema = {
          ...createValidUser(),
          name: null,
          avatar_url: null,
          telegram_chat_id: null,
          telegram_username: null,
          telegram_linked_at: null,
        }
        const result = userSchema.safeParse(user)
        expect(result.success).toBe(true)
      })

      it('should accept user with valid telegram fields', () => {
        const user: UserSchema = {
          ...createValidUser(),
          telegram_chat_id: '987654321',
          telegram_username: 'testuser',
        }
        const result = userSchema.safeParse(user)
        expect(result.success).toBe(true)
      })

      it('should accept user without telegram link', () => {
        const user: UserSchema = {
          ...createValidUser(),
          telegram_chat_id: null,
          telegram_username: null,
          telegram_linked_at: null,
        }
        const result = userSchema.safeParse(user)
        expect(result.success).toBe(true)
      })
    })

    describe('invalid users', () => {
      it('should reject user without id', () => {
        const user = { ...createValidUser() }
        delete (user as any).id
        const result = userSchema.safeParse(user)
        expect(result.success).toBe(false)
      })

      it('should reject user without email', () => {
        const user = { ...createValidUser() }
        delete (user as any).email
        const result = userSchema.safeParse(user)
        expect(result.success).toBe(false)
      })

      it('should reject invalid UUID format', () => {
        const user: any = {
          ...createValidUser(),
          id: 'not-a-uuid',
        }
        const result = userSchema.safeParse(user)
        expect(result.success).toBe(false)
      })

      it('should reject invalid email format', () => {
        const user: any = {
          ...createValidUser(),
          email: 'not-an-email',
        }
        const result = userSchema.safeParse(user)
        expect(result.success).toBe(false)
      })

      it('should reject invalid avatar_url format', () => {
        const user: any = {
          ...createValidUser(),
          avatar_url: 'not-a-url',
        }
        const result = userSchema.safeParse(user)
        expect(result.success).toBe(false)
      })

      it('should reject invalid telegram_linked_at format', () => {
        const user: any = {
          ...createValidUser(),
          telegram_linked_at: '2024-01-01',
        }
        const result = userSchema.safeParse(user)
        expect(result.success).toBe(false)
      })

      it('should reject invalid created_at format', () => {
        const user: any = {
          ...createValidUser(),
          created_at: 'invalid-date',
        }
        const result = userSchema.safeParse(user)
        expect(result.success).toBe(false)
      })
    })
  })

  describe('bookmarkListParamsSchema', () => {
    describe('valid params', () => {
      it('should accept valid pagination params', () => {
        const params: BookmarkListParams = {
          page: 1,
          limit: 20,
        }
        const result = bookmarkListParamsSchema.safeParse(params)
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.page).toBe(1)
          expect(result.data.limit).toBe(20)
        }
      })

      it('should apply default values when optional params are omitted', () => {
        const params = {}
        const result = bookmarkListParamsSchema.safeParse(params)
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.page).toBe(1)
          expect(result.data.limit).toBe(20)
          expect(result.data.sortBy).toBe('created_at')
          expect(result.data.sortOrder).toBe('desc')
        }
      })

      it('should accept valid filter params', () => {
        const params: BookmarkListParams = {
          page: 2,
          limit: 50,
          category: 'programming',
          tags: ['tutorial', 'guide'],
          source: 'twitter',
          status: 'completed',
        }
        const result = bookmarkListParamsSchema.safeParse(params)
        expect(result.success).toBe(true)
      })

      it('should accept valid search param', () => {
        const params = {
          search: 'typescript tutorial',
        }
        const result = bookmarkListParamsSchema.safeParse(params)
        expect(result.success).toBe(true)
      })

      it('should accept valid sorting params', () => {
        const params = {
          sortBy: 'title',
          sortOrder: 'asc',
        }
        const result = bookmarkListParamsSchema.safeParse(params)
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.sortBy).toBe('title')
          expect(result.data.sortOrder).toBe('asc')
        }
      })

      it('should accept maximum limit value', () => {
        const params = {
          limit: 100,
        }
        const result = bookmarkListParamsSchema.safeParse(params)
        expect(result.success).toBe(true)
      })

      it('should accept large page number', () => {
        const params = {
          page: 1000,
        }
        const result = bookmarkListParamsSchema.safeParse(params)
        expect(result.success).toBe(true)
      })
    })

    describe('invalid params', () => {
      it('should reject negative page number', () => {
        const params = {
          page: -1,
        }
        const result = bookmarkListParamsSchema.safeParse(params)
        expect(result.success).toBe(false)
      })

      it('should reject zero page number', () => {
        const params = {
          page: 0,
        }
        const result = bookmarkListParamsSchema.safeParse(params)
        expect(result.success).toBe(false)
      })

      it('should reject negative limit', () => {
        const params = {
          limit: -10,
        }
        const result = bookmarkListParamsSchema.safeParse(params)
        expect(result.success).toBe(false)
      })

      it('should reject limit greater than 100', () => {
        const params = {
          limit: 101,
        }
        const result = bookmarkListParamsSchema.safeParse(params)
        expect(result.success).toBe(false)
      })

      it('should reject invalid category', () => {
        const params: any = {
          category: 'invalid-category',
        }
        const result = bookmarkListParamsSchema.safeParse(params)
        expect(result.success).toBe(false)
      })

      it('should reject invalid tags array', () => {
        const params: any = {
          tags: ['tutorial', 'invalid-tag'],
        }
        const result = bookmarkListParamsSchema.safeParse(params)
        expect(result.success).toBe(false)
      })

      it('should reject invalid source', () => {
        const params: any = {
          source: 'facebook',
        }
        const result = bookmarkListParamsSchema.safeParse(params)
        expect(result.success).toBe(false)
      })

      it('should reject invalid status', () => {
        const params: any = {
          status: 'success',
        }
        const result = bookmarkListParamsSchema.safeParse(params)
        expect(result.success).toBe(false)
      })

      it('should reject invalid sortBy value', () => {
        const params: any = {
          sortBy: 'updated_at',
        }
        const result = bookmarkListParamsSchema.safeParse(params)
        expect(result.success).toBe(false)
      })

      it('should reject invalid sortOrder value', () => {
        const params: any = {
          sortOrder: 'ascending',
        }
        const result = bookmarkListParamsSchema.safeParse(params)
        expect(result.success).toBe(false)
      })

      it('should reject non-integer page number', () => {
        const params: any = {
          page: 1.5,
        }
        const result = bookmarkListParamsSchema.safeParse(params)
        expect(result.success).toBe(false)
      })

      it('should reject non-integer limit', () => {
        const params: any = {
          limit: 20.5,
        }
        const result = bookmarkListParamsSchema.safeParse(params)
        expect(result.success).toBe(false)
      })
    })
  })

  describe('bookmarkListResponseSchema', () => {
    const createValidResponse = (): BookmarkListResponse => ({
      bookmarks: [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          user_id: '123e4567-e89b-12d3-a456-426614174001',
          url: 'https://example.com/article',
          source: 'web',
          title: 'Test Article',
          author: null,
          author_url: null,
          content: null,
          media_urls: null,
          published_at: null,
          category: 'programming',
          tags: ['tutorial'],
          blurb: 'Test blurb',
          summary: 'Test summary',
          processing_status: 'completed',
          processing_error: null,
          raw_metadata: null,
          created_at: '2024-01-01T12:00:00.000Z',
          updated_at: '2024-01-01T12:00:00.000Z',
        },
      ],
      pagination: {
        page: 1,
        limit: 20,
        total: 100,
        totalPages: 5,
      },
    })

    describe('valid responses', () => {
      it('should accept valid response with bookmarks', () => {
        const response = createValidResponse()
        const result = bookmarkListResponseSchema.safeParse(response)
        expect(result.success).toBe(true)
      })

      it('should accept response with empty bookmarks array', () => {
        const response: BookmarkListResponse = {
          bookmarks: [],
          pagination: {
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 0,
          },
        }
        const result = bookmarkListResponseSchema.safeParse(response)
        expect(result.success).toBe(true)
      })

      it('should accept response with multiple bookmarks', () => {
        const response = createValidResponse()
        response.bookmarks.push({
          ...response.bookmarks[0],
          id: '223e4567-e89b-12d3-a456-426614174000',
          title: 'Second Article',
        })
        const result = bookmarkListResponseSchema.safeParse(response)
        expect(result.success).toBe(true)
      })

      it('should accept various pagination values', () => {
        const response: BookmarkListResponse = {
          bookmarks: [],
          pagination: {
            page: 10,
            limit: 50,
            total: 500,
            totalPages: 10,
          },
        }
        const result = bookmarkListResponseSchema.safeParse(response)
        expect(result.success).toBe(true)
      })
    })

    describe('invalid responses', () => {
      it('should reject response without bookmarks', () => {
        const response: any = {
          pagination: {
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 0,
          },
        }
        const result = bookmarkListResponseSchema.safeParse(response)
        expect(result.success).toBe(false)
      })

      it('should reject response without pagination', () => {
        const response: any = {
          bookmarks: [],
        }
        const result = bookmarkListResponseSchema.safeParse(response)
        expect(result.success).toBe(false)
      })

      it('should reject response with invalid bookmark in array', () => {
        const response = createValidResponse()
        response.bookmarks.push({
          ...response.bookmarks[0],
          id: 'invalid-uuid',
        } as any)
        const result = bookmarkListResponseSchema.safeParse(response)
        expect(result.success).toBe(false)
      })

      it('should reject pagination without page', () => {
        const response: any = {
          bookmarks: [],
          pagination: {
            limit: 20,
            total: 0,
            totalPages: 0,
          },
        }
        const result = bookmarkListResponseSchema.safeParse(response)
        expect(result.success).toBe(false)
      })

      it('should reject pagination without limit', () => {
        const response: any = {
          bookmarks: [],
          pagination: {
            page: 1,
            total: 0,
            totalPages: 0,
          },
        }
        const result = bookmarkListResponseSchema.safeParse(response)
        expect(result.success).toBe(false)
      })

      it('should reject pagination without total', () => {
        const response: any = {
          bookmarks: [],
          pagination: {
            page: 1,
            limit: 20,
            totalPages: 0,
          },
        }
        const result = bookmarkListResponseSchema.safeParse(response)
        expect(result.success).toBe(false)
      })

      it('should reject pagination without totalPages', () => {
        const response: any = {
          bookmarks: [],
          pagination: {
            page: 1,
            limit: 20,
            total: 0,
          },
        }
        const result = bookmarkListResponseSchema.safeParse(response)
        expect(result.success).toBe(false)
      })

      it('should reject non-array bookmarks', () => {
        const response: any = {
          bookmarks: 'not-an-array',
          pagination: {
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 0,
          },
        }
        const result = bookmarkListResponseSchema.safeParse(response)
        expect(result.success).toBe(false)
      })
    })
  })

  describe('updateBookmarkSchema', () => {
    describe('valid updates', () => {
      it('should accept partial update with single field', () => {
        const update: UpdateBookmark = {
          title: 'Updated Title',
        }
        const result = updateBookmarkSchema.safeParse(update)
        expect(result.success).toBe(true)
      })

      it('should accept partial update with multiple fields', () => {
        const update: UpdateBookmark = {
          title: 'Updated Title',
          category: 'ai',
          tags: ['tutorial', 'guide'],
        }
        const result = updateBookmarkSchema.safeParse(update)
        expect(result.success).toBe(true)
      })

      it('should accept update with only category', () => {
        const update: UpdateBookmark = {
          category: 'blockchain',
        }
        const result = updateBookmarkSchema.safeParse(update)
        expect(result.success).toBe(true)
      })

      it('should accept update with only tags', () => {
        const update: UpdateBookmark = {
          tags: ['news', 'analysis'],
        }
        const result = updateBookmarkSchema.safeParse(update)
        expect(result.success).toBe(true)
      })

      it('should accept update with only blurb', () => {
        const update: UpdateBookmark = {
          blurb: 'Updated blurb text',
        }
        const result = updateBookmarkSchema.safeParse(update)
        expect(result.success).toBe(true)
      })

      it('should accept update with only summary', () => {
        const update: UpdateBookmark = {
          summary: 'Updated detailed summary',
        }
        const result = updateBookmarkSchema.safeParse(update)
        expect(result.success).toBe(true)
      })

      it('should accept empty object (no updates)', () => {
        const update = {}
        const result = updateBookmarkSchema.safeParse(update)
        expect(result.success).toBe(true)
      })

      it('should accept empty tags array', () => {
        const update: UpdateBookmark = {
          tags: [],
        }
        const result = updateBookmarkSchema.safeParse(update)
        expect(result.success).toBe(true)
      })

      it('should accept empty strings for blurb and summary', () => {
        const update: UpdateBookmark = {
          blurb: '',
          summary: '',
        }
        const result = updateBookmarkSchema.safeParse(update)
        expect(result.success).toBe(true)
      })

      it('should accept all valid fields together', () => {
        const update: UpdateBookmark = {
          title: 'New Title',
          category: 'devops',
          tags: ['tool', 'resource'],
          blurb: 'New blurb',
          summary: 'New summary',
        }
        const result = updateBookmarkSchema.safeParse(update)
        expect(result.success).toBe(true)
      })
    })

    describe('invalid updates', () => {
      it('should reject empty title', () => {
        const update: any = {
          title: '',
        }
        const result = updateBookmarkSchema.safeParse(update)
        expect(result.success).toBe(false)
      })

      it('should reject invalid category', () => {
        const update: any = {
          category: 'invalid-category',
        }
        const result = updateBookmarkSchema.safeParse(update)
        expect(result.success).toBe(false)
      })

      it('should reject invalid tags', () => {
        const update: any = {
          tags: ['tutorial', 'invalid-tag'],
        }
        const result = updateBookmarkSchema.safeParse(update)
        expect(result.success).toBe(false)
      })

      it('should reject non-string title', () => {
        const update: any = {
          title: 123,
        }
        const result = updateBookmarkSchema.safeParse(update)
        expect(result.success).toBe(false)
      })

      it('should reject non-array tags', () => {
        const update: any = {
          tags: 'tutorial',
        }
        const result = updateBookmarkSchema.safeParse(update)
        expect(result.success).toBe(false)
      })

      it('should ignore extra fields not in schema', () => {
        const update: any = {
          title: 'Valid Title',
          url: 'https://example.com', // Not in update schema
          source: 'twitter', // Not in update schema
        }
        const result = updateBookmarkSchema.safeParse(update)
        // Zod strips unknown fields by default
        expect(result.success).toBe(true)
        if (result.success) {
          expect((result.data as any).url).toBeUndefined()
          expect((result.data as any).source).toBeUndefined()
        }
      })
    })
  })
})
