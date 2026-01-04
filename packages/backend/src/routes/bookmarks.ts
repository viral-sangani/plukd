import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth'
import { supabaseAdmin } from '../config/supabase'
import { enqueueBookmarkProcessing } from '../jobs/queue'
import {
  detectSource,
  isTitleBad,
  type Category,
  type ContentSource,
  type Tag,
  type ProcessingStatus,
  type Database,
  categorySchema,
  contentSourceSchema,
  tagSchema,
  processingStatusSchema,
  updateBookmarkSchema,
} from '@plukd/shared'

type BookmarkRow = Database['public']['Tables']['bookmarks']['Row']
type BookmarkInsert = Database['public']['Tables']['bookmarks']['Insert']
type BookmarkUpdate = Database['public']['Tables']['bookmarks']['Update']

export const bookmarksRoutes = new Hono()

// All routes require authentication
bookmarksRoutes.use('*', authMiddleware)

// Default pagination limit
const DEFAULT_PAGE_LIMIT = 25

// Query params schema for list endpoint
const listQuerySchema = z.object({
  // Offset-based pagination
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(DEFAULT_PAGE_LIMIT),
  // Cursor-based pagination (preferred for large datasets)
  cursor: z.string().uuid().optional(), // bookmark ID to start after
  // Filters
  category: categorySchema.optional(),
  source: contentSourceSchema.optional(),
  tags: z.string().optional(), // comma-separated
  search: z.string().optional(),
  status: processingStatusSchema.optional(),
  sortBy: z.enum(['created_at', 'title']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

// GET / - List bookmarks with filtering, pagination, and search
// Supports both offset-based (page/limit) and cursor-based pagination
bookmarksRoutes.get('/', async (c) => {
  try {
    const user = c.get('user')
    const query = c.req.query()

    // Parse and validate query params
    const params = listQuerySchema.parse({
      page: query.page,
      limit: query.limit,
      cursor: query.cursor || undefined,
      category: query.category || undefined,
      source: query.source || undefined,
      tags: query.tags || undefined,
      search: query.search || undefined,
      status: query.status || undefined,
      sortBy: query.sortBy || 'created_at',
      sortOrder: query.sortOrder || 'desc',
    })

    // Determine if using cursor-based pagination
    const useCursor = !!params.cursor

    // Parse tags from comma-separated string
    const parsedTags = params.tags
      ? (params.tags.split(',').filter(Boolean) as Tag[])
      : undefined

    // Build query
    let dbQuery = supabaseAdmin
      .from('bookmarks')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)

    // Apply filters
    if (params.status) {
      dbQuery = dbQuery.eq('processing_status', params.status)
    }

    if (params.category) {
      dbQuery = dbQuery.eq('category', params.category)
    }

    if (params.source) {
      dbQuery = dbQuery.eq('source', params.source)
    }

    if (parsedTags && parsedTags.length > 0) {
      // Filter bookmarks that contain any of the specified tags
      dbQuery = dbQuery.overlaps('tags', parsedTags)
    }

    if (params.search) {
      // Search combines:
      // 1. PostgreSQL full-text search on search_vector (title, blurb, summary, content)
      //    - search_vector is a TSVECTOR column with weighted fields:
      //      A: title, B: blurb, C: summary, D: content
      // 2. ILIKE on URL for domain/path matching
      // 3. ILIKE on category for category name matching
      // 4. Array contains on tags for exact tag matching
      const searchTerm = params.search.trim()
      const searchTermLower = searchTerm.toLowerCase()
      dbQuery = dbQuery.or(
        `search_vector.wfts(english).${searchTerm},url.ilike.%${searchTerm}%,category.ilike.%${searchTerm}%,tags.cs.{${searchTermLower}}`
      )
    }

    // Apply sorting
    dbQuery = dbQuery.order(params.sortBy, {
      ascending: params.sortOrder === 'asc',
    })

    // For cursor-based pagination, we need to find items after the cursor
    if (useCursor) {
      // First, get the cursor bookmark to find its sort value
      const { data: cursorBookmark, error: cursorError } = await supabaseAdmin
        .from('bookmarks')
        .select('id, created_at, title')
        .eq('id', params.cursor as string)
        .eq('user_id', user.id)
        .single<{ id: string; created_at: string; title: string }>()

      if (cursorError || !cursorBookmark) {
        return c.json({ error: 'Invalid cursor: bookmark not found' }, 400)
      }

      // Apply cursor filter based on sort field and direction
      const sortField = params.sortBy
      const isAsc = params.sortOrder === 'asc'
      const cursorValue = sortField === 'created_at' ? cursorBookmark.created_at : cursorBookmark.title

      if (isAsc) {
        // For ascending, get items greater than cursor
        dbQuery = dbQuery.gt(sortField, cursorValue)
      } else {
        // For descending, get items less than cursor
        dbQuery = dbQuery.lt(sortField, cursorValue)
      }

      // Fetch limit + 1 to check if there's a next page
      dbQuery = dbQuery.limit(params.limit + 1)
    } else {
      // Offset-based pagination
      const offset = (params.page - 1) * params.limit
      dbQuery = dbQuery.range(offset, offset + params.limit - 1)
    }

    const { data: bookmarks, error, count } = await dbQuery

    if (error) {
      console.error('[bookmarks] Error fetching bookmarks:', error)
      return c.json({ error: 'Failed to fetch bookmarks' }, 500)
    }

    // Type assertion for bookmarks - Supabase returns properly typed data but inference can be complex
    const typedBookmarks = bookmarks as BookmarkRow[] | null

    const total = count || 0
    const totalPages = Math.ceil(total / params.limit)

    if (useCursor) {
      // Cursor-based pagination response
      const hasNextPage = (typedBookmarks?.length || 0) > params.limit
      const items = hasNextPage ? typedBookmarks?.slice(0, params.limit) : typedBookmarks
      const nextCursor = hasNextPage && items && items.length > 0
        ? items[items.length - 1].id
        : null

      return c.json({
        bookmarks: items || [],
        pagination: {
          limit: params.limit,
          total,
          totalPages,
          hasNextPage,
          nextCursor,
          // For cursor-based, we don't track previous page in the same way
          // Client should maintain cursor history for back navigation
        },
      })
    } else {
      // Offset-based pagination response
      const hasNextPage = params.page < totalPages
      const hasPreviousPage = params.page > 1

      return c.json({
        bookmarks: typedBookmarks || [],
        pagination: {
          page: params.page,
          limit: params.limit,
          total,
          totalPages,
          hasNextPage,
          hasPreviousPage,
        },
      })
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid query parameters', details: error.issues }, 400)
    }
    console.error('[bookmarks] Error in list:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Create bookmark request schema
const createBookmarkSchema = z.object({
  url: z.string().url('Invalid URL format'),
})

// POST / - Create a new bookmark
bookmarksRoutes.post('/', async (c) => {
  try {
    const user = c.get('user')
    const body = await c.req.json()

    // Validate request body
    const { url } = createBookmarkSchema.parse(body)

    // Create bookmark with pending status
    const bookmarkData: BookmarkInsert = {
      user_id: user.id,
      url,
      source: detectSource(url) as ContentSource,
      title: url, // Placeholder, will be updated after processing
      blurb: '',
      summary: '',
      category: 'news' as Category,
      tags: [] as Tag[],
      processing_status: 'pending' as ProcessingStatus,
    }

    const { data: bookmark, error: insertError } = await supabaseAdmin
      .from('bookmarks')
      .insert(bookmarkData as never)
      .select('id, url')
      .single<{ id: string; url: string }>()

    if (insertError) {
      console.error('[bookmarks] Error inserting bookmark:', insertError)
      return c.json({ error: 'Failed to create bookmark' }, 500)
    }

    // Enqueue for background processing
    await enqueueBookmarkProcessing(bookmark.id, bookmark.url, user.id)

    return c.json({
      success: true,
      bookmark: {
        id: bookmark.id,
        url: bookmark.url,
      },
      message: 'Bookmark saved. Processing will complete shortly.',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: error.issues[0]?.message || 'Invalid request' }, 400)
    }
    console.error('[bookmarks] Error creating bookmark:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// GET /counts - Get bookmark counts by source
bookmarksRoutes.get('/counts', async (c) => {
  try {
    const user = c.get('user')

    // Get total count
    const { count: total, error: totalError } = await supabaseAdmin
      .from('bookmarks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if (totalError) {
      console.error('[bookmarks] Error fetching total count:', totalError)
      return c.json({ error: 'Failed to fetch counts' }, 500)
    }

    // Get counts by source using a single query with RPC or group by
    // Since Supabase doesn't support GROUP BY directly, we use Promise.all for parallel queries
    const sources = ['twitter', 'reddit', 'youtube', 'linkedin', 'instagram', 'web'] as const

    const countPromises = sources.map(async (source) => {
      try {
        const { count, error } = await supabaseAdmin
          .from('bookmarks')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('source', source)

        // Handle case where error is truthy but has no meaningful message
        if (error && error.message) {
          console.error(`[bookmarks] Error fetching ${source} count:`, error.message)
          return { source, count: 0 }
        }

        return { source, count: count ?? 0 }
      } catch (err) {
        // Catch any unexpected errors
        console.error(`[bookmarks] Exception fetching ${source} count:`, err)
        return { source, count: 0 }
      }
    })

    const results = await Promise.all(countPromises)
    const bySource: Record<string, number> = {}
    for (const result of results) {
      bySource[result.source] = result.count
    }

    return c.json({
      total: total || 0,
      bySource: {
        twitter: bySource.twitter ?? 0,
        reddit: bySource.reddit ?? 0,
        youtube: bySource.youtube ?? 0,
        linkedin: bySource.linkedin ?? 0,
        instagram: bySource.instagram ?? 0,
        web: bySource.web ?? 0,
      },
    })
  } catch (error) {
    console.error('[bookmarks] Error in counts:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Process bookmark request schema
const processBookmarkSchema = z.object({
  bookmarkId: z.string().uuid('Invalid bookmark ID'),
})

// POST /process - Manual reprocessing of a bookmark
// When reprocessing, if the title is bad ("Untitled", matches URL, etc.),
// we clear it so the processor will extract a fresh title.
bookmarksRoutes.post('/process', async (c) => {
  try {
    const user = c.get('user')
    const body = await c.req.json()

    // Validate request body
    const { bookmarkId } = processBookmarkSchema.parse(body)

    // Verify the bookmark exists and belongs to the user
    // Include title so we can check if it needs to be cleared
    const { data: bookmark, error: fetchError } = await supabaseAdmin
      .from('bookmarks')
      .select('id, url, title')
      .eq('id', bookmarkId)
      .eq('user_id', user.id)
      .single<{ id: string; url: string; title: string | null }>()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return c.json({ error: 'Bookmark not found' }, 404)
      }
      console.error('[bookmarks] Error fetching bookmark:', fetchError)
      return c.json({ error: 'Failed to fetch bookmark' }, 500)
    }

    // Build update data - reset processing status
    const updateData: BookmarkUpdate = {
      processing_status: 'pending',
      processing_error: null,
    }

    // If the current title is bad (Untitled, matches URL, etc.), clear it
    // so the processor will attempt to extract a fresh title
    if (isTitleBad(bookmark.title, bookmark.url)) {
      console.log(
        `[bookmarks] Clearing bad title "${bookmark.title}" for reprocessing bookmark ${bookmarkId}`
      )
      updateData.title = bookmark.url // Reset to URL, processor will update it
    }

    const { error: updateError } = await supabaseAdmin
      .from('bookmarks')
      .update(updateData as never)
      .eq('id', bookmarkId)

    if (updateError) {
      console.error('[bookmarks] Error resetting bookmark status:', updateError)
      return c.json({ error: 'Failed to reset bookmark status' }, 500)
    }

    // Enqueue for background processing
    await enqueueBookmarkProcessing(bookmark.id, bookmark.url, user.id)

    return c.json({
      success: true,
      message: 'Processing triggered',
      bookmarkId: bookmark.id,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: error.issues[0]?.message || 'Invalid request' }, 400)
    }
    console.error('[bookmarks] Error in process:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Processing timeout in milliseconds (5 minutes)
const PROCESSING_TIMEOUT_MS = 5 * 60 * 1000

// GET /:id - Get a single bookmark
bookmarksRoutes.get('/:id', async (c) => {
  try {
    const user = c.get('user')
    const id = c.req.param('id')

    // Validate UUID format
    if (!z.string().uuid().safeParse(id).success) {
      return c.json({ error: 'Invalid bookmark ID' }, 400)
    }

    // Fetch bookmark
    const { data: bookmark, error } = await supabaseAdmin
      .from('bookmarks')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single<BookmarkRow>()

    if (error) {
      if (error.code === 'PGRST116') {
        return c.json({ error: 'Bookmark not found' }, 404)
      }
      console.error('[bookmarks] Error fetching bookmark:', error)
      return c.json({ error: 'Failed to fetch bookmark' }, 500)
    }

    // Check for stale processing - auto-fail bookmarks stuck in pending/processing for > 5 minutes
    const processingStatus = bookmark.processing_status as ProcessingStatus
    if (processingStatus === 'pending' || processingStatus === 'processing') {
      const updatedAt = new Date(bookmark.updated_at)
      const now = new Date()
      const timeSinceUpdate = now.getTime() - updatedAt.getTime()

      if (timeSinceUpdate > PROCESSING_TIMEOUT_MS) {
        console.log(`[bookmarks] Bookmark ${id} stuck in ${processingStatus} for ${Math.round(timeSinceUpdate / 1000)}s, marking as failed`)

        // Update the bookmark status to failed
        const updateData: BookmarkUpdate = {
          processing_status: 'failed',
          processing_error: 'Processing timed out. Please try regenerating the summary.',
          updated_at: new Date().toISOString(),
        }

        const { data: updatedBookmark, error: updateError } = await supabaseAdmin
          .from('bookmarks')
          .update(updateData as never)
          .eq('id', id)
          .eq('user_id', user.id)
          .select()
          .single<BookmarkRow>()

        if (updateError) {
          console.error('[bookmarks] Error updating stale bookmark:', updateError)
          // Return original bookmark if update fails
          return c.json(bookmark)
        }

        return c.json(updatedBookmark)
      }
    }

    return c.json(bookmark)
  } catch (error) {
    console.error('[bookmarks] Error in get:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// PUT /:id - Update a bookmark
bookmarksRoutes.put('/:id', async (c) => {
  try {
    const user = c.get('user')
    const id = c.req.param('id')
    const body = await c.req.json()

    // Validate UUID format
    if (!z.string().uuid().safeParse(id).success) {
      return c.json({ error: 'Invalid bookmark ID' }, 400)
    }

    // Validate that the bookmark exists and belongs to the user
    const { error: fetchError } = await supabaseAdmin
      .from('bookmarks')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return c.json({ error: 'Bookmark not found' }, 404)
      }
      console.error('[bookmarks] Error fetching bookmark:', fetchError)
      return c.json({ error: 'Failed to fetch bookmark' }, 500)
    }

    // Build update object with only allowed fields
    const updateData: BookmarkUpdate = {
      updated_at: new Date().toISOString(),
    }

    // Validate and add allowed fields
    const validatedBody = updateBookmarkSchema.partial().safeParse(body)
    if (!validatedBody.success) {
      return c.json({ error: 'Invalid update data', details: validatedBody.error.issues }, 400)
    }

    const { title, category, tags, blurb, summary } = validatedBody.data

    if (title !== undefined) updateData.title = title
    if (category !== undefined) updateData.category = category
    if (tags !== undefined) updateData.tags = tags
    if (blurb !== undefined) updateData.blurb = blurb
    if (summary !== undefined) updateData.summary = summary

    // Update bookmark
    const { data: updatedBookmark, error: updateError } = await supabaseAdmin
      .from('bookmarks')
      .update(updateData as never)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      console.error('[bookmarks] Error updating bookmark:', updateError)
      return c.json({ error: 'Failed to update bookmark' }, 500)
    }

    return c.json(updatedBookmark)
  } catch (error) {
    console.error('[bookmarks] Error in update:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// PATCH /:id - Update a bookmark (alias for PUT)
bookmarksRoutes.patch('/:id', async (c) => {
  try {
    const user = c.get('user')
    const id = c.req.param('id')
    const body = await c.req.json()

    // Validate UUID format
    if (!z.string().uuid().safeParse(id).success) {
      return c.json({ error: 'Invalid bookmark ID' }, 400)
    }

    // Validate that the bookmark exists and belongs to the user
    const { error: fetchError } = await supabaseAdmin
      .from('bookmarks')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return c.json({ error: 'Bookmark not found' }, 404)
      }
      console.error('[bookmarks] Error fetching bookmark:', fetchError)
      return c.json({ error: 'Failed to fetch bookmark' }, 500)
    }

    // Build update object with only allowed fields
    const updateData: BookmarkUpdate = {
      updated_at: new Date().toISOString(),
    }

    // Validate and add allowed fields
    const validatedBody = updateBookmarkSchema.partial().safeParse(body)
    if (!validatedBody.success) {
      return c.json({ error: 'Invalid update data', details: validatedBody.error.issues }, 400)
    }

    const { title, category, tags, blurb, summary } = validatedBody.data

    if (title !== undefined) updateData.title = title
    if (category !== undefined) updateData.category = category
    if (tags !== undefined) updateData.tags = tags
    if (blurb !== undefined) updateData.blurb = blurb
    if (summary !== undefined) updateData.summary = summary

    // Update bookmark
    const { data: updatedBookmark, error: updateError } = await supabaseAdmin
      .from('bookmarks')
      .update(updateData as never)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      console.error('[bookmarks] Error updating bookmark:', updateError)
      return c.json({ error: 'Failed to update bookmark' }, 500)
    }

    return c.json(updatedBookmark)
  } catch (error) {
    console.error('[bookmarks] Error in patch:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// DELETE /:id - Delete a bookmark
bookmarksRoutes.delete('/:id', async (c) => {
  try {
    const user = c.get('user')
    const id = c.req.param('id')

    // Validate UUID format
    if (!z.string().uuid().safeParse(id).success) {
      return c.json({ error: 'Invalid bookmark ID' }, 400)
    }

    // Delete bookmark (user_id check ensures user can only delete their own)
    const { error } = await supabaseAdmin
      .from('bookmarks')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('[bookmarks] Error deleting bookmark:', error)
      return c.json({ error: 'Failed to delete bookmark' }, 500)
    }

    return c.json({ success: true })
  } catch (error) {
    console.error('[bookmarks] Error in delete:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})
