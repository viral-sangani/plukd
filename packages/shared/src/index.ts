// Re-export types - prefer types/index.ts as the canonical source
// types/database.ts provides Supabase-specific Database interface
export * from './types'

// Re-export Database type from database.ts (this is unique to that file)
export type { Database } from './types/database'

// Re-export constants
export * from './constants'

// Re-export validations (schemas and their inferred types)
export {
  contentSourceSchema,
  categorySchema,
  tagSchema,
  processingStatusSchema,
  bookmarkSchema,
  userSchema,
  bookmarkListParamsSchema,
  bookmarkListResponseSchema,
  updateBookmarkSchema,
  apiErrorSchema,
  type BookmarkSchema,
  type UserSchema,
  type UpdateBookmark,
} from './validations/bookmark'

// Re-export utils
export * from './utils'
